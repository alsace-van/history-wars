// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : barrel export module sim (Deno port)
// PORT FROM src/engine/sim/index.ts — DO NOT EDIT MANUALLY.

export type { SimState, SimContext, SearchResult } from './types.ts'
export { cloneUnits, withUnits, replaceUnit, removeUnit, ctxFromState } from './clone.ts'
export { applyAction, resetTurnFlags, type ApplyActionContext } from './applyAction.ts'
export { evalState } from './evalState.ts'
export { searchBestAction } from './search.ts'
