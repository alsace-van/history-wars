// v1.0 (11/05/2026) — Phase 2.6 Vague B : port engagement/types pour Deno
// Source de verite : src/engine/engagement/types.ts. Duplication controlee (piege #12).

import type { SupportCount } from '../cohesion/types.ts'
import type { CombatConfig } from '../combat/v2/types.ts'
import type { TerrainType } from '../terrain/types.ts'
import type { UnitState } from '../units.ts'

export type EngagementId = string

export type EngagementDissolutionReason = 'none' | 'sideA' | 'sideB' | 'both'

export interface EngagementState {
  id: EngagementId
  gameId: string
  unitAId: string
  unitBId: string
  startedTurn: number
}

export interface EngagementSideResult {
  unitId: string
  effectiveBefore: number
  effectiveAfter: number
  menEngagedBefore: number
  menEngagedAfter: number
  killed: number
  woundedAdd: number
  actualDamage: number
  moraleBefore: number
  moraleAfter: number
  moraleDelta: number
  routedAfter: boolean
  dissolved: boolean
  rollUsed: number
}

export interface EngagementTickInput {
  sideA: UnitState
  sideB: UnitState
  terrain: TerrainType
  currentTurn: number
  rng: () => number
  config?: CombatConfig
  supportA?: SupportCount
  supportB?: SupportCount
}

export interface EngagementTickResult {
  sideA: EngagementSideResult
  sideB: EngagementSideResult
  contactCap: number
  terrain: TerrainType
  dissolved: boolean
  dissolutionReason: EngagementDissolutionReason
  currentTurn: number
}

export interface BreakCombatResult {
  unitAfter: UnitState
  actualDamage: number
  killed: number
  woundedAdd: number
}

export const RESERVE_RELIEF_RATE = 0.1
export const BREAK_COMBAT_COST_RATIO = 0.1
export const ENGAGEMENT_VARIANCE_LOW = 0.95
export const ENGAGEMENT_VARIANCE_RANGE = 0.10
// Phase 3.2-bis : abaissé -2 → -1 (fatigue plus douce, feedback user).
export const ENGAGEMENT_MORALE_DELTA_PER_TURN = -1
// Phase 3.2-bis : plancher du multiplicateur de dégâts subis côté dominant.
export const DOMINANCE_DAMAGE_FLOOR = 0.25
