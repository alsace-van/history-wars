// v1.1 (12/05/2026) — Garde-fou anti-broken (mirror src v1.1) — effective ≥ 1.5 × effectiveMin
// v1.0 (11/05/2026) — Phase 2.5 : port cohesion/compute pour Deno
// Source de verite : src/engine/cohesion/compute.ts. Duplication controlee (piege #12).

import { cubeDistance } from '../hex/index.ts'
import type { UnitState } from '../units.ts'
import {
  COHESION_STATE_THRESHOLDS,
  DEFAULT_COHESION_WEIGHTS,
  MASS_SAFE_MULTIPLIER,
  SUPPORT_PLAFOND,
  SUPPORT_RADIUS_ADJACENT,
  SUPPORT_RADIUS_NEARBY,
  type CohesionScore,
  type CohesionState,
  type CohesionWeights,
  type SupportCount,
} from './types.ts'

export function computeSupport(
  unit: UnitState,
  allUnits: ReadonlyArray<UnitState>,
): SupportCount {
  let adjacent = 0
  let nearby = 0
  for (const other of allUnits) {
    if (other.id === unit.id) continue
    if (other.team !== unit.team) continue
    if (other.routed) continue
    if (other.effective <= other.effectiveMin) continue
    const d = cubeDistance(unit.position, other.position)
    if (d === SUPPORT_RADIUS_ADJACENT) adjacent++
    else if (d === SUPPORT_RADIUS_NEARBY) nearby++
  }
  const raw = adjacent + 0.5 * nearby
  const total = Math.min(SUPPORT_PLAFOND, raw)
  return { adjacent, nearby, total }
}

export function computeCohesion(
  unit: UnitState,
  support: SupportCount,
  weights: CohesionWeights = DEFAULT_COHESION_WEIGHTS,
): CohesionScore {
  const moraleRatio = unit.moraleMax > 0 ? unit.morale / unit.moraleMax : 0
  const effectiveRatio = unit.effectiveMax > 0 ? unit.effective / unit.effectiveMax : 0
  const supportRatio = Math.min(1, support.total / SUPPORT_PLAFOND)

  const moraleComponent = weights.morale * moraleRatio
  const effectiveComponent = weights.effective * effectiveRatio
  const supportComponent = weights.support * supportRatio

  const total = moraleComponent + effectiveComponent + supportComponent
  let state = getCohesionState(total)

  // v1.1 — Garde-fou : unité avec encore beaucoup d'hommes → max shaken même si
  // cohésion calculée < 0.2 (sinon une I 300/800 mal-morale serait Brisée).
  if (state === 'broken' && unit.effective >= unit.effectiveMin * MASS_SAFE_MULTIPLIER) {
    state = 'shaken'
  }

  return {
    morale: moraleComponent,
    effective: effectiveComponent,
    support: supportComponent,
    total,
    state,
  }
}

export function getCohesionState(total: number): CohesionState {
  if (total <= COHESION_STATE_THRESHOLDS.broken) return 'broken'
  if (total <= COHESION_STATE_THRESHOLDS.shaken) return 'shaken'
  return 'nominal'
}

export function canPerformStandardAttack(state: CohesionState): boolean {
  return state !== 'broken'
}
