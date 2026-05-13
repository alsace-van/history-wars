// v1.2 (13/05/2026) — Phase 3.2-bis : routed désormais basé sur effectif (<20%), pas morale (balance UX)
// v1.1 (11/05/2026) — Phase 2.5 : recoverMoraleEndTurnV2 + moraleCombatMultiplier modulés par soutien
// v1.0 (09/05/2026) — Phase 1 L1A.1 : moral MVP (D7)
// Source : docs/PLAN-MORAL-COHESION.md § 2 + PLAN-PHASE-1.md § 2.2

import type { SupportCount } from '../cohesion/types'
import type { UnitState } from '../units/types'

/**
 * @deprecated Phase 3.2-bis — `routed` ne dépend plus du moral mais de l'effectif
 * (cf. ROUT_EFFECTIVE_RATIO). Conservé pour rétrocompat de l'export public.
 * Le moral reste un compteur séparé (combat bonus/malus + récupération).
 */
export const MORALE_ROUT_THRESHOLD = 25

/**
 * Phase 3.2-bis — seuil d'effectif sous lequel une unité passe en déroute.
 * 0.20 = 20% de l'effectif max. Décorrelé du moral pour éviter le routing trop
 * agressif lié au combat continu (ex : 286/800 = 36% effectif n'est plus routed).
 */
export const ROUT_EFFECTIVE_RATIO = 0.20

/**
 * Phase 3.2-bis — calcule le flag `routed` à partir de l'effectif d'une unité.
 * Centralisé pour qu'aucun call site n'oublie la règle.
 */
export function computeRouted(effective: number, effectiveMax: number): boolean {
  if (effectiveMax <= 0) return true
  return effective / effectiveMax < ROUT_EFFECTIVE_RATIO
}

/** Recuperation passive de moral en fin de tour (hors combat / hors ZdC). */
export const MORALE_RECOVER_PER_TURN = 5

/**
 * Phase 2.5 — bonus de récup moral par allié adjacent (rayon 1).
 * +1 par allié, cumul max +3 (clampé via SUPPORT_PLAFOND côté cohesion).
 */
export const MORALE_RECOVER_BONUS_PER_ADJACENT = 1

/**
 * Phase 2.5 — bonus de récup moral par allié rayon 2.
 * +0.5 par allié rayon 2, cumul max +1 (2 alliés rayon 2 = +1).
 */
export const MORALE_RECOVER_BONUS_PER_NEARBY = 0.5

/**
 * Phase 2.5 — réduction de la perte de moral en combat par allié adjacent.
 * Multiplicateur de la perte (defender ou attacker). 1 allié → ×0.9 ; 3 alliés → ×0.7 (cumul max).
 * Plancher = 0.7 (au-delà marginal).
 */
export const MORALE_COMBAT_LOSS_PER_ADJACENT = 0.1
export const MORALE_COMBAT_LOSS_MULT_FLOOR = 0.7

/**
 * Applique un delta borne [0, moraleMax] et met a jour le flag routed.
 * Retourne un nouvel UnitState (pas de mutation).
 */
export function applyMoraleDelta(unit: UnitState, delta: number): UnitState {
  const newMorale = Math.max(0, Math.min(unit.moraleMax, unit.morale + delta))
  return {
    ...unit,
    morale: newMorale,
    // Phase 3.2-bis : routed dérive de l'effectif (pas du moral).
    routed: computeRouted(unit.effective, unit.effectiveMax),
  }
}

/** True si l'unite est en deroute (effectif < ROUT_EFFECTIVE_RATIO * effectiveMax). */
export function isRouted(unit: UnitState): boolean {
  return computeRouted(unit.effective, unit.effectiveMax)
}

/**
 * Bonus / malus de combat lie au moral.
 *   < 50  : -15 (panique → frappe moins juste, encaisse moins bien)
 *   > 75  : +5  (haut moral → discipline + agressivite)
 *   sinon : 0
 */
export function moraleCombatBonus(unit: UnitState): number {
  if (unit.morale < 50) return -15
  if (unit.morale > 75) return 5
  return 0
}

/**
 * Recuperation passive en fin de tour (v1, sans soutien).
 * Ignoree si l'unite a combattu pendant ce tour OU si elle est en ZdC ennemie.
 *
 * @deprecated Phase 2.5 — préférer `recoverMoraleEndTurnV2` qui intègre le soutien.
 * Conservée pour rétrocompat (callers Phase 1 sans cohesion).
 */
export function recoverMoraleEndTurn(
  unit: UnitState,
  hadCombat: boolean,
  inEnemyZoc: boolean,
): UnitState {
  if (hadCombat || inEnemyZoc) return unit
  return applyMoraleDelta(unit, MORALE_RECOVER_PER_TURN)
}

/**
 * Phase 2.5 — récup moral fin de tour avec bonus de soutien.
 *
 * Règles :
 *  - Bloquée si l'unité a combattu ce tour (`hadCombat`).
 *  - Bloquée si en ZdC ennemie (`inEnemyZoc`).
 *  - Sinon : base MORALE_RECOVER_PER_TURN (+5) + bonus support.
 *  - Bonus adjacent : +1 par allié rayon 1, cumul borné implicitement par
 *    le clamp `SupportCount.adjacent` côté caller (computeSupport plafonne).
 *  - Bonus nearby   : +0.5 par allié rayon 2.
 *
 * Le delta total est arrondi via `Math.round` (le moral est un entier en BDD).
 */
export function recoverMoraleEndTurnV2(
  unit: UnitState,
  hadCombat: boolean,
  inEnemyZoc: boolean,
  support: SupportCount,
): UnitState {
  if (hadCombat || inEnemyZoc) return unit
  const bonusAdj = support.adjacent * MORALE_RECOVER_BONUS_PER_ADJACENT
  const bonusNear = support.nearby * MORALE_RECOVER_BONUS_PER_NEARBY
  const delta = Math.round(MORALE_RECOVER_PER_TURN + bonusAdj + bonusNear)
  return applyMoraleDelta(unit, delta)
}

/**
 * Phase 2.5 — multiplicateur de perte de moral en combat selon soutien.
 *
 * Effet : un défenseur/attaquant entouré d'alliés est moins ébranlé par les pertes.
 *   - 0 allié adjacent → ×1.0 (perte normale)
 *   - 1 allié           → ×0.9
 *   - 2 alliés          → ×0.81
 *   - 3+ alliés         → ×0.7 (plancher, au-delà marginal)
 *
 * Utilisé par `resolveContact` (contact.ts v1.2) pour moduler `defenderMoraleDelta`
 * et `attackerMoraleDelta`. Plafond cohérent avec `SUPPORT_PLAFOND`.
 */
export function moraleCombatLossMultiplier(support: SupportCount): number {
  const adj = Math.min(support.adjacent, 3)
  const mult = Math.pow(1 - MORALE_COMBAT_LOSS_PER_ADJACENT, adj)
  return Math.max(MORALE_COMBAT_LOSS_MULT_FLOOR, mult)
}
