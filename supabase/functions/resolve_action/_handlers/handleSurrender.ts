// v1.0 (11/05/2026) — Phase 2.5 B : reddition (capitulation) — élimination + bonus/malus moral camps
// Source : docs/PLAN-MORAL-COHESION.md § 4 (option C reddition symétrique)

import { jsonResponse, errorResponse } from '../../_shared/cors.ts'
import {
  ERROR_CODES,
  type Team,
  type SurrenderPayload,
  type SurrenderResult,
} from '../../_shared/types.ts'
import { MORALE_ROUT_THRESHOLD } from '../../_shared/engine-port/morale/index.ts'
import { computeCohesionFor, type UnitRow } from './_common.ts'

const TAG = '[handleSurrender v1.0]'

const SURRENDER_ENEMY_MORALE_BOOST = 10
const SURRENDER_ALLY_MORALE_MALUS = 10

export interface HandleSurrenderArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  units: UnitRow[]
  clientActionId: string | null
  payload: Partial<SurrenderPayload> | null
}

export async function handleSurrender(args: HandleSurrenderArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, units, clientActionId, payload } = args

  if (!payload || typeof payload.unit_id !== 'string') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id }', 400)
  }
  const unitId = payload.unit_id

  const unit = units.find(u => u.id === unitId)
  if (!unit) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `unit ${unitId} not found`, 404)
  if (unit.team !== userTeam) return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'unit belongs to another team', 403)

  // Phase 3.2-bis : surrender réservé aux routed (effectif < 20%) ou cohésion broken.
  const coh = computeCohesionFor(unitId, units)
  if (!coh) return errorResponse(ERROR_CODES.INTERNAL, 'cohesion lookup failed', 500)
  if (!unit.routed && coh.cohesion.state !== 'broken') {
    return errorResponse(ERROR_CODES.COHESION_NOT_BROKEN, 'surrender reserved for routed or broken units', 400)
  }

  // 1. DELETE l'unité qui se rend
  const { error: delErr } = await admin.from('units').delete().eq('id', unitId).eq('game_id', gameId)
  if (delErr) {
    console.error(`${TAG} delete failed:`, delErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `delete failed: ${delErr.message}`, 500)
  }

  // 2. +10 moral sur unités camp adverse, -10 sur autres unités camp qui se rend
  const enemyTeam: Team = unit.team === 'blue' ? 'red' : 'blue'
  const enemyBoosted: string[] = []
  const allyLowered: string[] = []

  for (const u of units) {
    if (u.id === unitId) continue // déjà supprimée
    if (u.team === enemyTeam) {
      const newMorale = Math.min(u.morale_max, u.morale + SURRENDER_ENEMY_MORALE_BOOST)
      if (newMorale === u.morale) continue
      const { error } = await admin
        .from('units')
        .update({ morale: newMorale, routed: newMorale < MORALE_ROUT_THRESHOLD })
        .eq('id', u.id)
        .eq('game_id', gameId)
      if (error) {
        console.warn(`${TAG} enemy boost ${u.id} failed:`, error.message)
        continue
      }
      enemyBoosted.push(u.id)
    } else if (u.team === unit.team) {
      const newMorale = Math.max(0, u.morale - SURRENDER_ALLY_MORALE_MALUS)
      if (newMorale === u.morale) continue
      const { error } = await admin
        .from('units')
        .update({ morale: newMorale, routed: newMorale < MORALE_ROUT_THRESHOLD })
        .eq('id', u.id)
        .eq('game_id', gameId)
      if (error) {
        console.warn(`${TAG} ally malus ${u.id} failed:`, error.message)
        continue
      }
      allyLowered.push(u.id)
    }
  }

  const result: SurrenderResult = {
    unit_id_deleted: unitId,
    enemy_units_morale_boosted: enemyBoosted,
    ally_units_morale_lowered: allyLowered,
  }

  const { error: actionErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: userId,
    action_type: 'surrender',
    payload: { unit_id: unitId },
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
