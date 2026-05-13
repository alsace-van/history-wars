// v1.0 (13/05/2026) — Phase 3.2 Vague A2 : barrel engine-port orders Deno
// Source de verite : src/engine/orders/index.ts. Duplication controlee (piege #12).

export type {
  EvaluateOrdersContext,
  OrderAction,
  OrderActionKind,
  OrderEvaluation,
  OrderSkipReason,
  OrderTrigger,
  OrderTriggerKind,
  Posture,
} from './types.ts'
export { MAX_ORDERS_PER_UNIT } from './types.ts'
export { evaluateOrders } from './evaluate.ts'
export { evaluateTrigger, isCohesionBroken, isEnemyInRange, isEnemyLos, isOnAttacked } from './triggers.ts'
export { pickChargeTarget, pickFireTarget, pickRetreatHex, resolveActionTarget } from './actions.ts'
