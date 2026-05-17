// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : types simulation pour lookahead minimax
// PORT FROM src/engine/sim/types.ts — DO NOT EDIT MANUALLY.

import type { Team } from '../../types.ts'
import type { UnitState } from '../units.ts'
import type { AIContext, AIAction } from '../ai/types.ts'

type UnitId = string

export interface SimState {
  readonly units: ReadonlyArray<UnitState>
  readonly engagedUnitIds: ReadonlySet<UnitId>
  readonly turn: number
}

export interface SimContext {
  readonly baseCtx: AIContext
  readonly botTeam: Team
  readonly beamWidth: number
  readonly enemyBeamWidth: number
  readonly deadline: number
}

export interface SearchResult {
  readonly action: AIAction | null
  readonly value: number
}
