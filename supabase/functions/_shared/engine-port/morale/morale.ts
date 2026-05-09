// v1.0 (09/05/2026) — Phase 1 L1B.4a : port morale pour Deno EF
// Source de verite : src/engine/morale/morale.ts. Duplication controlee (piege #12).
// MVP : stat 0..moraleMax, malus combat sous 50, etat routed < 25.

import type { UnitState } from '../units.ts'

/** Sous ce seuil de moral, l'unite est en deroute (routed). */
export const MORALE_ROUT_THRESHOLD = 25

/** Recuperation passive de moral en fin de tour (hors combat / hors ZdC). */
export const MORALE_RECOVER_PER_TURN = 5

/**
 * Applique un delta borne [0, moraleMax] et met a jour le flag routed.
 * Retourne un nouvel UnitState (pas de mutation).
 */
export function applyMoraleDelta(unit: UnitState, delta: number): UnitState {
  const newMorale = Math.max(0, Math.min(unit.moraleMax, unit.morale + delta))
  return {
    ...unit,
    morale: newMorale,
    routed: newMorale < MORALE_ROUT_THRESHOLD,
  }
}

/** True si l'unite est sous le seuil de deroute. */
export function isRouted(unit: UnitState): boolean {
  return unit.morale < MORALE_ROUT_THRESHOLD
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
 * Recuperation passive en fin de tour.
 * Ignoree si l'unite a combattu pendant ce tour OU si elle est en ZdC ennemie.
 */
export function recoverMoraleEndTurn(
  unit: UnitState,
  hadCombat: boolean,
  inEnemyZoc: boolean,
): UnitState {
  if (hadCombat || inEnemyZoc) return unit
  return applyMoraleDelta(unit, MORALE_RECOVER_PER_TURN)
}
