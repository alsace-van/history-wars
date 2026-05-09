// v1.0 (09/05/2026) — Phase 1 L1B.3 : EF resolve_action dispatcher (cas 'move' uniquement)
// Source : PLAN-PHASE-1.md § 3.4
// Cas attack_ranged / attack_melee = 501 NOT_IMPLEMENTED (livraison L1B.4).
//
// Logique :
// 1. CORS / POST only
// 2. Auth JWT
// 3. Body { game_id, client_action_id, action: { type, payload } }
// 4. Idempotence D12 : SELECT cached avant tout
// 5. Charger game + state + players + units
// 6. Valider status='in_progress', phase='orders', activeTeam=user_team
// 7. Switch action.type
//    - 'move' → validation + UPDATE units + INSERT game_actions
//    - autre → 501

import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { extractUserFromJWT } from '../_shared/auth.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import {
  ERROR_CODES,
  type Team,
  type UnitKind,
  type GameStateV1,
  type ResolveActionBody,
  type MovePayload,
  type MoveResult,
} from '../_shared/types.ts'
import { UNIT_STATS_BY_KIND } from '../_shared/engine-port/units.ts'
import { cube, cubeDistance, cubeKey } from '../_shared/engine-port/hex/index.ts'
import { bfsReachable } from '../_shared/engine-port/movement/index.ts'
import { computeEnemyZoc, type UnitForZoc } from '../_shared/engine-port/zoc/index.ts'

const TAG = '[resolve_action v1.0]'

interface UnitRow {
  id: string
  game_id: string
  team: Team
  kind: UnitKind
  q: number
  r: number
  hp: number
  hp_max: number
  morale: number
  morale_max: number
  routed: boolean
  has_moved: boolean
  has_attacked: boolean
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
    const body = (await req.json().catch(() => null)) as ResolveActionBody | null
    if (!body || typeof body.game_id !== 'string' || !body.action || typeof body.action.type !== 'string') {
      return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { game_id, client_action_id, action: { type, payload } }', 400)
    }
    const gameId = body.game_id
    const clientActionId = typeof body.client_action_id === 'string' ? body.client_action_id : null
    const actionType = body.action.type

    const admin = getAdminClient()

    // 3. Idempotence D12 — avant toute autre validation
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

    // 4. Charger game + check status + state
    const { data: game, error: gameErr } = await admin
      .from('games')
      .select('id, status, state, turn_number')
      .eq('id', gameId)
      .single()

    if (gameErr || !game) {
      return errorResponse(ERROR_CODES.GAME_NOT_FOUND, 'game not found', 404)
    }
    if (game.status !== 'in_progress') {
      return errorResponse(ERROR_CODES.NOT_IN_PROGRESS, `status is ${game.status}`, 400)
    }

    const state = game.state as Partial<GameStateV1> | null
    const tactical = state?.tactical
    if (!tactical) {
      return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'state.tactical missing', 500)
    }
    const phase = tactical.phase ?? 'orders'
    const activeTeam = tactical.activeTeam ?? 'blue'
    const boardRadius = tactical.boardRadius ?? 5

    if (phase !== 'orders') {
      return errorResponse(ERROR_CODES.NOT_ORDERS_PHASE, `phase is ${phase}`, 400)
    }

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

    if (activeTeam !== userTeam) {
      return errorResponse(ERROR_CODES.NOT_YOUR_TURN, `active team is ${activeTeam}`, 403)
    }

    // 6. Charger unites
    const { data: unitsRaw, error: unitsErr } = await admin
      .from('units')
      .select('id, game_id, team, kind, q, r, hp, hp_max, morale, morale_max, routed, has_moved, has_attacked')
      .eq('game_id', gameId)

    if (unitsErr || !unitsRaw) {
      return errorResponse(ERROR_CODES.INTERNAL, 'units fetch failed', 500)
    }
    const units = unitsRaw as UnitRow[]

    // 7. Dispatcher
    if (actionType === 'move') {
      return await handleMove({
        admin,
        gameId,
        userId: user.userId,
        userTeam,
        currentTurn: tactical.currentTurn ?? 1,
        boardRadius,
        units,
        clientActionId,
        payload: body.action.payload as Partial<MovePayload> | null,
      })
    }

    if (actionType === 'attack_ranged' || actionType === 'attack_melee') {
      return errorResponse(ERROR_CODES.NOT_IMPLEMENTED, `${actionType} delivered in L1B.4`, 501)
    }

    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, `unknown action type: ${actionType}`, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error(`${TAG} uncaught:`, message)
    return errorResponse(ERROR_CODES.INTERNAL, message, 500)
  }
})

