// v1.0 (13/05/2026) — Phase 3.2 Vague A2 : pick* actions (mirror src/engine/orders/actions.ts)
// PORT FROM src/engine/orders/actions.ts — DO NOT EDIT MANUALLY.

import { cubeKey, cubeDistance, neighbors } from '../hex/index.ts'
import type { Cube } from '../hex/index.ts'
import { hasLineOfSight } from '../los/index.ts'
import { getUnitStatsV2, resolveUnitStatsV2 } from '../units.ts'
import type { UnitState } from '../units.ts'
import type { EvaluateOrdersContext, OrderActionKind } from './types.ts'

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
  if (stats.range <= 1) return { targetUnitId: null, destHex: null }
  let best: UnitState | null = null
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (!ctx.visibleEnemyIds.has(enemy.id)) continue
    const dist = cubeDistance(unit.position, enemy.position)
    if (dist < stats.minRange || dist > stats.range) continue
    const blockers = new Set<string>()
    for (const u of ctx.allUnits) {
      if (u.id === unit.id || u.id === enemy.id) continue
      blockers.add(cubeKey(u.position))
    }
    if (!hasLineOfSight(unit.position, enemy.position, blockers)) continue
    if (!best || enemy.effective > best.effective) best = enemy
  }
  return best ? { targetUnitId: best.id, destHex: null } : { targetUnitId: null, destHex: null }
}

function pickRetreatHex(unit: UnitState, ctx: EvaluateOrdersContext): PickResult {
  const visibleEnemies: UnitState[] = []
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (ctx.visibleEnemyIds.has(enemy.id)) visibleEnemies.push(enemy)
  }
  const occupied = new Set<string>()
  for (const u of ctx.allUnits) {
    if (u.id === unit.id) continue
    occupied.add(cubeKey(u.position))
  }
  let best: { hex: Cube; score: number } | null = null
  for (const nb of neighbors(unit.position)) {
    const k = cubeKey(nb)
    if (!ctx.visibleTileKeys.has(k)) continue
    if (occupied.has(k)) continue
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
  actionKind: OrderActionKind,
  ctx: EvaluateOrdersContext,
): PickResult {
  switch (actionKind) {
    case 'charge': return pickChargeTarget(unit, ctx)
    case 'fire': return pickFireTarget(unit, ctx)
    case 'retreat': return pickRetreatHex(unit, ctx)
    case 'hold': return { targetUnitId: null, destHex: null }
    default: {
      const _exhaustive: never = actionKind
      return _exhaustive
    }
  }
}

export { pickChargeTarget, pickFireTarget, pickRetreatHex }
