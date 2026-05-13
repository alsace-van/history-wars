// v1.0 (13/05/2026) — Phase 3.2 Vague A2 : prédicats triggers (mirror src/engine/orders/triggers.ts)
// PORT FROM src/engine/orders/triggers.ts — DO NOT EDIT MANUALLY.

import { cubeDistance } from '../hex/index.ts'
import type { UnitState } from '../units.ts'
import type { EvaluateOrdersContext, OrderTrigger } from './types.ts'

export function isOnAttacked(unit: UnitState, ctx: EvaluateOrdersContext): boolean {
  return ctx.engagedUnitIds.has(unit.id)
}

export function isEnemyInRange(
  unit: UnitState,
  trigger: OrderTrigger,
  ctx: EvaluateOrdersContext,
): boolean {
  const range = trigger.params?.range ?? 1
  if (range <= 0) return false
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (!ctx.visibleEnemyIds.has(enemy.id)) continue
    if (cubeDistance(unit.position, enemy.position) <= range) return true
  }
  return false
}

export function isCohesionBroken(unit: UnitState, ctx: EvaluateOrdersContext): boolean {
  return ctx.cohesionByUnit.get(unit.id) === 'broken'
}

export function isEnemyLos(unit: UnitState, ctx: EvaluateOrdersContext): boolean {
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (ctx.visibleEnemyIds.has(enemy.id)) return true
  }
  return false
}

export function evaluateTrigger(
  unit: UnitState,
  trigger: OrderTrigger,
  ctx: EvaluateOrdersContext,
): boolean {
  switch (trigger.kind) {
    case 'on_attacked': return isOnAttacked(unit, ctx)
    case 'enemy_in_range': return isEnemyInRange(unit, trigger, ctx)
    case 'cohesion_broken': return isCohesionBroken(unit, ctx)
    case 'enemy_los': return isEnemyLos(unit, ctx)
    default: {
      const _exhaustive: never = trigger.kind
      return _exhaustive
    }
  }
}
