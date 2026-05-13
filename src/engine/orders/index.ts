// v1.0 (13/05/2026) — Phase 3.2 Vague A : barrel engine/orders
export type {
  EvaluateOrdersContext,
  OrderAction,
  OrderActionKind,
  OrderEvaluation,
  OrderSkipReason,
  OrderTrigger,
  OrderTriggerKind,
  Posture,
} from './types'
export { MAX_ORDERS_PER_UNIT } from './types'
export { evaluateOrders } from './evaluate'
export { evaluateTrigger, isCohesionBroken, isEnemyInRange, isEnemyLos, isOnAttacked } from './triggers'
export { pickChargeTarget, pickFireTarget, pickRetreatHex, resolveActionTarget } from './actions'
