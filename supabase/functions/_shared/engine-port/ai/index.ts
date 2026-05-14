// v1.0 (14/05/2026) — Phase 4 Lot A2 : barrel engine-port/ai
export type { AIProfile, AIAction, AIContext, ScoredAction } from './types.ts'
export { scoreAction, scoreAttack, scoreMove, scoreHold, expectedRiskAt } from './scorer.ts'
export { enumerateActions, pickBestActionForUnit } from './picker.ts'
