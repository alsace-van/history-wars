// v1.0 (11/05/2026) — Phase 2.5 : barrel engine/cohesion
export {
  COHESION_STATE_THRESHOLDS,
  DEFAULT_COHESION_WEIGHTS,
  EFFECTIVE_REFORM_THRESHOLD_RATIO,
  SUPPORT_PLAFOND,
  SUPPORT_RADIUS_ADJACENT,
  SUPPORT_RADIUS_NEARBY,
} from './types'
export type {
  CohesionScore,
  CohesionState,
  CohesionWeights,
  SupportCount,
} from './types'
export {
  canPerformStandardAttack,
  computeCohesion,
  computeSupport,
  getCohesionState,
} from './compute'
