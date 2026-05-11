// v1.0 (11/05/2026) — Phase 2.6 Vague B : rupture volontaire d'engagement (coût 10% effective)
// Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 3 + § 11.3

import { jsonResponse, errorResponse } from '../../_shared/cors.ts'
import {
  ERROR_CODES,
  type Team,
  type BreakCombatPayload,
  type BreakCombatResultSnapshot,
} from '../../_shared/types.ts'
import { breakCombat } from '../../_shared/engine-port/engagement/index.ts'
import { buildUnitState, type UnitRow } from './_common.ts'

const TAG = '[handleBreakCombat v1.0]'

export interface HandleBreakCombatArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  units: UnitRow[]
  clientActionId: string | null
  payload: Partial<BreakCombatPayload> | null
}

export async function handleBreakCombat(args: HandleBreakCombatArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, units, clientActionId, payload } = args

  if (!payload || typeof payload.unit_id !== 'string') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id }', 400)
  }
  const unitId = payload.unit_id

  const unitRow = units.find(u => u.id === unitId)
  if (!unitRow) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `unit ${unitId} not found`, 404)
  if (unitRow.team !== userTeam) {
    return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'unit belongs to another team', 403)
  }

  // Vérifier que l'unité est bien dans au moins 1 engagement actif.
  const { data: engagementsData, error: fetchErr } = await admin
    .from('engagements')
    .select('id, game_id, unit_a_id, unit_b_id, started_turn')
    .eq('game_id', gameId)
    .or(`unit_a_id.eq.${unitId},unit_b_id.eq.${unitId}`)
  if (fetchErr) {
    console.error(`${TAG} engagements fetch failed:`, fetchErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `engagements fetch failed: ${fetchErr.message}`, 500)
  }

  const activeEngagements = engagementsData ?? []
  if (activeEngagements.length === 0) {
    return errorResponse(ERROR_CODES.NOT_ENGAGED, 'unit is not engaged in any combat', 400)
  }

  // Application des pertes via le helper pur breakCombat.
  // 10% effective, plancher 1, plafond effectiveMin (le pion ne dissout pas).
  const unitState = buildUnitState(unitRow)
  const result = breakCombat(unitState)

  // UPDATE BDD : effective + wounded + killed + hp + flags
  const { error: updateErr } = await admin
    .from('units')
    .update({
      effective: result.unitAfter.effective,
      wounded: result.unitAfter.wounded,
      killed: result.unitAfter.killed,
      hp: result.unitAfter.hp,
      has_moved: true,
      has_attacked: true,
    })
    .eq('id', unitId)
    .eq('game_id', gameId)
  if (updateErr) {
    console.error(`${TAG} unit update failed:`, updateErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `unit update failed: ${updateErr.message}`, 500)
  }

  // DELETE tous les engagements impliquant l'unité (rupture totale).
  // Multi-engagement supporté : 1 click = libère toutes les paires.
  const engagementIds = activeEngagements.map((e: { id: string }) => e.id)
  const { error: deleteErr } = await admin
    .from('engagements')
    .delete()
    .in('id', engagementIds)
  if (deleteErr) {
    console.error(`${TAG} engagements delete failed:`, deleteErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `engagements delete failed: ${deleteErr.message}`, 500)
  }

  const snapshot: BreakCombatResultSnapshot = {
    unit_id: unitId,
    engagements_removed: engagementIds,
    losses: {
      actualDamage: result.actualDamage,
      killed: result.killed,
      woundedAdd: result.woundedAdd,
    },
    unit_after: {
      effective: result.unitAfter.effective,
      wounded: result.unitAfter.wounded,
      killed: result.unitAfter.killed,
      hp: result.unitAfter.hp,
      has_moved: true,
      has_attacked: true,
    },
  }

  // INSERT game_actions D13 snapshot (réplay + Realtime notifications).
  const { error: actionErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: userId,
    action_type: 'break_combat',
    payload: { unit_id: unitId },
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
