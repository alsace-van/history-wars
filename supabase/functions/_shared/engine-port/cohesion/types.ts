// v1.1 (12/05/2026) — Ajout MASS_SAFE_MULTIPLIER (mirror src v1.1)
// v1.0 (11/05/2026) — Phase 2.5 : port cohesion/types pour Deno
// Source de verite : src/engine/cohesion/types.ts. Duplication controlee (piege #12).

export type CohesionState = 'nominal' | 'shaken' | 'broken'

export interface SupportCount {
  adjacent: number
  nearby: number
  total: number
}

export interface CohesionScore {
  morale: number
  effective: number
  support: number
  total: number
  state: CohesionState
}

export interface CohesionWeights {
  morale: number
  effective: number
  support: number
}

export const DEFAULT_COHESION_WEIGHTS: CohesionWeights = Object.freeze({
  morale: 0.5,
  effective: 0.3,
  support: 0.2,
})

export const COHESION_STATE_THRESHOLDS = Object.freeze({
  shaken: 0.5,
  broken: 0.2,
})

export const SUPPORT_PLAFOND = 3
export const SUPPORT_RADIUS_ADJACENT = 1
export const SUPPORT_RADIUS_NEARBY = 2
export const EFFECTIVE_REFORM_THRESHOLD_RATIO = 0.25

/** Garde-fou anti-broken : effective ≥ 1.5 × effectiveMin → max shaken. Mirror src v1.1. */
export const MASS_SAFE_MULTIPLIER = 1.5
