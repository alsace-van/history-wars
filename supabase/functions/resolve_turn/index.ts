// v1.5 (13/05/2026) — Phase 3.2-bis : émission engagement_ticks dans EndTurnResult (UI clarité)
// v1.4 (13/05/2026) — Phase 3.2 Vague B3 : §10.5 évaluation ordres conditionnels (pré-postures)
// v1.3 (11/05/2026) — Phase 2.6 Vague B : tick engagements actifs avant récup moral (combat continu)
// v1.2 (11/05/2026) — Phase 2.5 B : recoverMoraleEndTurnV2 modulée par soutien (alliés rayon 1+2)
//
// Logique :
// 1. CORS / POST only
// 2. Auth JWT
// 3. Body { game_id, client_action_id, scale }
// 4. Idempotence D12 : SELECT cached avant tout
// 5. Charger game + state.tactical + check status='in_progress'
// 6. Charger user team + check activeTeam=userTeam
// 7. Si scale !== 'tactical' → 501 NOT_IMPLEMENTED
// 8. Charger units + engagements actifs + terrain + combat_config
// 9. Phase 2.6 — tick d'attrition par engagement actif (séquentiel)
//    → cumule pertes par unité, applique morale fatigue -2/tour
//    → DELETE engagements dont une unité dissoute
// 10. Bascule activeTeam, increment turn si retour blue
// 11. Reset has_moved/has_attacked pour toTeam (bulk)
// 12. Recup morale pour toTeam (hors ZdC ennemie)
// 13. End-condition (team count == 0 → finished + winner)
// 14. UPDATE games
// 15. INSERT game_actions

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
  type EngagementTickEvent,
  type Scale,
} from '../_shared/types.ts'
import { UNIT_STATS_V2, type UnitState, type UnitSubKind } from '../_shared/engine-port/units.ts'
import { cube, cubeKey } from '../_shared/engine-port/hex/index.ts'
import { computeEnemyZoc, type UnitForZoc } from '../_shared/engine-port/zoc/index.ts'
import { recoverMoraleEndTurnV2 } from '../_shared/engine-port/morale/index.ts'
import { computeSupport } from '../_shared/engine-port/cohesion/index.ts'
import { resolveEngagementTick } from '../_shared/engine-port/engagement/index.ts'
import {
  DEFAULT_COMBAT_CONFIG,
  type CombatConfig,
} from '../_shared/engine-port/combat/v2/types.ts'
import {
  DEFAULT_TERRAIN,
  type TerrainType,
} from '../_shared/engine-port/terrain/index.ts'
import { seededRng } from '../_shared/engine-port/combat/rng.ts'
import { evaluateAndApplyOrders } from './_evaluateOrders.ts'

const TAG = '[resolve_turn v1.5]'