// ----------------------------------------------------------------------------
// Cas 'move' — implementation L1B.3
// ----------------------------------------------------------------------------

interface HandleMoveArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  boardRadius: number
  units: UnitRow[]
  clientActionId: string | null
  payload: Partial<MovePayload> | null
}

async function handleMove(args: HandleMoveArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, boardRadius, units, clientActionId, payload } = args

  // Validation payload
  if (!payload || typeof payload.unit_id !== 'string' || typeof payload.dest_q !== 'number' || typeof payload.dest_r !== 'number') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id, dest_q, dest_r }', 400)
  }
  const unitId = payload.unit_id
  const destQ = payload.dest_q
  const destR = payload.dest_r

  // Unit existe + ownership
  const unit = units.find(u => u.id === unitId)
  if (!unit) {
    return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `unit ${unitId} not found in game`, 404)
  }
  if (unit.team !== userTeam) {
    return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'unit belongs to another team', 403)
  }
  if (unit.routed) {
    return errorResponse(ERROR_CODES.UNIT_ROUTED, 'routed units cannot move', 400)
  }
  if (unit.has_moved) {
    return errorResponse(ERROR_CODES.ALREADY_MOVED, 'unit has already moved this turn', 400)
  }

  // Destination dans le plateau (piege #19)
  const dest = cube(destQ, destR)
  const origin = cube(0, 0)
  if (cubeDistance(dest, origin) > boardRadius) {
    return errorResponse(ERROR_CODES.OUT_OF_BOARD, `destination beyond boardRadius=${boardRadius}`, 400)
  }

  // Mouvement nul rejete (sinon double-click rezero le tour)
  if (unit.q === destQ && unit.r === destR) {
    return errorResponse(ERROR_CODES.INVALID_MOVE, 'destination is current position', 400)
  }

  // BFS reachable
  const stats = UNIT_STATS_BY_KIND[unit.kind]
  const start = cube(unit.q, unit.r)

  // Blockers = positions des AUTRES unites
  const blockers = new Set<string>()
  for (const u of units) {
    if (u.id === unit.id) continue
    blockers.add(cubeKey(cube(u.q, u.r)))
  }

  // ZdC ennemie (piege #17 : entree OK, sortie +infini)
  const unitsForZoc: UnitForZoc[] = units.map(u => ({
    team: u.team,
    position: cube(u.q, u.r),
    routed: u.routed,
  }))
  const enemyZocCubes = computeEnemyZoc(unitsForZoc, userTeam)

  const reachable = bfsReachable({
    start,
    movementPoints: stats.movement,
    blockers,
    enemyZocCubes,
  })

  const destKey = cubeKey(dest)
  const cost = reachable.get(destKey)
  if (cost === undefined) {
    return errorResponse(ERROR_CODES.INVALID_MOVE, `destination ${destKey} not reachable`, 400)
  }

  // UPDATE unit (catch 23505 piege #18 : race UNIQUE position)
  const { error: updateErr } = await admin
    .from('units')
    .update({ q: destQ, r: destR, has_moved: true })
    .eq('id', unitId)
    .eq('game_id', gameId)

  if (updateErr) {
    if (updateErr.code === '23505') {
      return errorResponse(ERROR_CODES.INVALID_MOVE, 'destination occupied (race)', 409)
    }
    console.error(`${TAG} units update failed:`, updateErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `units update failed: ${updateErr.message}`, 500)
  }

  // Snapshot D13
  const result: MoveResult = {
    from: { q: unit.q, r: unit.r },
    to: { q: destQ, r: destR },
    cost,
    snapshot: {
      unit_id: unitId,
      q: destQ,
      r: destR,
      has_moved: true,
    },
  }

  // INSERT game_actions (idempotence via UNIQUE client_action_id, piege #18 race aussi)
  const { error: actionErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: userId,
    action_type: 'move',
    payload: { unit_id: unitId, dest_q: destQ, dest_r: destR },
    result,
    seed: Date.now(),
    client_action_id: clientActionId,
  })

  if (actionErr) {
    // Race idempotence : 2e requete avec meme client_action_id → la 1ere a deja insere → on retourne le cached
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
    // Non-bloquant : le UPDATE units a deja eu lieu. On loggue mais on retourne ok pour le client.
    console.warn(`${TAG} game_actions insert failed:`, actionErr.message)
  }

  return jsonResponse({ ok: true, result })
}
