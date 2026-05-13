// v1.0 (11/05/2026) — Phase 2.6 Vague A : types engagement persistant
// Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 1-3, 11
// Frontière engine/ : zéro React, zéro Three, zéro Supabase

import type { SupportCount } from '../cohesion/types'
import type { CombatConfig } from '../combat/v2/types'
import type { TerrainType } from '../terrain/types'
import type { UnitId, UnitState } from '../units/types'

/** Identifiant d'engagement (uuid BDD côté vague B). */
export type EngagementId = string

/**
 * Raison de dissolution d'un engagement à l'issue d'un tick.
 *  - sideA      : seul le côté A est tombé sous effectiveMin
 *  - sideB      : seul le côté B est tombé sous effectiveMin
 *  - both       : les deux côtés simultanément (dissolution mutuelle)
 *  - none       : l'engagement persiste après le tick
 *
 * Phase 2.6 Vague B : étendre avec 'broken' (cohésion ≤ 0.2) si décision de
 * propager la dissolution automatique des Brisés au tick.
 */
export type EngagementDissolutionReason = 'none' | 'sideA' | 'sideB' | 'both'

/**
 * État persistant d'un engagement entre 2 unités ennemies adjacentes.
 * Source unique de vérité : table `engagements` (migration 017 vague B).
 *
 * Le caller doit garantir que :
 *  - unitAId !== unitBId
 *  - les 2 unités sont team différente
 *  - les 2 unités sont à distance hex == 1 au moment de la création
 *  - aucun engagement existant entre cette paire (unicité gérée BDD vague B)
 */
export interface EngagementState {
  readonly id: EngagementId
  readonly gameId: string
  readonly unitAId: UnitId
  readonly unitBId: UnitId
  /** Numéro de tour où l'engagement a été initié (pour badge UI "Engagé T3"). */
  readonly startedTurn: number
}

/**
 * Résultat d'un côté pour un tick. Contient tout ce qu'il faut pour :
 *  - mettre à jour la BDD (units.effective, wounded, morale, routed)
 *  - afficher le log combat continu (CombatResultPanel type 'attrition')
 *  - détecter la dissolution (`dissolved`)
 *
 * Invariant : effectiveAfter === effectiveBefore - (killed + woundedAdd).
 * Note : killed + woundedAdd === actualDamage (cf. splitCasualties).
 */
export interface EngagementSideResult {
  readonly unitId: UnitId
  readonly effectiveBefore: number
  readonly effectiveAfter: number
  readonly menEngagedBefore: number
  readonly menEngagedAfter: number
  readonly killed: number
  readonly woundedAdd: number
  /** Pertes effective réellement subies ce tick (= killed + woundedAdd). */
  readonly actualDamage: number
  readonly moraleBefore: number
  readonly moraleAfter: number
  /** Delta moral total (combat + bonus -2/tour engagé). */
  readonly moraleDelta: number
  readonly routedAfter: boolean
  readonly dissolved: boolean
  /** Roll RNG consommé pour l'attrition de ce côté (déterminisme replay). */
  readonly rollUsed: number
}

/** Entrée d'un tick d'engagement (côté A frappe côté B et inversement). */
export interface EngagementTickInput {
  readonly sideA: UnitState
  readonly sideB: UnitState
  readonly terrain: TerrainType
  /** Numéro de tour courant (utilisé seulement pour métadonnée, pas pour calcul). */
  readonly currentTurn: number
  readonly rng: () => number
  readonly config?: CombatConfig
  /** Soutien tactique du côté A (allés rayon 1+2). Module perte moral. */
  readonly supportA?: SupportCount
  readonly supportB?: SupportCount
}

/** Sortie d'un tick : 2 résultats + métadonnées de dissolution. */
export interface EngagementTickResult {
  readonly sideA: EngagementSideResult
  readonly sideB: EngagementSideResult
  readonly contactCap: number
  readonly terrain: TerrainType
  readonly dissolved: boolean
  readonly dissolutionReason: EngagementDissolutionReason
  readonly currentTurn: number
}

/** Résultat d'une rupture volontaire (action `break_combat`). */
export interface BreakCombatResult {
  readonly unitAfter: UnitState
  /** Pertes effective réellement appliquées (=killed + woundedAdd). */
  readonly actualDamage: number
  readonly killed: number
  readonly woundedAdd: number
}

// -------------------- Constantes Phase 2.6 (cf. plan § 11) --------------------

/**
 * Phase 2.6 — taux de relève des réserves au contact par tour.
 * 10 % des hommes hors contact (`effective - menEngaged`) peuvent monter combler
 * la ligne de mêlée et **absorbent** ainsi les pertes excédant menEngaged.
 *
 * Formule absorbtion :
 *   absorbCapacity = menEngaged + round(reserve × RESERVE_RELIEF_RATE)
 *   adjustedDamage = min(damageRaw, absorbCapacity)
 *
 * Sans réserve, une unité ne peut perdre plus que menEngaged hommes / tour
 * (cohérent avec la réalité historique du combat de ligne).
 */
export const RESERVE_RELIEF_RATE = 0.1

/**
 * Phase 2.6 — coût fixe de la rupture du combat.
 * 10 % de l'effective au moment du clic Rompre, plancher à 1 (jamais 0 perte).
 * Modélise les hommes laissés au front en se désengageant.
 *
 * Option A actée (cf. plan § 11.3) : coût simple et prévisible.
 */
export const BREAK_COMBAT_COST_RATIO = 0.1

/**
 * Phase 2.6 — variance d'attrition par tick d'engagement.
 * ±5 % (vs ±15 % en combat ponctuel Phase 2) — combat continu plus déterministe,
 * la dramaturgie se joue sur la durée plutôt que sur chaque tick.
 *
 * Roll RNG ∈ [0, 1) → variance ∈ [0.95, 1.05).
 */
export const ENGAGEMENT_VARIANCE_LOW = 0.95
export const ENGAGEMENT_VARIANCE_RANGE = 0.10

/**
 * Phase 2.6 — delta moral additionnel par tour engagé.
 * Phase 3.2-bis : abaissé de -2 → -1 (fatigue plus douce, feedback user).
 * Modélise la fatigue / stress du combat continu. S'additionne au delta
 * combat classique (perte par pertes effective, modulée par soutien).
 *
 * Une unité Nominale en engagement long (20+ tours) descend en Ébranlée
 * naturellement : -1 × 20 = -20 moral, combiné aux pertes effective fait
 * basculer cohesion < 0.5.
 */
export const ENGAGEMENT_MORALE_DELTA_PER_TURN = -1

/**
 * Phase 3.2-bis — réduction des dégâts subis pour le côté dominant.
 * Calcul : dominance = power_self_no_floor / power_enemy_no_floor.
 * Multiplicateur appliqué aux dégâts SUBIS = clamp(1 / dominance, FLOOR, 1).
 *  - dominance = 1.0 → 1.0 (pas de réduction)
 *  - dominance = 1.5 → 0.67 (subit 33% de moins)
 *  - dominance = 2.0 → 0.50 (subit 50% de moins)
 *  - dominance ≥ 4   → 0.25 (clampé)
 * Récompense la victoire tactique sans rendre le combat trivialement déséquilibré.
 */
export const DOMINANCE_DAMAGE_FLOOR = 0.25
