// v1.0 (13/05/2026) — Phase 3.2 Vague A2 : evaluateOrders (mirror src/engine/orders/evaluate.ts)
// PORT FROM src/engine/orders/evaluate.ts — DO NOT EDIT MANUALLY.

import type { UnitState } from '../units.ts'
import { resolveActionTarget } from './actions.ts'
import { evaluateTrigger } from './triggers.ts'
import type {
  EvaluateOrdersContext,
  OrderActionKind,
  OrderEvaluation,
  OrderSkipReason,
  Posture,
} from './types.ts'

const OFFENSIVE_ACTIONS: ReadonlySet<OrderActionKind> = new Set(['charge', 'fire'])

function checkExecutability(
  unit: UnitState,
  kind: OrderActionKind,
  isBroken: boolean,
): OrderSkipReason | null {
  if (unit.routed) return 'routed'
  if (isBroken && OFFENSIVE_ACTIONS.has(kind)) return 'broken'
  if ((kind === 'charge' || kind === 'retreat') && unit.hasMoved) return 'has_moved'
  if ((kind === 'charge' || kind === 'fire') && unit.hasAttacked) return 'has_attacked'
  return null
}

export function evaluateOrders(
  unit: UnitState,
  postures: ReadonlyArray<Posture>,
  ctx: EvaluateOrdersContext,
): OrderEvaluation | null {
  if (unit.routed) return null
  const isBroken = ctx.cohesionByUnit.get(unit.id) === 'broken'

  const sorted = [...postures]
    .filter(p => p.active && p.unitId === unit.id)
    .sort((a, b) => (a.priority - b.priority) || a.id.localeCompare(b.id))

  let firstSkipped: OrderEvaluation | null = null
  for (const posture of sorted) {
    if (!evaluateTrigger(unit, posture.trigger, ctx)) continue

    const executability = checkExecutability(unit, posture.action.kind, isBroken)
    if (executability) {
      const skipEval: OrderEvaluation = {
        posture,
        resolvedAction: posture.action.kind,
        targetUnitId: null,
        destHex: null,
        skipped: executability,
      }
      if (!firstSkipped) firstSkipped = skipEval
      continue
    }

    const target = resolveActionTarget(unit, posture.action.kind, ctx)
    if (!target.targetUnitId && !target.destHex && posture.action.kind !== 'hold') {
      const skipEval: OrderEvaluation = {
        posture,
        resolvedAction: posture.action.kind,
        targetUnitId: null,
        destHex: null,
        skipped: 'no_target',
      }
      if (!firstSkipped) firstSkipped = skipEval
      continue
    }
    return {
      posture,
      resolvedAction: posture.action.kind,
      targetUnitId: target.targetUnitId ?? null,
      destHex: target.destHex ?? null,
    }
  }
  return firstSkipped
}
