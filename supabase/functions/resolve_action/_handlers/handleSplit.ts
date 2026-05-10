// v1.0 (10/05/2026) — Phase 2 2C.4 : handler split_unit (effectif elastique)
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2C.4

import { jsonResponse, errorResponse } from '../../_shared/cors.ts'
import {
  ERROR_CODES,
  type Team,
  type SplitPayload,
  type SplitResult,
} from '../../_shared/types.ts'
import { cube, cubeDistance, cubeKey } from '../../_shared/engine-port/hex/index.ts'
import { splitUnit, isSizingError } from '../../_shared/engine-port/units.ts'
import { buildUnitState, type UnitRow } from './_common.ts'

const TAG = '[handleSplit v1.0]'

export interface HandleSplitArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  boardRadius: number
  units: UnitRow[]
  clientActionId: string | null
  payload: Partial<SplitPayload> | null
}

export async function handleSplit(args: HandleSplitArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, boardRadius, units, clientActionId, payload } = args

  if (
    !payload ||
    typeof payload.unit_id !== 'string' ||
    typeof payload.target_q !== 'number' ||
    typeof payload.target_r !== 'number' ||
    typeof payload.ratio !== 'string'
  ) {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id, target_q, target_r, ratio }', 400)
  }
  const unitId = payload.unit_id
  const targetQ = payload.target_q
  const targetR = payload.target_r
  const ratio = payload.ratio
  if (ratio !== 'half' && ratio !== 'three_quarter' && ratio !== 'nine_one') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, `ratio must be half|three_quarter|nine_one, got ${ratio}`, 400)
  }

  const sourceRow = units.find(u => u.id === unitId)
  if (!sourceRow) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `unit ${unitId} not found`, 404)
  if (sourceRow.team !== userTeam) return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'unit belongs to another team', 403)
  if (sourceRow.routed) return errorResponse(ERROR_CODES.UNIT_ROUTED, 'routed units cannot split', 400)
  if (sourceRow.has_attacked) return errorResponse(ERROR_CODES.HAS_ATTACKED_ALREADY, 'cannot split after attacking', 400)

  // Validation cible : adjacent + dans le board + libre
  const targetPos = cube(targetQ, targetR)
  const sourcePos = cube(sourceRow.q, sourceRow.r)
  if (cubeDistance(targetPos, sourcePos) !== 1) {
    return errorResponse(ERROR_CODES.TARGET_NOT_ADJACENT, 'target must be adjacent', 400)
  }
  if (cubeDistance(targetPos, cube(0, 0)) > boardRadius) {
    return errorResponse(ERROR_CODES.OUT_OF_BOARD, `target beyond boardRadius=${boardRadius}`, 400)
  }
  const targetKey = cubeKey(targetPos)
  const occupied = units.some(u => cubeKey(cube(u.q, u.r)) === targetKey)
  if (occupied) {
    return errorResponse(ERROR_CODES.TARGET_OCCUPIED, 'target hex is occupied', 400)
  }

  // Engine pur split
  const source = buildUnitState(sourceRow)
  const newUnitId = crypto.randomUUID()
  const splitOutcome = splitUnit({
    source,
    ratio,
    targetPosition: targetPos,
    newUnitId,
  })

  if (isSizingError(splitOutcome)) {
    const errCode = mapSizingErrorCode(splitOutcome.code)
    return errorResponse(errCode, splitOutcome.message, 400)
  }

  const { left, right } = splitOutcome

  // UPDATE source (left = pion source mis a jour)
  const { error: updateErr } = await admin
    .from('units')
    .update({
      effective: left.effective,
      effective_max: left.effectiveMax,
      effective_min: left.effectiveMin,
      wounded: left.wounded,
      killed: left.killed,
      hp: left.hp,
      has_moved: true,
      has_attacked: true,
      last_move_path: null,
    })
    .eq('id', unitId)
    .eq('game_id', gameId)
  if (updateErr) {
    console.error(`${TAG} source update failed:`, updateErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `source update failed: ${updateErr.message}`, 500)
  }

  // INSERT right (nouveau pion)
  const { error: insertErr } = await admin.from('units').insert({
    id: right.id,
    game_id: gameId,
    team: right.team,
    kind: right.kind,
    q: right.position.q,
    r: right.position.r,
    hp: right.hp,
    hp_max: right.hpMax,
    wounded: right.wounded,
    morale: right.morale,
    morale_max: right.moraleMax,
    routed: right.routed,
    has_moved: true,
    has_attacked: true,
    effective: right.effective,
    effective_max: right.effectiveMax,
    effective_min: right.effectiveMin,
    killed: right.killed,
    sub_kind: right.subKind ?? null,
    regiment_id: right.regimentId ?? null,
    formation: right.formation ?? null,
    last_move_path: null,
  })
  if (insertErr) {
    if (insertErr.code === '23505') {
      // race UNIQUE position : qqun a place une unite ailleurs entretemps
      // rollback : restaurer source a son etat anterieur
      await admin
        .from('units')
        .update({
          effective: sourceRow.effective,
          wounded: sourceRow.wounded,
          killed: sourceRow.killed,
          hp: sourceRow.hp,
          has_moved: sourceRow.has_moved,
          has_attacked: sourceRow.has_attacked,
        })
        .eq('id', unitId)
      return errorResponse(ERROR_CODES.TARGET_OCCUPIED, 'target hex occupied (race)', 409)
    }
    console.error(`${TAG} new unit insert failed:`, insertErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `new unit insert failed: ${insertErr.message}`, 500)
  }

  const result: SplitResult = {
    source_id: unitId,
    new_unit_id: right.id,
    ratio,
    source_after: {
      effective: left.effective,
      wounded: left.wounded,
      killed: left.killed,
      hp: left.hp,
      has_moved: true,
      has_attacked: true,
    },
    new_unit: {
      id: right.id,
      q: right.position.q,
      r: right.position.r,
      effective: right.effective,
      wounded: right.wounded,
      killed: right.killed,
      hp: right.hp,
    },
  }

  const { error: actionErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: userId,
    action_type: 'split_unit',
    payload: { unit_id: unitId, target_q: targetQ, target_r: targetR, ratio },
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
    case 'target_not_adjacent': return ERROR_CODES.TARGET_NOT_ADJACENT
    case 'has_attacked_already': return ERROR_CODES.HAS_ATTACKED_ALREADY
    case 'kind_mismatch': return ERROR_CODES.KIND_MISMATCH
    case 'team_mismatch': return ERROR_CODES.TEAM_MISMATCH
    case 'units_not_adjacent': return ERROR_CODES.UNITS_NOT_ADJACENT
    case 'effective_overflow': return ERROR_CODES.EFFECTIVE_OVERFLOW
    default: return ERROR_CODES.INVALID_PAYLOAD
  }
}

