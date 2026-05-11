// v1.2 (11/05/2026) — Phase 2.5 B : recoverMoraleEndTurnV2 modulée par soutien (alliés rayon 1+2)
// v1.1 (10/05/2026) — Phase 2 2C.6 : reset last_move_path en debut de tour (detection charge cav)
// v1.0 (09/05/2026) — Phase 1 L1B.4c : EF resolve_turn (bascule activeTeam, recup morale, end-condition)
//
// Logique :
// 1. CORS / POST only
// 2. Auth JWT
// 3. Body { game_id, client_action_id, scale }
// 4. Idempotence D12 : SELECT cached avant tout
// 5. Charger game + state.tactical + check status='in_progress'
// 6. Charger user team + check activeTeam=userTeam
// 7. Si scale !== 'tactical' → 501 NOT_IMPLEMENTED
// 8. Charger units
// 9. Bascule activeTeam, increment turn si retour blue
// 10. Reset has_moved/has_attacked pour toTeam (bulk)
// 11. Recup morale pour toTeam (hors ZdC ennemie)
// 12. End-condition (team count == 0 → finished + winner)
// 13. UPDATE games
// 14. INSERT game_actions

import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { extractUserFromJWT } from '../_shared/auth.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import {
  ERROR_CODES,
  type Team,
  type UnitKind,
  type GameStateV1,
  type EndTurnBody,
  type EndTurnResult,
  type Scale,
} from '../_shared/types.ts'
import { UNIT_STATS_V2, type UnitState, type UnitSubKind } from '../_shared/engine-port/units.ts'
import { cube, cubeKey } from '../_shared/engine-port/hex/index.ts'
import { computeEnemyZoc, type UnitForZoc } from '../_shared/engine-port/zoc/index.ts'
import { recoverMoraleEndTurnV2 } from '../_shared/engine-port/morale/index.ts'
import { computeSupport } from '../_shared/engine-port/cohesion/index.ts'

const TAG = '[resolve_turn v1.2]'

interface UnitRow {
  id: string
  game_id: string
  team: Team
  kind: UnitKind
  q: number
  r: number
  hp: number
  hp_max: number
  wounded: number
  morale: number
  morale_max: number
  routed: boolean
  has_moved: boolean
  has_attacked: boolean
  // Phase 2 (migration 012) — peuvent être NULL si pas encore migrées
  effective: number | null
  effective_max: number | null
  effective_min: number | null
  killed: number | null
  sub_kind: UnitSubKind | null
}

