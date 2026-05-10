// v1.0 (10/05/2026) — Phase 2 2C.5 : handler merge_unit (effectif elastique)
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2C.5

import { jsonResponse, errorResponse } from '../../_shared/cors.ts'
import {
  ERROR_CODES,
  type Team,
  type MergePayload,
  type MergeResult,
} from '../../_shared/types.ts'
import { mergeUnits, isSizingError } from '../../_shared/engine-port/units.ts'
import { buildUnitState, type UnitRow } from './_common.ts'

const TAG = '[handleMerge v1.0]'

export interface HandleMergeArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  units: UnitRow[]
  clientActionId: string | null
  payload: Partial<MergePayload> | null
}

export async function handleMerge(args: HandleMergeArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, units, clientActionId, payload } = args

  if (!payload || typeof payload.target_unit_id !== 'string' || typeof payload.source_unit_id !== 'string') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { target_unit_id, source_unit_id }', 400)
  }
  const targetId = payload.target_unit_id
  const sourceId = payload.source_unit_id

  if (targetId === sourceId) {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'cannot merge a unit with itself', 400)
  }

  const targetRow = units.find(u => u.id === targetId)
  if (!targetRow) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `target ${targetId} not found`, 404)
  const sourceRow = units.find(u => u.id === sourceId)
  if (!sourceRow) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `source ${sourceId} not found`, 404)

  if (targetRow.team !== userTeam || sourceRow.team !== userTeam) {
    return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'both units must belong to active team', 403)
  }
  if (targetRow.routed || sourceRow.routed) {
    return errorResponse(ERROR_CODES.UNIT_ROUTED, 'routed units cannot merge', 400)
  }

  const target = buildUnitState(targetRow)
  const source = buildUnitState(sourceRow)
  const mergeOutcome = mergeUnits({ target, source })

  if (isSizingError(mergeOutcome)) {
    const errCode = mapSizingErrorCode(mergeOutcome.code)
    return errorResponse(errCode, mergeOutcome.message, 400)
  }

  const merged = mergeOutcome

  // UPDATE target avec les nouvelles stats fusionnees
  const { error: updateErr } = await admin
    .from('units')
    .update({
      effective: merged.effective,
      effective_max: merged.effectiveMax,
      effective_min: merged.effectiveMin,
      wounded: merged.wounded,
      killed: merged.killed,
      hp: merged.hp,
      hp_max: merged.hpMax,
      morale: merged.morale,
      routed: merged.routed,
      has_moved: true,
      has_attacked: true,
      last_move_path: null,
    })
    .eq('id', targetId)
    .eq('game_id', gameId)
  if (updateErr) {
    console.error(`${TAG} target update failed:`, updateErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `target update failed: ${updateErr.message}`, 500)
  }

  // DELETE source (le pion absorbe disparait)
  const { error: deleteErr } = await admin
    .from('units')
    .delete()
    .eq('id', sourceId)
    .eq('game_id', gameId)
  if (deleteErr) {
    console.error(`${TAG} source delete failed:`, deleteErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `source delete failed: ${deleteErr.message}`, 500)
  }

  const result: MergeResult = {
    target_id: targetId,
    source_id_deleted: sourceId,
    target_after: {
      effective: merged.effective,
      effectiveMax: merged.effectiveMax,
      effectiveMin: merged.effectiveMin,
      wounded: merged.wounded,
      killed: merged.killed,
      hp: merged.hp,
      hpMax: merged.hpMax,
      morale: merged.morale,
      routed: merged.routed,
      has_moved: true,
      has_attacked: true,
    },
  }

  const { error: actionErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: userId,
    action_type: 'merge_unit',
    payload: { target_unit_id: targetId, source_unit_id: sourceId },
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

function mapSizingErrorCode(code: string): string {
  switch (code) {
    case 'effective_too_low': return ERROR_CODES.EFFECTIVE_TOO_LOW
    case 'has_attacked_already': return ERROR_CODES.HAS_ATTACKED_ALREADY
    case 'kind_mismatch': return ERROR_CODES.KIND_MISMATCH
    case 'team_mismatch': return ERROR_CODES.TEAM_MISMATCH
    case 'units_not_adjacent': return ERROR_CODES.UNITS_NOT_ADJACENT
    case 'effective_overflow': return ERROR_CODES.EFFECTIVE_OVERFLOW
    default: return ERROR_CODES.INVALID_PAYLOAD
  }
}