interface EngagementRow {
  id: string
  game_id: string
  unit_a_id: string
  unit_b_id: string
  started_turn: number
}

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

    // 7.5. Phase 2.6 — Charger engagements actifs + terrain + combat_config (en //)
    const [engagementsResp, terrainResp, configResp] = await Promise.all([
      admin
        .from('engagements')
        .select('id, game_id, unit_a_id, unit_b_id, started_turn')
        .eq('game_id', gameId),
      admin
        .from('terrain_tiles')
        .select('q, r, type')
        .eq('game_id', gameId),
      admin
        .from('combat_config')
        .select('config')
        .eq('scale', 'tactical')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    const engagements = (engagementsResp.data ?? []) as EngagementRow[]
    const terrainMap = new Map<string, TerrainType>()
    for (const row of (terrainResp.data ?? []) as Array<{ q: number; r: number; type: string }>) {
      terrainMap.set(cubeKey(cube(row.q, row.r)), row.type as TerrainType)
    }
    const combatConfig: CombatConfig =
      (configResp.data?.config as CombatConfig | undefined) ?? DEFAULT_COMBAT_CONFIG

    // 7.6. Phase 2.6 — Tick d'attrition par engagement actif (séquentiel).
    //
    // Multi-engagement : la version MVP applique les ticks dans l'ordre BDD,
    // chaque tick voit l'unité avec son effective déjà réduit par les ticks
    // précédents. Différence vs spec § 6 "cumul absorption" : ici l'absorption
    // se renouvelle à chaque tick. Calibrage vague D si trop punitif.
    //
    // Pour chaque engagement :
    //  1. Snapshot units → UnitState
    //  2. resolveEngagementTick(unitA, unitB, terrain, support, rng)
    //  3. Update unitStates mémoire (cumul progressif)
    //  4. Si dissolved : marquer pour DELETE (unit + engagement cascade)
    const seedTick = Date.now()
    const tickRng = seededRng(seedTick)
    const engagementUpdates = new Map<string, {
      effective: number
      wounded: number
      killed: number
      morale: number
      routed: boolean
      hp: number
    }>()
    const dissolvedUnitIds = new Set<string>()
    const engagementsToDelete: string[] = []
    const tickEvents: EngagementTickEvent[] = []
    const liveUnitStates: Map<string, UnitState> = new Map(
      units.map(u => [u.id, buildUnitState(u)]),
    )

    for (const eng of engagements) {
      const a = liveUnitStates.get(eng.unit_a_id)
      const b = liveUnitStates.get(eng.unit_b_id)
      if (!a || !b) {
        // Unité déjà dissoute par un tick précédent → engagement obsolète, DELETE.
        engagementsToDelete.push(eng.id)
        continue
      }
      // Terrain commun : on prend celui de sideA (les 2 unités sont sur des hex
      // adjacents donc peu de différence ; cf. plan § 2 "même type de terrain").
      const terrain = terrainMap.get(cubeKey(a.position)) ?? DEFAULT_TERRAIN
      const allStates: UnitState[] = Array.from(liveUnitStates.values())
      const supportA = computeSupport(a, allStates)
      const supportB = computeSupport(b, allStates)

      const tick = resolveEngagementTick({
        sideA: a,
        sideB: b,
        terrain,
        currentTurn: turnBefore,
        rng: tickRng,
        config: combatConfig,
        supportA,
        supportB,
      })

      // Mise à jour des snapshots mémoire (effective + morale + flags).
      const aAfter: UnitState = {
        ...a,
        effective: tick.sideA.effectiveAfter,
        wounded: a.wounded + tick.sideA.woundedAdd,
        killed: a.killed + tick.sideA.killed,
        morale: tick.sideA.moraleAfter,
        routed: tick.sideA.routedAfter,
        hp: a.effectiveMax > 0
          ? Math.max(0, Math.round(tick.sideA.effectiveAfter / a.effectiveMax * a.hpMax))
          : a.hp,
      }
      const bAfter: UnitState = {
        ...b,
        effective: tick.sideB.effectiveAfter,
        wounded: b.wounded + tick.sideB.woundedAdd,
        killed: b.killed + tick.sideB.killed,
        morale: tick.sideB.moraleAfter,
        routed: tick.sideB.routedAfter,
        hp: b.effectiveMax > 0
          ? Math.max(0, Math.round(tick.sideB.effectiveAfter / b.effectiveMax * b.hpMax))
          : b.hp,
      }
      liveUnitStates.set(a.id, aAfter)
      liveUnitStates.set(b.id, bAfter)

      engagementUpdates.set(a.id, {
        effective: aAfter.effective,
        wounded: aAfter.wounded,
        killed: aAfter.killed,
        morale: aAfter.morale,
        routed: aAfter.routed,
        hp: aAfter.hp,
      })
      engagementUpdates.set(b.id, {
        effective: bAfter.effective,
        wounded: bAfter.wounded,
        killed: bAfter.killed,
        morale: bAfter.morale,
        routed: bAfter.routed,
        hp: bAfter.hp,
      })

      if (tick.sideA.dissolved) {
        dissolvedUnitIds.add(a.id)
        liveUnitStates.delete(a.id)
      }
      if (tick.sideB.dissolved) {
        dissolvedUnitIds.add(b.id)
        liveUnitStates.delete(b.id)
      }
      if (tick.dissolved) {
        engagementsToDelete.push(eng.id)
      }

      // Phase 3.2-bis : événement tick pour UI (toast + DamageFloater + clarté).
      tickEvents.push({
        engagement_id: eng.id,
        started_turn: eng.started_turn,
        resolved_at_turn: turnBefore,
        side_a: {
          unit_id: a.id,
          team: a.team,
          kind: a.kind as UnitKind,
          killed: tick.sideA.killed,
          wounded_add: tick.sideA.woundedAdd,
          dissolved: tick.sideA.dissolved,
        },
        side_b: {
          unit_id: b.id,
          team: b.team,
          kind: b.kind as UnitKind,
          killed: tick.sideB.killed,
          wounded_add: tick.sideB.woundedAdd,
          dissolved: tick.sideB.dissolved,
        },
        engagement_dissolved: tick.dissolved,
      })
    }

    // 7.7. Applique les UPDATE/DELETE units consécutifs aux ticks (séquentiel).
    for (const [unitId, update] of engagementUpdates) {
      if (dissolvedUnitIds.has(unitId)) {
        // Dissolution : DELETE (les engagements cascade sont gérés par FK ON DELETE)
        const { error } = await admin.from('units').delete().eq('id', unitId).eq('game_id', gameId)
        if (error) {
          console.warn(`${TAG} dissolved unit delete failed for ${unitId}:`, error.message)
        }
        continue
      }
      const { error } = await admin
        .from('units')
        .update({
          effective: update.effective,
          wounded: update.wounded,
          killed: update.killed,
          morale: update.morale,
          routed: update.routed,
          hp: update.hp,
        })
        .eq('id', unitId)
        .eq('game_id', gameId)
      if (error) {
        console.warn(`${TAG} tick update failed for ${unitId}:`, error.message)
      }
    }

    // 7.8. DELETE engagements terminés (ceux dont une unité a dissout).
    // Les engagements dont la cascade FK a déjà supprimé ne se trouvent plus :
    // c'est idempotent.
    if (engagementsToDelete.length > 0) {
      const { error } = await admin
        .from('engagements')
        .delete()
        .in('id', engagementsToDelete)
      if (error) {
        console.warn(`${TAG} engagements delete failed:`, error.message)
      }
    }

    // 7.9. Rafraîchir snapshot units pour la suite (récup moral, end-condition).
    // Les units dissoutes sont retirées. Les autres ont leurs nouvelles valeurs.
    const unitsAfterTick: UnitRow[] = units
      .filter(u => !dissolvedUnitIds.has(u.id))
      .map(u => {
        const update = engagementUpdates.get(u.id)
        if (!update) return u
        return {
          ...u,
          effective: update.effective,
          wounded: update.wounded,
          killed: update.killed,
          morale: update.morale,
          routed: update.routed,
          hp: update.hp,
        }
      })

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
    // Phase 2.6 : travaille sur le snapshot POST-tick engagements (unitsAfterTick).
    const unitsForZoc: UnitForZoc[] = unitsAfterTick.map(u => ({
      team: u.team,
      position: cube(u.q, u.r),
      routed: u.routed,
    }))
    const enemyZocFromToTeamPerspective = computeEnemyZoc(unitsForZoc, toTeam)
    // Construire tous les UnitState (besoin alliés pour computeSupport)
    const allStates: UnitState[] = unitsAfterTick.map(buildUnitState)

    let unitsRecoveredCount = 0
    for (const row of unitsAfterTick) {
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

    // 10.5 Phase 3.2 — Évaluation des ordres conditionnels de toTeam.
    //
    // Snapshot-then-resolve : on évalue sur l'état post-tick post-morale.
    // Pour les ordres exécutables, on applique :
    //   - retreat → UPDATE position + DELETE engagements de l'unité.
    //   - charge  → UPDATE position + INSERT engagement (paire triée).
    //   - fire    → flag has_attacked (damage différé Phase 3.3).
    //   - hold    → no-op.
    // Chaque évaluation (skipped ou non) est loggée en game_actions(order_triggered)
    // pour rapport UI (Vague C4) + replay déterministe.
    //
    // Les engagements actifs APRÈS dissolution = engagements - engagementsToDelete (déduit).
    const activeEngagements = engagements.filter(e => !engagementsToDelete.includes(e.id))
    const ordersResult = await evaluateAndApplyOrders({
      admin,
      gameId,
      toTeam,
      units: Array.from(liveUnitStates.values()),
      engagements: activeEngagements,
      boardRadius,
      currentTurn: turnAfter,
      actorUserId: user.userId,
      terrainMap,
      combatConfig,
    })

    // 11. End-condition — basé sur le snapshot POST-tick (dissolutions appliquées).
    let blueCount = 0
    let redCount = 0
    for (const u of unitsAfterTick) {
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
      orders_triggered: ordersResult.events.length > 0 ? ordersResult.events : undefined,
      engagement_ticks: tickEvents.length > 0 ? tickEvents : undefined,
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
