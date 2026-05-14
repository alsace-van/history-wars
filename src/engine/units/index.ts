// v2.0 (10/05/2026) — Phase 2 2A.3 : exports stats v2 + sizing (split/merge)
// v1.0 (09/05/2026) — Phase 1 L1A.1 : barrel engine/units
export type { UnitId, UnitStats, UnitState, UnitSubKind } from './types'
export {
  UNIT_STATS_BY_KIND,
  getUnitStats,
  UNIT_STATS_V2,
  getUnitStatsV2,
  resolveUnitStatsV2,
  type UnitStatsV2,
  type SubKindOverride,
} from './stats'
export {
  splitUnit,
  mergeUnits,
  isSizingError,
  type SplitRatio,
  type SplitParams,
  type SplitResult,
  type MergeParams,
  type MergeResult,
  type SizingError,
} from './sizing'
export { computeOrdinalLabels, getKindCode } from './labels'
