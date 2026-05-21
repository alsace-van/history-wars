// v1.0 (16/05/2026) — Phase 2.6 : menu post-charge cavalerie → option "Replier 1 hex"
// Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 4 (free 1-hex retreat after charge)
//
// Conditions de validation :
//   - unit_id appartient au joueur courant
//   - unit.pending_post_charge_target_id non-null
//   - dest = case adjacente (distance 1), in-board, libre, S'ÉLOIGNE du défenseur
//     (interdiction de "se replier" en restant adjacent → ce serait équivalent
//     à un stay et permettrait de fuir vers une meilleure case sans coût)
//
// Effets :
//   - UPDATE units : new position, has_moved=true, last_move_path=null,
//     pending_post_charge_target_id=null
//   - PAS d'engagement créé (la cavalerie rompt le contact)
//   - PAS de coût en hommes (free retreat, c'est le bénéfice du choix)
//   - INSERT game_actions row 'charge_retreat'
//
// Idempotent via client_action_id.

import { jsonResponse, errorResponse } from '../../_shared/cors.ts'
import {
  ERROR_CODES,
  type Team,
  type ChargeRetreatPayload,
  type ChargeRetreatResultSnapshot,
} from '../../_shared/types.ts'
import { cube, cubeDistance } from '../../_shared/engine-port/hex/index.ts'
import type { UnitRow } from './_common.ts'

const TAG = '[handleChargeRetreat v1.0]'

export interface HandleChargeRetreatArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  boardRadius: number
  units: UnitRow[]
  clientActionId: string | null
  payload: Partial<ChargeRetreatPayload> | null
}

export async function handleChargeRetreat(args: HandleChargeRetreatArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, boardRadius, units, clientActionId, payload } = args

  if (
    !payload
    || typeof payload.unit_id !== 'string'
    || typeof payload.dest_q !== 'number'
    || typeof payload.dest_r !== 'number'
  ) {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id, dest_q, dest_r }', 400)
  }
  const unitId = payload.unit_id
  const destQ = payload.dest_q
  const destR = payload.dest_r

  const cavRow = units.find(u => u.id === unitId)
  if (!cavRow) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `unit ${unitId} not found`, 404)
  if (cavRow.team !== userTeam) {
    return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'unit belongs to another team', 403)
  }

  const defenderId = cavRow.pending_post_charge_target_id
  if (!defenderId) {
    return errorResponse(
      ERROR_CODES.NO_PENDING_POST_CHARGE,
      'unit has no pending post-charge decision',
      400,
    )
  }

  // Validation destination : adjacent (distance 1), in-board, libre.
  const origin = cube(cavRow.q, cavRow.r)
  const dest = cube(destQ, destR)
  // v1.1 (16/05/2026) — retreat radius étendu 1 → 3 (mirror handleAttack v1.8).
  const retreatDist = cubeDistance(origin, dest)
  if (retreatDist < 1 || retreatDist > 3) {
    return errorResponse(
      ERROR_CODES.RETREAT_DEST_NOT_ADJACENT,
      'retreat destination must be within 1-3 hex',
      400,
    )
  }
  if (cubeDistance(dest, cube(0, 0)) > boardRadius) {
    return errorResponse(
      ERROR_CODES.OUT_OF_BOARD,
      `destination beyond boardRadius=${boardRadius}`,
      400,
    )
  }
  const occupied = units.some(u => u.id !== unitId && u.q === destQ && u.r === destR)
  if (occupied) {
    return errorResponse(ERROR_CODES.RETREAT_DEST_OCCUPIED, 'retreat destination occupied', 400)
  }

  // Validation directionnelle : la destination DOIT s'éloigner du défenseur
  // (ou au moins ne pas s'en rapprocher). Sinon le "retreat" n'a aucun sens
  // tactique et le joueur contourne le coût de "stay".
  const defenderRow = units.find(u => u.id === defenderId)
  if (defenderRow) {
    const defenderPos = cube(defenderRow.q, defenderRow.r)
    const distBefore = cubeDistance(origin, defenderPos)
    const distAfter = cubeDistance(dest, defenderPos)
    if (distAfter < distBefore) {
      return errorResponse(
        ERROR_CODES.RETREAT_DEST_TOO_CLOSE,
        'retreat destination must not get closer to the defender',
        400,
      )
    }
  }

  // UPDATE : position + clear pending + reset last_move_path (pas de charge
  // chainée après retreat) + has_moved=true (la cavalerie a déjà chargé+bougé).
  const { error: updateErr } = await admin
    .from('units')
    .update({
      q: destQ,
      r: destR,
      has_moved: true,
      last_move_path: null,
      pending_post_charge_target_id: null,
    })
    .eq('id', unitId)
    .eq('game_id', gameId)
  if (updateErr) {
    if (updateErr.code === '23505') {
      return errorResponse(ERROR_CODES.RETREAT_DEST_OCCUPIED, 'destination just got occupied (race)', 400)
    }
    console.error(`${TAG} retreat update failed:`, updateErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `update failed: ${updateErr.message}`, 500)
  }

  const snapshot: ChargeRetreatResultSnapshot = {
    unit_id: unitId,
    from: { q: cavRow.q, r: cavRow.r },
    to: { q: destQ, r: destR },
    snapshot: {
      unit_id: unitId,
      q: destQ,
      r: destR,
      has_moved: true,
    },
  }

  const { error: actionErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: userId,
    action_type: 'charge_retreat',
    payload: { unit_id: unitId, dest_q: destQ, dest_r: destR },
    result: snapshot,
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

  return jsonResponse({ ok: true, result: snapshot })
}
