// v1.0 (13/05/2026) — Phase 3.2 Vague B3 : évaluation des ordres conditionnels en début du tour entrant
// Appelé par resolve_turn entre le reset des flags (§9) et le calcul de morale (§10).
//
// MVP scope :
//  - SELECT unit_orders pour les unités de toTeam.
//  - Construire context (engagedUnitIds, visibleEnemyIds, visibleTileKeys, cohesionByUnit).
//  - evaluateOrders → OrderEvaluation par unité (ou null).
//  - Appliquer les mutations pour les actions exécutables :
//      * 'hold'    → no-op (just consigne dans game_actions).
//      * 'retreat' → UPDATE units.position + has_moved=true + DELETE engagements de cette unité.
//      * 'charge'  → UPDATE units.position + has_moved=true + has_attacked=true + INSERT engagement
//                    (paire unit_id triée pour invariant unit_a_id < unit_b_id). Pas de damage.
//      * 'fire'    → UPDATE units.has_attacked=true. Pas de damage (Phase 3.3).
//  - Pour chaque évaluation (skipped ou exécutée), INSERT game_actions(action_type='order_triggered').
//
// Phase 3.3 ajoutera l'application des combats (charge/fire calculés via _handlers existants).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import {
  cube,
  cubeKey,
  spiral,
  type Cube,
} from '../_shared/engine-port/hex/index.ts'
import {
  computeCohesion,
  computeSupport,
  type CohesionState,
} from '../_shared/engine-port/cohesion/index.ts'
import {
  visibleEnemiesFromTeam,
  visibleHexesFromTeam,
} from '../_shared/engine-port/vision/index.ts'
import { evaluateOrders } from '../_shared/engine-port/orders/index.ts'
import type {
  EvaluateOrdersContext,
  OrderEvaluation,
  Posture,
} from '../_shared/engine-port/orders/index.ts'
import type { UnitState } from '../_shared/engine-port/units.ts'
import type { OrderActionDTO, OrderTriggerDTO, Team } from '../_shared/types.ts'

interface EngagementRow {
  id: string
  unit_a_id: string
  unit_b_id: string
}

interface UnitOrderRow {
  id: string
  unit_id: string
  owner_user_id: string
  priority: number
  trigger: OrderTriggerDTO
  action: OrderActionDTO
  active: boolean
}

export interface OrderTriggeredEvent {
  unit_id: string
  posture_id: string
  resolved_action: 'charge' | 'fire' | 'retreat' | 'hold'
  target_unit_id: string | null
  dest_q: number | null
  dest_r: number | null
  skipped: string | null
}

export interface EvaluateOrdersResult {
  events: OrderTriggeredEvent[]
}

interface EvaluateOrdersParams {
  admin: SupabaseClient
  gameId: string
  toTeam: Team
  /** Snapshot des unités après tick d'engagement (= état affiché au joueur entrant). */
  units: ReadonlyArray<UnitState>
  /** Engagements actifs APRÈS dissolution post-tick. */
  engagements: ReadonlyArray<EngagementRow>
  boardRadius: number
  /** Tour courant (= turnAfter dans resolve_turn). Servira au INSERT engagement.started_turn. */
  currentTurn: number
  /** user_id qui a déclenché end_turn (pour actor_user_id des game_actions). */
  actorUserId: string
}

/**
 * Évalue tous les ordres des unités de toTeam et applique leurs effets.
 * Retourne la liste des events pour la réponse EndTurnResult (UI Vague C4).
 *
 * Erreurs Supabase : loggées console.warn, pas de throw (cohérent avec les
 * autres blocs de resolve_turn qui tolèrent les échecs partiels).
 */
export async function evaluateAndApplyOrders(p: EvaluateOrdersParams): Promise<EvaluateOrdersResult> {
  const { admin, gameId, toTeam, units, engagements, boardRadius, currentTurn, actorUserId } = p
  const events: OrderTriggeredEvent[] = []

  const toTeamUnitIds = units.filter(u => u.team === toTeam).map(u => u.id)
  if (toTeamUnitIds.length === 0) return { events }

  // 1. Charger les ordres actifs de toTeam.
  const { data: ordersRaw, error: ordersErr } = await admin
    .from('unit_orders')
    .select('id, unit_id, owner_user_id, priority, trigger, action, active')
    .eq('game_id', gameId)
    .eq('active', true)
    .in('unit_id', toTeamUnitIds)
  if (ordersErr) {
    console.warn('[evaluateAndApplyOrders] unit_orders fetch failed:', ordersErr.message)
    return { events }
  }
  const orderRows = (ordersRaw ?? []) as UnitOrderRow[]
  if (orderRows.length === 0) return { events }

  // Group postures by unit.
  const posturesByUnit = new Map<string, Posture[]>()
  for (const r of orderRows) {
    const p: Posture = {
      id: r.id,
      unitId: r.unit_id,
      priority: r.priority,
      trigger: r.trigger,
      action: r.action,
      active: r.active,
    }
    const list = posturesByUnit.get(r.unit_id) ?? []
    list.push(p)
    posturesByUnit.set(r.unit_id, list)
  }

  // 2. Construire le contexte une fois par team (visibilité, cohésion, engagements).
  const boardKeys = new Set(spiral(cube(0, 0), boardRadius).map(cubeKey))
  const engagedUnitIds = new Set<string>()
  for (const e of engagements) {
    engagedUnitIds.add(e.unit_a_id)
    engagedUnitIds.add(e.unit_b_id)
  }
  const visibleEnemiesMap = visibleEnemiesFromTeam(toTeam, units, boardKeys)
  const visibleEnemyIds = new Set<string>(visibleEnemiesMap.keys())
  const visibleTileKeys = visibleHexesFromTeam(toTeam, units, boardKeys)

  const cohesionByUnit = new Map<string, CohesionState>()
  for (const u of units) {
    const support = computeSupport(u, units)
    const c = computeCohesion(u, support)
    cohesionByUnit.set(u.id, c.state)
  }
  const ctx: EvaluateOrdersContext = {
    allUnits: units,
    engagedUnitIds,
    visibleEnemyIds,
    visibleTileKeys,
    cohesionByUnit,
  }

  // 3. Évaluer chaque unité de toTeam (id ASC pour déterminisme).
  const toTeamUnits = [...units].filter(u => u.team === toTeam).sort((a, b) => a.id.localeCompare(b.id))
  // Cache des positions courantes (mutées au fur et à mesure pour cohérence séquentielle).
  const positionCache = new Map<string, Cube>()
  for (const u of units) positionCache.set(u.id, u.position)

  for (const u of toTeamUnits) {
    const postures = posturesByUnit.get(u.id)
    if (!postures || postures.length === 0) continue
    const evaluation = evaluateOrders(u, postures, ctx)
    if (!evaluation) continue
    await applyOrderEvaluation({
      admin,
      gameId,
      unit: u,
      evaluation,
      currentTurn,
      actorUserId,
      positionCache,
      events,
    })
  }

  return { events }
}

