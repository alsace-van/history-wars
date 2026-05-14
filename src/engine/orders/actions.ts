// v1.3 (14/05/2026) — Phase 3.3 Lot C : pickRetreatHex accepte destHex utilisateur (cap movement)
// v1.2 (14/05/2026) — Phase 3.3 : pickFireTarget skip LoS si arcedTrajectory (obusier)
// v1.1 (13/05/2026) — Phase 3.3 : pickFireTarget accepte unités mêlée (range=1) — mode alerte
// v1.0 (13/05/2026) — Phase 3.2 Vague A : résolution cible/destination par action d'ordre
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.

import { cubeKey, cubeDistance, neighbors, type Cube } from '../hex'
import { hasLineOfSight } from '../los'
import { getUnitStatsV2, resolveUnitStatsV2, type UnitState } from '../units'
import type { EvaluateOrdersContext, OrderAction } from './types'

interface PickResult {
  readonly targetUnitId?: string | null
  readonly destHex?: Cube | null
}

/**
 * `charge` : choisir l'ennemi visible le plus menaçant à portée mouvement.
 * Heuristique : ennemi le plus proche (distance min). Si égalité, plus grand
 * `effective` (cible la plus dangereuse). La destination est un hex adjacent à
 * cet ennemi, choisi parmi les voisins libres et accessibles.
 *
 * Retourne `null/null` si aucune cible n'est joignable.
 */
function pickChargeTarget(unit: UnitState, ctx: EvaluateOrdersContext): PickResult {
  const stats = getUnitStatsV2(unit.kind)
  const reach = stats.movement
  let best: { enemy: UnitState; dist: number } | null = null

  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (!ctx.visibleEnemyIds.has(enemy.id)) continue
    const dist = cubeDistance(unit.position, enemy.position)
    if (dist > reach + 1) continue
    if (!best || dist < best.dist || (dist === best.dist && enemy.effective > best.enemy.effective)) {
      best = { enemy, dist }
    }
  }
  if (!best) return { targetUnitId: null, destHex: null }

  if (best.dist === 1) {
    return { targetUnitId: best.enemy.id, destHex: unit.position }
  }
  const occupied = new Set<string>()
  for (const u of ctx.allUnits) {
    if (u.id === unit.id) continue
    occupied.add(cubeKey(u.position))
  }
  let bestNeighbor: { hex: Cube; dist: number } | null = null
  for (const nb of neighbors(best.enemy.position)) {
    const k = cubeKey(nb)
    if (!ctx.visibleTileKeys.has(k)) continue
    if (occupied.has(k)) continue
    const d = cubeDistance(unit.position, nb)
    if (d > reach) continue
    if (!bestNeighbor || d < bestNeighbor.dist) bestNeighbor = { hex: nb, dist: d }
  }
  if (!bestNeighbor) return { targetUnitId: null, destHex: null }
  return { targetUnitId: best.enemy.id, destHex: bestNeighbor.hex }
}

/**
 * `fire` : choisir l'ennemi visible avec LoS dégagée + distance ∈ [minRange, range].
 * Heuristique : ennemi avec effective le plus haut (cible prioritaire = la plus dense).
 *
 * Pas de mouvement induit (l'action `fire` est immobile).
 *
 * Phase 3.3 — accepte les unités de mêlée (stats.range=1) pour matérialiser un mode
 * "alerte" : l'unité reste sur place et frappe l'ennemi qui entre adjacent. La phase
 * de combat (ranged vs melee) est ensuite auto-détectée par resolveCombat selon la
 * distance. Coût d'alerte appliqué côté serveur (−1 morale par déclenchement).
 */
function pickFireTarget(unit: UnitState, ctx: EvaluateOrdersContext): PickResult {
  const stats = resolveUnitStatsV2(unit.kind, unit.subKind)
  let best: UnitState | null = null
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (!ctx.visibleEnemyIds.has(enemy.id)) continue
    const dist = cubeDistance(unit.position, enemy.position)
    if (dist < stats.minRange || dist > stats.range) continue
    // LoS : trivial à distance 1 ; tir en cloche (obusier) ignore les unités blockers.
    // Sinon check explicite. Le terrain LoS (Phase 5+) restera bloquant dans tous les cas.
    if (dist > 1 && !stats.arcedTrajectory) {
      const blockers = new Set<string>()
      for (const u of ctx.allUnits) {
        if (u.id === unit.id || u.id === enemy.id) continue
        blockers.add(cubeKey(u.position))
      }
      if (!hasLineOfSight(unit.position, enemy.position, blockers)) continue
    }
    if (!best || enemy.effective > best.effective) best = enemy
  }
  return best ? { targetUnitId: best.id, destHex: null } : { targetUnitId: null, destHex: null }
}

