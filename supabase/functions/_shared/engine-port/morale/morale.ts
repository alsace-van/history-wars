// v1.1 (11/05/2026) — Phase 2.5 : recoverMoraleEndTurnV2 + moraleCombatLossMultiplier
// v1.0 (09/05/2026) — Phase 1 L1B.4a : port morale pour Deno EF
// Source de verite : src/engine/morale/morale.ts. Duplication controlee (piege #12).

import type { SupportCount } from '../cohesion/types.ts'
import type { UnitState } from '../units.ts'

export const MORALE_ROUT_THRESHOLD = 25
export const MORALE_RECOVER_PER_TURN = 5
export const MORALE_RECOVER_BONUS_PER_ADJACENT = 1
export const MORALE_RECOVER_BONUS_PER_NEARBY = 0.5
export const MORALE_COMBAT_LOSS_PER_ADJACENT = 0.1
export const MORALE_COMBAT_LOSS_MULT_FLOOR = 0.7

export function applyMoraleDelta(unit: UnitState, delta: number): UnitState {
  const newMorale = Math.max(0, Math.min(unit.moraleMax, unit.morale + delta))
  return {
    ...unit,
    morale: newMorale,
    routed: newMorale < MORALE_ROUT_THRESHOLD,
  }
}

export function isRouted(unit: UnitState): boolean {
  return unit.morale < MORALE_ROUT_THRESHOLD
}

export function moraleCombatBonus(unit: UnitState): number {
  if (unit.morale < 50) return -15
  if (unit.morale > 75) return 5
  return 0
}

/**
 * @deprecated Phase 2.5 — préférer recoverMoraleEndTurnV2 qui intègre le soutien.
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
 */
export function moraleCombatLossMultiplier(support: SupportCount): number {
  const adj = Math.min(support.adjacent, 3)
  const mult = Math.pow(1 - MORALE_COMBAT_LOSS_PER_ADJACENT, adj)
  return Math.max(MORALE_COMBAT_LOSS_MULT_FLOOR, mult)
}