interface ApplyParams {
  admin: SupabaseClient
  gameId: string
  unit: UnitState
  evaluation: OrderEvaluation
  currentTurn: number
  actorUserId: string
  positionCache: Map<string, Cube>
  events: OrderTriggeredEvent[]
}

/** Applique les mutations BDD pour une évaluation d'ordre + log game_actions. */
async function applyOrderEvaluation(p: ApplyParams): Promise<void> {
  const { admin, gameId, unit, evaluation, currentTurn, actorUserId, positionCache, events } = p
  const event: OrderTriggeredEvent = {
    unit_id: unit.id,
    posture_id: evaluation.posture.id,
    resolved_action: evaluation.resolvedAction,
    target_unit_id: evaluation.targetUnitId ?? null,
    dest_q: evaluation.destHex?.q ?? null,
    dest_r: evaluation.destHex?.r ?? null,
    skipped: evaluation.skipped ?? null,
  }
  events.push(event)

  // Skipped → pas de mutation, juste log.
  if (evaluation.skipped) {
    await insertOrderTriggeredLog(admin, gameId, actorUserId, currentTurn, event)
    return
  }

  // Apply mutations selon kind.
  switch (evaluation.resolvedAction) {
    case 'hold': {
      // No-op. Juste log.
      break
    }
    case 'retreat': {
      if (!evaluation.destHex) break
      const { error } = await admin
        .from('units')
        .update({ q: evaluation.destHex.q, r: evaluation.destHex.r, has_moved: true })
        .eq('id', unit.id)
        .eq('game_id', gameId)
      if (error) {
        console.warn('[applyOrderEvaluation] retreat update failed:', error.message)
        break
      }
      positionCache.set(unit.id, evaluation.destHex)
      // DELETE engagements de cette unité (rompre tous les contacts en se repliant).
      await admin
        .from('engagements')
        .delete()
        .or(`unit_a_id.eq.${unit.id},unit_b_id.eq.${unit.id}`)
        .eq('game_id', gameId)
      break
    }
    case 'charge': {
      // Mouvement vers destHex puis flag has_attacked. Pas de damage (Phase 3.3).
      if (evaluation.destHex) {
        const { error: posErr } = await admin
          .from('units')
          .update({ q: evaluation.destHex.q, r: evaluation.destHex.r, has_moved: true, has_attacked: true })
          .eq('id', unit.id)
          .eq('game_id', gameId)
        if (posErr) {
          console.warn('[applyOrderEvaluation] charge update failed:', posErr.message)
          break
        }
        positionCache.set(unit.id, evaluation.destHex)
      } else {
        // Pas de move (déjà adjacent) → juste flag attack.
        const { error: flagErr } = await admin
          .from('units')
          .update({ has_attacked: true })
          .eq('id', unit.id)
          .eq('game_id', gameId)
        if (flagErr) console.warn('[applyOrderEvaluation] charge flag failed:', flagErr.message)
      }
      // INSERT engagement avec la cible (Phase 2.6 : invariant unit_a_id < unit_b_id).
      if (evaluation.targetUnitId) {
        const [a, b] = [unit.id, evaluation.targetUnitId].sort()
        const { error: engErr } = await admin
          .from('engagements')
          .insert({ game_id: gameId, unit_a_id: a, unit_b_id: b, started_turn: currentTurn })
        if (engErr && !engErr.message.includes('duplicate')) {
          console.warn('[applyOrderEvaluation] charge engagement insert failed:', engErr.message)
        }
      }
      break
    }
    case 'fire': {
      // Phase 3.3 : applique damage. MVP B3 : flag only.
      const { error } = await admin
        .from('units')
        .update({ has_attacked: true })
        .eq('id', unit.id)
        .eq('game_id', gameId)
      if (error) console.warn('[applyOrderEvaluation] fire flag failed:', error.message)
      break
    }
  }

  await insertOrderTriggeredLog(admin, gameId, actorUserId, currentTurn, event)
}

async function insertOrderTriggeredLog(
  admin: SupabaseClient,
  gameId: string,
  actorUserId: string,
  turn: number,
  event: OrderTriggeredEvent,
): Promise<void> {
  const { error } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn,
    actor_user_id: actorUserId,
    action_type: 'order_triggered',
    payload: { posture_id: event.posture_id, unit_id: event.unit_id },
    result: event,
    seed: Date.now(),
  })
  if (error) {
    console.warn('[insertOrderTriggeredLog] insert failed:', error.message)
  }
}
