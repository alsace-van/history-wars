// v1.1 (12/05/2026) — Post-rupture : refuse les dest qui restent adjacentes à un ex-engagé
// v1.0 (10/05/2026) — Phase 2 2C.6 : extrait depuis index.ts + tracking last_move_path pour charge cav
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2C.2, 2C.6

import { jsonResponse, errorResponse } from '../../_shared/cors.ts'
import { ERROR_CODES, type Team, type MovePayload, type MoveResult } from '../../_shared/types.ts'
import { cube, cubeDistance, cubeKey } from '../../_shared/engine-port/hex/index.ts'
import { bfsReachable } from '../../_shared/engine-port/movement/index.ts'
import { computeEnemyZoc, type UnitForZoc } from '../../_shared/engine-port/zoc/index.ts'
import { UNIT_STATS_BY_KIND } from '../../_shared/engine-port/units.ts'
import type { UnitRow } from './_common.ts'

const TAG = '[handleMove v1.0]'

export interface HandleMoveArgs {
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

export async function handleMove(args: HandleMoveArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, boardRadius, units, clientActionId, payload } = args

  // Validation payload
  if (!payload || typeof payload.unit_id !== 'string' || typeof payload.dest_q !== 'number' || typeof payload.dest_r !== 'number') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id, dest_q, dest_r }', 400)
  }
  const unitId = payload.unit_id
  const destQ = payload.dest_q
  const destR = payload.dest_r

  const unit = units.find(u => u.id === unitId)
  if (!unit) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `unit ${unitId} not found in game`, 404)
  if (unit.team !== userTeam) return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'unit belongs to another team', 403)
  if (unit.routed) return errorResponse(ERROR_CODES.UNIT_ROUTED, 'routed units cannot move', 400)
  if (unit.has_moved) return errorResponse(ERROR_CODES.ALREADY_MOVED, 'unit has already moved this turn', 400)

  const dest = cube(destQ, destR)
  const origin = cube(0, 0)
  if (cubeDistance(dest, origin) > boardRadius) {
    return errorResponse(ERROR_CODES.OUT_OF_BOARD, `destination beyond boardRadius=${boardRadius}`, 400)
  }
  if (unit.q === destQ && unit.r === destR) {
    return errorResponse(ERROR_CODES.INVALID_MOVE, 'destination is current position', 400)
  }

  const stats = UNIT_STATS_BY_KIND[unit.kind]
  const start = cube(unit.q, unit.r)
  const blockers = new Set<string>()
  for (const u of units) {
    if (u.id === unit.id) continue
    blockers.add(cubeKey(cube(u.q, u.r)))
  }
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

  // v1.1 — post-rupture : si l'unité vient de Rompre ce tour (hasAttacked=true,
  // hasMoved=false, ennemi adjacent), elle DOIT s'éloigner. Refuse toute dest qui
  // reste adjacente à un ex-engagé (= ennemi actuellement adjacent à la position
  // de départ). Cohérent avec useTacticalSelection v1.8 côté client.
  if (unit.has_attacked) {
    const adjacentEnemies = units.filter(u =>
      u.team !== userTeam && cubeDistance(cube(u.q, u.r), start) === 1
    )
    if (adjacentEnemies.length > 0) {
      const stuckTouchEnemy = adjacentEnemies.some(
        e => cubeDistance(cube(e.q, e.r), dest) <= 1
      )
      if (stuckTouchEnemy) {
        return errorResponse(
          ERROR_CODES.INVALID_MOVE,
          'post-break move must leave melee contact — destination still adjacent to an enemy',
          400,
        )
      }
    }
  }

  // Phase 2 : reconstruction du path effectif start → dest pour `last_move_path`.
  // MVP : on stocke uniquement [start, dest]. Extension complete avec backtrack BFS Phase 5.
  // Pour la detection charge cav (kind C, distance >= 2 en ligne droite), il faut a minima
  // 2 hex; on stocke donc aussi les hex intermediaires en suivant la ligne droite si applicable.
  const movePath = reconstructStraightPath(start, dest)

  // UPDATE unit (catch 23505 piege #18)
  const { error: updateErr } = await admin
    .from('units')
    .update({
      q: destQ,
      r: destR,
      has_moved: true,
      last_move_path: movePath.map(c => ({ q: c.q, r: c.r, s: c.s })),
    })
    .eq('id', unitId)
    .eq('game_id', gameId)

  if (updateErr) {
    if (updateErr.code === '23505') {
      return errorResponse(ERROR_CODES.INVALID_MOVE, 'destination occupied (race)', 409)
    }
    console.error(`${TAG} units update failed:`, updateErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `units update failed: ${updateErr.message}`, 500)
  }

  const result: MoveResult = {
    from: { q: unit.q, r: unit.r },
    to: { q: destQ, r: destR },
    cost,
    snapshot: { unit_id: unitId, q: destQ, r: destR, has_moved: true },
  }

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
    if (actionErr.code === '23505' && clientActionId) {
      const { data: cached } = await admin
        .from('game_actions')
        .select('result')
        .eq('game_id', gameId)
        .eq('client_action_id', clientActionId)
        .maybeSingle()
      if (cached) return jsonResponse({ ok: true, idempotent: true, result: cached.result })
    }
    console.warn(`${TAG} game_actions insert failed:`, actionErr.message)
  }

  return jsonResponse({ ok: true, result })
}

/**
 * Reconstruit un path en ligne droite entre start et dest (interpolation cubique).
 * Phase 2 : utilise pour `last_move_path` (detection charge cav).
 * Si dest == start, retourne [start].
 */
function reconstructStraightPath(start: { q: number; r: number; s: number }, dest: { q: number; r: number; s: number }): Array<{ q: number; r: number; s: number }> {
  const distance = cubeDistance(start, dest)
  if (distance === 0) return [start]
  const path: Array<{ q: number; r: number; s: number }> = []
  for (let i = 0; i <= distance; i++) {
    const t = i / distance
    const q = start.q + (dest.q - start.q) * t
    const r = start.r + (dest.r - start.r) * t
    const s = start.s + (dest.s - start.s) * t
    // round cubique (cf. coordinates.ts)
    let rq = Math.round(q)
    let rr = Math.round(r)
    let rs = Math.round(s)
    const dq = Math.abs(rq - q)
    const dr = Math.abs(rr - r)
    const ds = Math.abs(rs - s)
    if (dq > dr && dq > ds) rq = -rr - rs
    else if (dr > ds) rr = -rq - rs
    else rs = -rq - rr
    path.push({ q: rq, r: rr, s: rs })
  }
  return path
}