function buildUnitState(row: UnitRow): UnitState {
  const stats = UNIT_STATS_V2[row.kind]
  const ratio = row.hp_max > 0 ? row.hp / row.hp_max : 1
  const effective = row.effective ?? Math.round(ratio * stats.effectiveMax)
  const effectiveMax = row.effective_max ?? stats.effectiveMax
  const effectiveMin = row.effective_min ?? stats.effectiveMin
  return {
    id: row.id,
    kind: row.kind,
    team: row.team,
    position: cube(row.q, row.r),
    hp: row.hp,
    hpMax: row.hp_max,
    wounded: row.wounded ?? 0,
    morale: row.morale,
    moraleMax: row.morale_max,
    hasMoved: row.has_moved,
    hasAttacked: row.has_attacked,
    routed: row.routed,
    effective,
    effectiveMax,
    effectiveMin,
    killed: row.killed ?? 0,
    subKind: row.sub_kind ?? undefined,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'POST only', 405)
  }

  try {
    // 1. Auth
    const user = await extractUserFromJWT(req)
    if (!user) return errorResponse(ERROR_CODES.UNAUTHENTICATED, 'JWT invalid or missing', 401)

    // 2. Body
    const body = (await req.json().catch(() => null)) as EndTurnBody | null
    if (!body || typeof body.game_id !== 'string' || typeof body.scale !== 'string') {
      return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { game_id, client_action_id, scale }', 400)
    }
    const gameId = body.game_id
    const clientActionId = typeof body.client_action_id === 'string' ? body.client_action_id : null
    const scale = body.scale as Scale

    const admin = getAdminClient()

    // 3. Idempotence D12
    if (clientActionId) {
      const { data: cached } = await admin
        .from('game_actions')
        .select('result, action_type')
        .eq('game_id', gameId)
        .eq('client_action_id', clientActionId)
        .maybeSingle()
      if (cached) {
        return jsonResponse({ ok: true, idempotent: true, result: cached.result })
      }
    }

    // 4. Game + state
    const { data: game, error: gameErr } = await admin
      .from('games')
      .select('id, status, state, turn_number')
      .eq('id', gameId)
      .single()
    if (gameErr || !game) return errorResponse(ERROR_CODES.GAME_NOT_FOUND, 'game not found', 404)
    if (game.status !== 'in_progress') {
      return errorResponse(ERROR_CODES.NOT_IN_PROGRESS, `status is ${game.status}`, 400)
    }

    const state = game.state as Partial<GameStateV1> | null
    const tactical = state?.tactical
    if (!tactical) return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'state.tactical missing', 500)

    const fromTeam = (tactical.activeTeam ?? 'blue') as Team
    const turnBefore = tactical.currentTurn ?? 1
    const phase = tactical.phase ?? 'orders'
    const boardRadius = tactical.boardRadius ?? 5
    const scenarioId = tactical.scenarioId ?? ''

    // 5. User team
    const { data: playerRow, error: playerErr } = await admin
      .from('game_players')
      .select('team')
      .eq('game_id', gameId)
      .eq('user_id', user.userId)
      .maybeSingle()
    if (playerErr || !playerRow || !playerRow.team) {
      return errorResponse(ERROR_CODES.NOT_IN_GAME, 'user is not a player of this game', 403)
    }
    const userTeam = playerRow.team as Team
    if (fromTeam !== userTeam) {
      return errorResponse(ERROR_CODES.NOT_YOUR_TURN, `active team is ${fromTeam}`, 403)
    }

    // 6. Scale check
    if (scale !== 'tactical') {
      return errorResponse(ERROR_CODES.NOT_IMPLEMENTED, `scale ${scale} not implemented`, 501)
    }

    // 7. Charger units (SELECT colonnes Phase 2 nécessaires au computeSupport)
    const { data: unitsRaw, error: unitsErr } = await admin
      .from('units')
      .select(
        'id, game_id, team, kind, q, r, hp, hp_max, wounded, morale, morale_max, routed, ' +
        'has_moved, has_attacked, effective, effective_max, effective_min, killed, sub_kind',
      )
      .eq('game_id', gameId)
    if (unitsErr || !unitsRaw) return errorResponse(ERROR_CODES.INTERNAL, 'units fetch failed', 500)
    const units = unitsRaw as UnitRow[]

    // 8. Bascule team + turn
    const toTeam: Team = fromTeam === 'blue' ? 'red' : 'blue'
    // Increment turn quand on revient sur blue (1 round = blue + red joues)
    const turnAfter = fromTeam === 'red' ? turnBefore + 1 : turnBefore

    // 9. Reset has_moved / has_attacked / last_move_path pour units de toTeam
    // Phase 2 : last_move_path est la trajectoire de ce tour. La reseter en debut
    // de tour evite que la detection charge cav se base sur des deplacements anciens.
    const { error: resetErr } = await admin
      .from('units')
      .update({ has_moved: false, has_attacked: false, last_move_path: null })
      .eq('game_id', gameId)
      .eq('team', toTeam)
    if (resetErr) {
      console.error(`${TAG} reset flags failed:`, resetErr.message)
      return errorResponse(ERROR_CODES.INTERNAL, `reset flags failed: ${resetErr.message}`, 500)
    }

    // 10. Recup morale pour toTeam (hors ZdC ennemie, hadCombat=false MVP)
    // Phase 2.5 : récupération modulée par soutien (alliés rayon 1+2 non-Brisés).
    const unitsForZoc: UnitForZoc[] = units.map(u => ({
      team: u.team,
      position: cube(u.q, u.r),
      routed: u.routed,
    }))
    const enemyZocFromToTeamPerspective = computeEnemyZoc(unitsForZoc, toTeam)
    // Construire tous les UnitState (besoin alliés pour computeSupport)
    const allStates: UnitState[] = units.map(buildUnitState)

    let unitsRecoveredCount = 0
    for (const row of units) {
      if (row.team !== toTeam) continue
      const before = allStates.find(s => s.id === row.id)!
      const inZoc = enemyZocFromToTeamPerspective.has(cubeKey(before.position))
      const support = computeSupport(before, allStates)
      const after = recoverMoraleEndTurnV2(before, false, inZoc, support)
      if (after.morale === before.morale && after.routed === before.routed) continue
      unitsRecoveredCount++
      const { error: moraleErr } = await admin
        .from('units')
        .update({ morale: after.morale, routed: after.routed })
        .eq('id', row.id)
        .eq('game_id', gameId)
      if (moraleErr) {
        console.warn(`${TAG} morale update failed for ${row.id}:`, moraleErr.message)
      }
    }

    // 11. End-condition (count units par team apres updates de morale, qui ne suppriment rien)
    let blueCount = 0
    let redCount = 0
    for (const u of units) {
      if (u.team === 'blue') blueCount++
      else if (u.team === 'red') redCount++
    }
    const finished = blueCount === 0 || redCount === 0
    const winner: Team | null = blueCount === 0 ? 'red' : (redCount === 0 ? 'blue' : null)

    // 12. UPDATE games
    const newState: GameStateV1 = {
      version: 1,
      tactical: {
        phase,
        boardRadius,
        currentTurn: turnAfter,
        activeTeam: toTeam,
        scenarioId,
        winner,
      },
    }
    const { error: gameUpdateErr } = await admin
      .from('games')
      .update({
        state: newState,
        status: finished ? 'finished' : 'in_progress',
        turn_number: turnAfter,
        last_action_at: new Date().toISOString(),
      })
      .eq('id', gameId)
    if (gameUpdateErr) {
      console.error(`${TAG} game update failed:`, gameUpdateErr.message)
      return errorResponse(ERROR_CODES.INTERNAL, `game update failed: ${gameUpdateErr.message}`, 500)
    }

    // 13. Snapshot D13
    const result: EndTurnResult = {
      scale,
      from_team: fromTeam,
      to_team: toTeam,
      turn_before: turnBefore,
      turn_after: turnAfter,
      units_recovered_count: unitsRecoveredCount,
      finished,
      winner,
    }

    // 14. INSERT game_actions
    const seed = Date.now()
    const { error: actionErr } = await admin.from('game_actions').insert({
      game_id: gameId,
      turn: turnBefore, // l'action a eu lieu DURANT turnBefore
      actor_user_id: user.userId,
      action_type: 'end_turn',
      payload: { scale },
      result,
      seed,
      client_action_id: clientActionId,
    })
    if (actionErr) {
      if (actionErr.code === '23505' && clientActionId) {
        const { data: cached } = await admin
          .from('game_actions')
          .select('result')
          .eq('game_id', gameId)
          .eq('client_action_id', clientActionId)
          .maybeSingle()
        if (cached) {
          return jsonResponse({ ok: true, idempotent: true, result: cached.result })
        }
      }
      console.warn(`${TAG} game_actions insert failed:`, actionErr.message)
    }

    return jsonResponse({ ok: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error(`${TAG} uncaught:`, message)
    return errorResponse(ERROR_CODES.INTERNAL, message, 500)
  }
})
