// v1.0 (11/05/2026) — Phase 2.5 B : retraite volontaire unité Brisée (désertion si pertes ≥ 50%)
// Source : docs/PLAN-MORAL-COHESION.md § 4

import { jsonResponse, errorResponse } from '../../_shared/cors.ts'
import {
  ERROR_CODES,
  type Team,
  type RetreatPayload,
  type RetreatResult,
} from '../../_shared/types.ts'
import { cube, cubeDistance } from '../../_shared/engine-port/hex/index.ts'
import { computeCohesionFor, type UnitRow } from './_common.ts'

const TAG = '[handleRetreat v1.0]'

export interface HandleRetreatArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  boardRadius: number
  units: UnitRow[]
  clientActionId: string | null
  payload: Partial<RetreatPayload> | null
}

export async function handleRetreat(args: HandleRetreatArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, boardRadius, units, clientActionId, payload } = args

  if (!payload || typeof payload.unit_id !== 'string' || typeof payload.dest_q !== 'number' || typeof payload.dest_r !== 'number') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id, dest_q, dest_r }', 400)
  }
  const unitId = payload.unit_id
  const destQ = payload.dest_q
  const destR = payload.dest_r

  const unit = units.find(u => u.id === unitId)
  if (!unit) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `unit ${unitId} not found`, 404)
  if (unit.team !== userTeam) return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'unit belongs to another team', 403)

  // Validation cohésion : retreat est réservé aux Brisées
  const coh = computeCohesionFor(unitId, units)
  if (!coh) return errorResponse(ERROR_CODES.INTERNAL, 'cohesion lookup failed', 500)
  if (coh.cohesion.state !== 'broken') {
    return errorResponse(ERROR_CODES.COHESION_NOT_BROKEN, 'retreat reserved for broken units', 400)
  }

  // Validation destination : adjacent (distance 1), in-board, libre
  const origin = cube(unit.q, unit.r)
  const dest = cube(destQ, destR)
  if (cubeDistance(origin, dest) !== 1) {
    return errorResponse(ERROR_CODES.RETREAT_DEST_NOT_ADJACENT, 'retreat destination must be adjacent', 400)
  }
  if (cubeDistance(dest, cube(0, 0)) > boardRadius) {
    return errorResponse(ERROR_CODES.OUT_OF_BOARD, `destination beyond boardRadius=${boardRadius}`, 400)
  }
  const occupied = units.some(u => u.id !== unitId && u.q === destQ && u.r === destR)
  if (occupied) {
    return errorResponse(ERROR_CODES.RETREAT_DEST_OCCUPIED, 'retreat destination occupied', 400)
  }

  // Calcul désertion (cf docs/PLAN-MORAL-COHESION.md § 4)
  // Seuil 50% pertes — sous ce seuil, repli stratégique propre = 0 désertion.
  const effective = unit.effective
  const effectiveMax = unit.effective_max
  const effectiveMin = unit.effective_min
  const tauxPertes = effectiveMax > 0 ? (effectiveMax - effective) / effectiveMax : 0
  const desertion = tauxPertes >= 0.5 ? Math.round(effective * (tauxPertes - 0.5)) : 0
  const newEffective = effective - desertion
  const dissolved = newEffective < effectiveMin

  // Update DB
  if (dissolved) {
    const { error } = await admin.from('units').delete().eq('id', unitId).eq('game_id', gameId)
    if (error) {
      console.error(`${TAG} dissolved delete failed:`, error.message)
      return errorResponse(ERROR_CODES.INTERNAL, `delete failed: ${error.message}`, 500)
    }
  } else {
    const { error } = await admin
      .from('units')
      .update({
        q: destQ,
        r: destR,
        effective: newEffective,
        killed: unit.killed + desertion,
        has_moved: true,
        has_attacked: true,
        // last_move_path reset à null (pas de charge cav éligible après retraite)
        last_move_path: null,
      })
      .eq('id', unitId)
      .eq('game_id', gameId)
    if (error) {
      // race UNIQUE position : un autre handler vient d'occuper la case
      if (error.code === '23505') {
        return errorResponse(ERROR_CODES.RETREAT_DEST_OCCUPIED, 'destination just got occupied (race)', 400)
      }
      console.error(`${TAG} retreat update failed:`, error.message)
      return errorResponse(ERROR_CODES.INTERNAL, `update failed: ${error.message}`, 500)
    }
  }

  const result: RetreatResult = {
    unit_id: unitId,
    from: { q: unit.q, r: unit.r },
    to: { q: destQ, r: destR },
    desertion,
    dissolved,
    unit_after: dissolved ? null : {
      q: destQ,
      r: destR,
      effective: newEffective,
      killed: unit.killed + desertion,
      has_moved: true,
      has_attacked: true,
    },
  }

  const { error: actionErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: userId,
    action_type: 'retreat',
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
