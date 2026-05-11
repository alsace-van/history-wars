// v1.0 (11/05/2026) — Phase 2.5 : computeSupport, computeCohesion, getCohesionState
// Source : docs/PLAN-MORAL-COHESION.md § 1-2
// Frontière engine/ : zéro React, zéro Three, zéro Supabase

import { cubeDistance } from '../hex'
import type { UnitState } from '../units/types'
import {
  COHESION_STATE_THRESHOLDS,
  DEFAULT_COHESION_WEIGHTS,
  SUPPORT_PLAFOND,
  SUPPORT_RADIUS_ADJACENT,
  SUPPORT_RADIUS_NEARBY,
  type CohesionScore,
  type CohesionState,
  type CohesionWeights,
  type SupportCount,
} from './types'

/**
 * Décompte les alliés non-Brisés autour d'une unité.
 *
 * Règles :
 *  - Allié = même team, id différent
 *  - Brisé exclu (cohésion ≤ 0.2). Pour éviter une dépendance circulaire avec
 *    computeCohesion, on filtre ici via le flag `routed` legacy + un test
 *    d'effectif plancher (∼ proxy raisonnable du Brisé).
 *  - Rayon 1 → compte +1
 *  - Rayon 2 → compte +0.5
 *  - Total clampé à SUPPORT_PLAFOND (3) — au-delà, marginal.
 *
 * Performance : O(n) sur le total d'unités. Caller responsable de batch
 * (ex: computeSupportMap pour tout un camp en 1 passe).
 */
export function computeSupport(
  unit: UnitState,
  allUnits: ReadonlyArray<UnitState>,
): SupportCount {
  let adjacent = 0
  let nearby = 0
  for (const other of allUnits) {
    if (other.id === unit.id) continue
    if (other.team !== unit.team) continue
    // Proxy "non-Brisé" : routed legacy ou effective sous min équivaut à Brisé.
    // Quand on rebranche cohesionState complet (post-vague B), on remplacera
    // par un check direct getCohesionState(other) !== 'broken'.
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

/**
 * Calcule le score de cohésion d'une unité.
 *
 * Formule (cf. docs/PLAN-MORAL-COHESION.md § 1) :
 *   cohesion = 0.5 × (morale/moraleMax)
 *            + 0.3 × (effective/effectiveMax)
 *            + 0.2 × min(1, support.total / SUPPORT_PLAFOND)
 *
 * Tous les composants sont dans [0, 1], donc cohesion ∈ [0, 1].
 */
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
  const state = getCohesionState(total)

  return {
    morale: moraleComponent,
    effective: effectiveComponent,
    support: supportComponent,
    total,
    state,
  }
}

/**
 * Détermine l'état d'une cohésion donnée.
 * Frontières incluses dans l'état inférieur :
 *  - cohesion > 0.5  → nominal
 *  - 0.2 < cohesion ≤ 0.5 → shaken
 *  - cohesion ≤ 0.2 → broken
 */
export function getCohesionState(total: number): CohesionState {
  if (total <= COHESION_STATE_THRESHOLDS.broken) return 'broken'
  if (total <= COHESION_STATE_THRESHOLDS.shaken) return 'shaken'
  return 'nominal'
}

/**
 * Helper : `true` si une unité a le droit aux attaques standard.
 * Brisé = bloque sauf actions critiques (retreat / surrender / suicide).
 */
export function canPerformStandardAttack(state: CohesionState): boolean {
  return state !== 'broken'
}
