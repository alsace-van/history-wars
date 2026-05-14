// v1.0 (14/05/2026) — Phase 4 Lot A1 : barrel engine/ai
export type { AIProfile, AIAction, AIContext, ScoredAction } from './types'
export { scoreAction, scoreAttack, scoreMove, scoreHold, expectedRiskAt } from './scorer'
export { enumerateActions, pickBestActionForUnit } from './picker'
