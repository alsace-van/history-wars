// v1.0 (10/05/2026) — Phase 2 2A.5+ : types combat v2 (effectif, phases, breakdown)
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.6

import type { UnitKind } from '../../../types/game'

/**
 * Phase d'attaque resolue en combat v2.
 *   melee  : adjacent, contact direct (riposte automatique).
 *   ranged : distance >= 1, dans la portee (pas de riposte).
 *   charge : cavalerie en mouvement >= 2 hex en ligne droite avant impact (pas de riposte).
 */
export type AttackPhase = 'melee' | 'ranged' | 'charge'

/**
 * Une ligne du breakdown affiche dans le tooltip / panneau resultat.
 *  - label      : libelle court ("ATK base", "Charge cav", "Terrain foret", "Moral")
 *  - multiplier : facteur applique (ex: 1.4 pour charge, 0.85 pour terrain forêt côté ATK)
 *  - appliedTo  : a qui s'applique le multiplicateur ('attacker' ou 'defender')
 */
export interface BonusBreakdownEntry {
  readonly label: string
  readonly multiplier: number
  readonly appliedTo: 'attacker' | 'defender'
}

/**
 * Resultat de combat v2. Etend CombatResult v1 avec :
 *  - attackPhase                 : phase resolue
 *  - effective avant/apres       : pour animation + UI
 *  - menEngaged                  : hommes au contact (apres saturation terrain)
 *  - contactCap                  : plafond saturation utilise
 *  - bonusBreakdown              : liste des multiplicateurs appliques (UI)
 *  - chargeBonusApplied          : true si la charge cav a contribue
 *
 * Conserve la backward-compat avec les fields v1 (damageDealt, killed, woundedAdd, etc.)
 * pour minimiser le diff avec les consommateurs Realtime / replays.
 */
export interface CombatResultV2 {
  // --- v1 hérités ---
  readonly damageDealt: number
  readonly actualDamage: number
  readonly killed: number
  readonly woundedAdd: number
  readonly defenderHpAfter: number
  readonly defenderWoundedAfter: number
  readonly attackerMoraleDelta: number
  readonly defenderMoraleDelta: number
  readonly attackerMoraleAfter: number
  readonly defenderMoraleAfter: number
  readonly attackerRouted: boolean
  readonly defenderRouted: boolean
  readonly defenderKilled: boolean
  readonly rollUsed: number
  // --- v2 nouveaux ---
  readonly attackPhase: AttackPhase
  readonly attackerEffectiveBefore: number
  readonly attackerEffectiveAfter: number
  readonly defenderEffectiveBefore: number
  readonly defenderEffectiveAfter: number
  readonly menEngagedAttacker: number
  readonly menEngagedDefender: number
  readonly contactCap: number
  readonly bonusBreakdown: ReadonlyArray<BonusBreakdownEntry>
  readonly chargeBonusApplied: boolean
}

/**
 * Configuration combat editable runtime (BDD `combat_config`, migration 014).
 * Permet de tweaker les coefs sans redeploy et prepare la moddabilite Phase 15.
 *
 * Phase 2 : valeurs par defaut alignees sur UNIT_STATS_V2 + TERRAIN_CAPS + MATCHUP_MATRIX.
 * L'EF charge cette config une fois par invocation et la passe aux handlers.
 */
export interface CombatConfig {
  readonly diceVariance: { readonly low: number; readonly range: number }   // 0.85 / 0.30 → ±15 %
  readonly chargeMultipliers: { readonly two: number; readonly three: number; readonly fourPlus: number }
  readonly moraleThresholds: { readonly rout: number; readonly test: number }
  /** matchup[phase][attackerKind][defenderKind] */
  readonly matchupMatrix: Readonly<
    Record<AttackPhase, Readonly<Record<UnitKind, Readonly<Record<UnitKind, number>>>>>
  >
  /**
   * Phase 2.5 balance : plancher d'attrition naturelle proportionnel aux hommes engagés.
   * Évite le bug "1 dégât à forces égales" (cf. 800I vs 800I plaine donnait power=resistance).
   * Default 0.08 = 8 % : 200 hommes engagés → minimum 16 pertes/tour à égalité parfaite.
   * Optionnel : fallback sur 0.08 si combat_config BDD encore au seed Phase 2 initial.
   */
  readonly baseAttritionRate?: number
}

/** Fallback runtime si combat_config BDD ne contient pas encore baseAttritionRate (seed Phase 2 initial). */
export const DEFAULT_BASE_ATTRITION_RATE = 0.08

/**
 * Config par defaut MVP Phase 2. Source de verite jusqu'a chargement BDD via combat_config.
 * Cette constante est aussi seedee dans la migration 014 (Session 3).
 */
export const DEFAULT_COMBAT_CONFIG: CombatConfig = Object.freeze({
  diceVariance: Object.freeze({ low: 0.85, range: 0.30 }),
  chargeMultipliers: Object.freeze({ two: 1.3, three: 1.4, fourPlus: 1.5 }),
  moraleThresholds: Object.freeze({ rout: 25, test: 30 }),
  baseAttritionRate: DEFAULT_BASE_ATTRITION_RATE,
  matchupMatrix: Object.freeze({
    melee: Object.freeze({
      I: Object.freeze({ I: 1.0, C: 1.1, A: 1.5 }),
      C: Object.freeze({ I: 0.9, C: 1.0, A: 1.5 }),
      A: Object.freeze({ I: 0.5, C: 0.5, A: 1.0 }),
    }),
    ranged: Object.freeze({
      I: Object.freeze({ I: 0.8, C: 0.7, A: 0.9 }),
      C: Object.freeze({ I: 0.5, C: 0.5, A: 0.5 }),
      A: Object.freeze({ I: 1.0, C: 0.7, A: 1.5 }),
    }),
    charge: Object.freeze({
      I: Object.freeze({ I: 1.0, C: 1.0, A: 1.0 }),
      C: Object.freeze({ I: 1.5, C: 1.1, A: 1.5 }),
      A: Object.freeze({ I: 1.0, C: 1.0, A: 1.0 }),
    }),
  }),
})
