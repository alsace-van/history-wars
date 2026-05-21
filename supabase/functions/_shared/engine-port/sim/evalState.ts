// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : eval d'état pour minimax
// PORT FROM src/engine/sim/evalState.ts — DO NOT EDIT MANUALLY.

import type { Team } from '../../types.ts'
import type { SimState } from './types.ts'

const MORALE_WEIGHT = 0.3
const ROUTED_PENALTY = 100

export function evalState(state: SimState, teamPov: Team): number {
  let score = 0
  for (const u of state.units) {
    const value = u.effective + u.morale * MORALE_WEIGHT
    const routedDelta = u.routed ? ROUTED_PENALTY : 0
    if (u.team === teamPov) {
      score += value
      score -= routedDelta
    } else {
      score -= value
      score += routedDelta
    }
  }
  return score
}