function parseDestHexParam(params: OrderAction['params']): Cube | null {
  if (!params || typeof params !== 'object') return null
  const raw = (params as { destHex?: unknown }).destHex
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as { q?: unknown; r?: unknown; s?: unknown }
  if (typeof obj.q !== 'number' || typeof obj.r !== 'number' || typeof obj.s !== 'number') return null
  if (obj.q + obj.r + obj.s !== 0) return null
  return { q: obj.q, r: obj.r, s: obj.s }
}

/**
 * `retreat` : choisir l'hex voisin libre (rayon 1, type `retreat` Phase 2.5 C)
 * qui MAXIMISE la distance minimale aux ennemis visibles. Si plusieurs ennemis
 * adjacents, on s'éloigne du barycentre. Pas d'hex hors `visibleTileKeys`.
 *
 * Retourne `null` si aucun voisin libre (encerclement total).
 *
 * Phase 3.3 Lot C — si `params.destHex` est fourni (cliqué par l'utilisateur à la
 * création de l'ordre), on tente de l'honorer :
 *  - destHex à 1 hex (voisin direct), libre et visible → on y va directement.
 *  - destHex plus loin (≤ movement) → step vers le voisin de unit.position qui
 *    minimise cubeDistance(neighbor, destHex).
 *  - destHex invalide / hors movement / occupé → fallback auto (heuristique distance ennemis).
 */
function pickRetreatHex(
  unit: UnitState,
  ctx: EvaluateOrdersContext,
  action?: OrderAction,
): PickResult {
  const userDest = action ? parseDestHexParam(action.params) : null
  const stats = getUnitStatsV2(unit.kind)
  const occupied = new Set<string>()
  for (const u of ctx.allUnits) {
    if (u.id === unit.id) continue
    occupied.add(cubeKey(u.position))
  }
  const isReachableHex = (hex: Cube): boolean => {
    const k = cubeKey(hex)
    return ctx.visibleTileKeys.has(k) && !occupied.has(k)
  }

  if (userDest) {
    const distToDest = cubeDistance(unit.position, userDest)
    if (distToDest === 0) {
      // Cas absurde (user a cliqué sur sa propre case) → fallback auto.
    } else if (distToDest <= stats.movement && isReachableHex(userDest)) {
      // Hex final atteignable directement.
      return { targetUnitId: null, destHex: userDest }
    } else if (distToDest > stats.movement) {
      // Trop loin : pick le voisin de unit.position qui rapproche le plus de userDest.
      let bestStep: { hex: Cube; dist: number } | null = null
      for (const nb of neighbors(unit.position)) {
        if (!isReachableHex(nb)) continue
        const d = cubeDistance(nb, userDest)
        if (!bestStep || d < bestStep.dist) bestStep = { hex: nb, dist: d }
      }
      if (bestStep) return { targetUnitId: null, destHex: bestStep.hex }
    }
    // Sinon : destHex occupé ou hors visible → fallback auto ci-dessous.
  }

  const visibleEnemies: UnitState[] = []
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (ctx.visibleEnemyIds.has(enemy.id)) visibleEnemies.push(enemy)
  }
  let best: { hex: Cube; score: number } | null = null
  for (const nb of neighbors(unit.position)) {
    if (!isReachableHex(nb)) continue
    let minDist = Number.POSITIVE_INFINITY
    for (const enemy of visibleEnemies) {
      const d = cubeDistance(nb, enemy.position)
      if (d < minDist) minDist = d
    }
    const score = visibleEnemies.length === 0 ? 1 : minDist
    if (!best || score > best.score) best = { hex: nb, score }
  }
  return best ? { targetUnitId: null, destHex: best.hex } : { targetUnitId: null, destHex: null }
}

/** Dispatcher : retourne cible/destination pour une action donnée.
 *  Phase 3.3 Lot C — action complet passé pour propager params.destHex (retreat dirigé). */
export function resolveActionTarget(
  unit: UnitState,
  action: OrderAction,
  ctx: EvaluateOrdersContext,
): PickResult {
  switch (action.kind) {
    case 'charge': return pickChargeTarget(unit, ctx)
    case 'fire': return pickFireTarget(unit, ctx)
    case 'retreat': return pickRetreatHex(unit, ctx, action)
    case 'hold': return { targetUnitId: null, destHex: null }
    default: {
      const _exhaustive: never = action.kind
      return _exhaustive
    }
  }
}

// Exports nommés pour tests unitaires fins (ciblage par action).
export { pickChargeTarget, pickFireTarget, pickRetreatHex }
