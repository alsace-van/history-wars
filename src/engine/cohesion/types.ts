// v1.0 (11/05/2026) — Phase 2.5 : types + constantes cohésion / soutien / états gradués
// Source : docs/PLAN-MORAL-COHESION.md § 1-2
// Frontière engine/ : zéro React, zéro Three, zéro Supabase

/**
 * Trois états gradués d'une unité, dérivés du score de cohésion.
 *  - nominal : unité combative, actions normales
 *  - shaken  : unité ébranlée, actions OK mais avertissement attaque
 *  - broken  : unité brisée, plus d'attaque standard (uniquement retraite/reddition/suicide)
 */
export type CohesionState = 'nominal' | 'shaken' | 'broken'

/**
 * Décompte du soutien tactique autour d'une unité.
 *  - adjacent : nombre d'alliés non-Brisés à distance hex = 1
 *  - nearby   : nombre d'alliés non-Brisés à distance hex = 2
 *  - total    : adjacent + 0.5 × nearby, clampé à [0, SUPPORT_PLAFOND]
 */
export interface SupportCount {
  readonly adjacent: number
  readonly nearby: number
  readonly total: number
}

/**
 * Score de cohésion décomposé pour debug / UI breakdown.
 * Chaque composant ∈ [0, 1]. total = somme pondérée.
 */
export interface CohesionScore {
  readonly morale: number
  readonly effective: number
  readonly support: number
  readonly total: number
  readonly state: CohesionState
}

/**
 * Pondération des 3 composants. Somme = 1.0.
 * 50/30/20 acté 10/05/2026 (cf. docs/PLAN-MORAL-COHESION.md § 10).
 */
export interface CohesionWeights {
  readonly morale: number
  readonly effective: number
  readonly support: number
}

export const DEFAULT_COHESION_WEIGHTS: CohesionWeights = Object.freeze({
  morale: 0.5,
  effective: 0.3,
  support: 0.2,
})

/**
 * Seuils de transition entre états (sur le score total).
 *  - cohesion > shaken             → nominal
 *  - broken < cohesion ≤ shaken    → shaken
 *  - cohesion ≤ broken             → broken
 *
 * Frontières incluses dans l'état inférieur (= si exactement 0.5 → shaken).
 */
export const COHESION_STATE_THRESHOLDS = Object.freeze({
  shaken: 0.5,
  broken: 0.2,
})

/** Plafond de soutien (alliés au-delà n'ajoutent rien). */
export const SUPPORT_PLAFOND = 3

/**
 * Garde-fou anti-broken : une unité dont effective ≥ MASS_SAFE_MULTIPLIER × effectiveMin
 * ne peut PAS être catégorisée Brisée même si la cohésion calculée tombe sous le seuil.
 * Au pire elle est Ébranlée (shaken). Évite qu'une unité avec encore beaucoup d'hommes
 * (ex: I 300/800) soit déclarée hors-jeu juste sur un mauvais moral transitoire.
 *
 * Concrètement :
 *  - I : seuil = 1.5 × 100 = 150 hommes
 *  - C : seuil = 1.5 × 25  ≈ 38 hommes
 *  - A : seuil = 1.5 × 30  = 45 servants
 */
export const MASS_SAFE_MULTIPLIER = 1.5

/** Rayons de mesure du soutien (en distance hex). */
export const SUPPORT_RADIUS_ADJACENT = 1
export const SUPPORT_RADIUS_NEARBY = 2

/**
 * Seuil d'effectif (ratio effective / effectiveMax) sous lequel une unité Brisée
 * NE PEUT PAS se reformer automatiquement, même avec soutien + hors-ZdC.
 * Doit alors passer par merge ou unité Infirmier (Phase 5).
 */
export const EFFECTIVE_REFORM_THRESHOLD_RATIO = 0.25
