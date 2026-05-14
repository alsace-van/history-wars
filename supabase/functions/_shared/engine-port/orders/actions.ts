// v1.3 (14/05/2026) — Phase 3.3 Lot C : pickRetreatHex honore destHex utilisateur (cap movement)
// v1.2 (14/05/2026) — Phase 3.3 : pickFireTarget skip LoS si arcedTrajectory (obusier)
// v1.1 (13/05/2026) — Phase 3.3 : pickFireTarget accepte unités mêlée (range=1) — mode alerte
// v1.0 (13/05/2026) — Phase 3.2 Vague A2 : pick* actions (mirror src/engine/orders/actions.ts)
// PORT FROM src/engine/orders/actions.ts — DO NOT EDIT MANUALLY.

import { cubeKey, cubeDistance, neighbors } from '../hex/index.ts'
import type { Cube } from '../hex/index.ts'
import { hasLineOfSight } from '../los/index.ts'
import { getUnitStatsV2, resolveUnitStatsV2 } from '../units.ts'
import type { UnitState } from '../units.ts'
import type { EvaluateOrdersContext, OrderAction } from './types.ts'

interface PickResult {
  readonly targetUnitId?: string | null
  readonly destHex?: Cube | null
}

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

function pickFireTarget(unit: UnitState, ctx: EvaluateOrdersContext): PickResult {
  const stats = resolveUnitStatsV2(unit.kind, unit.subKind)
  let best: UnitState | null = null
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (!ctx.visibleEnemyIds.has(enemy.id)) continue
    const dist = cubeDistance(unit.position, enemy.position)
    if (dist < stats.minRange || dist > stats.range) continue
    // Phase 3.3 mirror : obusier (arcedTrajectory) skip LoS unités. Sinon check explicite.
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
      // Fallback auto.
    } else if (distToDest <= stats.movement && isReachableHex(userDest)) {
      return { targetUnitId: null, destHex: userDest }
    } else if (distToDest > stats.movement) {
      let bestStep: { hex: Cube; dist: number } | null = null
      for (const nb of neighbors(unit.position)) {
        if (!isReachableHex(nb)) continue
        const d = cubeDistance(nb, userDest)
        if (!bestStep || d < bestStep.dist) bestStep = { hex: nb, dist: d }
      }
      if (bestStep) return { targetUnitId: null, destHex: bestStep.hex }
    }
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

export { pickChargeTarget, pickFireTarget, pickRetreatHex }
