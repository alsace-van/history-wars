// v1.0 (16/05/2026) — Phase 2.6 : menu post-charge cavalerie → option "Rester en mêlée"
// Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 4 (rester en mêlée après charge)
//
// Conditions de validation :
//   - unit_id appartient au joueur courant
//   - unit.pending_post_charge_target_id non-null (état attendu post-charge)
//   - le défenseur cible existe toujours (sinon -> retreat auto-failsafe)
//
// Effets :
//   - INSERT engagement avec from_charge=true (active malus défense ×0.8 +
//     attrition ×1.3 côté cavalerie dans engine/engagement/tick.ts)
//   - UPDATE units.pending_post_charge_target_id = NULL
//   - INSERT game_actions row 'charge_stay' (replay + Realtime)
//
// Idempotent via client_action_id. Non-fatal : si l'engagement existe déjà
// (e.g. double-click), on retombe sur la row existante via UNIQUE constraint.

import { jsonResponse, errorResponse } from '../../_shared/cors.ts'
import {
  ERROR_CODES,
  type Team,
  type ChargeStayPayload,
  type ChargeStayResultSnapshot,
} from '../../_shared/types.ts'
import { normalizePair } from '../../_shared/engine-port/engagement/index.ts'
import type { UnitRow } from './_common.ts'

const TAG = '[handleChargeStay v1.0]'

export interface HandleChargeStayArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  units: UnitRow[]
  clientActionId: string | null
  payload: Partial<ChargeStayPayload> | null
}

export async function handleChargeStay(args: HandleChargeStayArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, units, clientActionId, payload } = args

  if (!payload || typeof payload.unit_id !== 'string') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id }', 400)
  }
  const unitId = payload.unit_id

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

  // Le défenseur peut avoir été tué/dissous entre le moment du pending et le
  // choix (e.g. via order_triggered d'un allié). Si manquant → clear pending +
  // OK silencieux (l'engagement ne peut pas exister).
  const defenderRow = units.find(u => u.id === defenderId)
  if (!defenderRow) {
    await admin
      .from('units')
      .update({ pending_post_charge_target_id: null })
      .eq('id', unitId)
    console.warn(`${TAG} defender vanished, cleared pending without engagement`)
    return jsonResponse({ ok: true, result: { unit_id: unitId, engagement: null } })
  }

  // INSERT engagement avec from_charge=true. Idempotent via UNIQUE
  // (game_id, unit_a_id, unit_b_id) — cf. handleEngage.ts pattern.
  const { unitAId, unitBId } = normalizePair(unitId, defenderId)
  const { data: insertData, error: insertErr } = await admin
    .from('engagements')
    .insert({
      game_id: gameId,
      unit_a_id: unitAId,
      unit_b_id: unitBId,
      started_turn: currentTurn,
      from_charge: true,
    })
    .select('id, game_id, unit_a_id, unit_b_id, started_turn, from_charge')
    .maybeSingle()

  let engagement = insertData
  if (insertErr) {
    if (insertErr.code === '23505') {
      // Engagement déjà existant — récupère et patche from_charge à true
      // (cas marginal : retraite annulée puis re-charge).
      const { data: existing, error: selectErr } = await admin
        .from('engagements')
        .select('id, game_id, unit_a_id, unit_b_id, started_turn, from_charge')
        .eq('game_id', gameId)
        .eq('unit_a_id', unitAId)
        .eq('unit_b_id', unitBId)
        .maybeSingle()
      if (selectErr || !existing) {
        console.error(`${TAG} engagement duplicate but fetch failed:`, selectErr?.message)
        return errorResponse(ERROR_CODES.INTERNAL, 'engagement fetch failed', 500)
      }
      if (!existing.from_charge) {
        await admin.from('engagements').update({ from_charge: true }).eq('id', existing.id)
      }
      engagement = { ...existing, from_charge: true }
    } else {
      console.error(`${TAG} engagement insert failed:`, insertErr.message)
      return errorResponse(ERROR_CODES.INTERNAL, `engagement insert failed: ${insertErr.message}`, 500)
    }
  }

  // Clear pending_post_charge_target_id.
  const { error: clearErr } = await admin
    .from('units')
    .update({ pending_post_charge_target_id: null })
    .eq('id', unitId)
    .eq('game_id', gameId)
  if (clearErr) {
    console.warn(`${TAG} clear pending failed (non-fatal):`, clearErr.message)
  }

  const snapshot: ChargeStayResultSnapshot = {
    unit_id: unitId,
    engagement: engagement!,
  }

  // INSERT game_actions snapshot (replay + Realtime notifications).
  const { error: actionErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: userId,
    action_type: 'charge_stay',
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
