// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : barrel export module sim
export type { SimState, SimContext, SearchResult } from './types'
export { cloneUnits, withUnits, replaceUnit, removeUnit, ctxFromState } from './clone'
export { applyAction, resetTurnFlags, type ApplyActionContext } from './applyAction'
export { evalState } from './evalState'
export { searchBestAction } from './search'
