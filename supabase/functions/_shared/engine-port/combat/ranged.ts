// v1.0 (09/05/2026) — Phase 1 L1B.4a : port combat/ranged pour Deno EF
// Source de verite : src/engine/combat/ranged.ts. Duplication controlee (piege #12).
// Pas de flanc, pas de riposte, roll plus large, attrition morale plus douce.

import type { UnitState } from '../units.ts'
import { getUnitStats } from '../units.ts'
import { applyMoraleDelta, moraleCombatBonus } from '../morale/morale.ts'
import type { CombatModifiers, CombatResult } from './types.ts'

const ROLL_RANGE_RANGED = 30  // roll = rng()*30 - 15 → [-15, +15)
const ATTACKER_MORALE_DELTA_RANGED = 1

/**
 * Resolution combat distance. Le caller verifie distance + LoS avant d'appeler.
 * Pas de bonus flanc (la cible ne sait pas d'ou ca vient au point de fuir).
 * Pas de riposte (la cible ne tire pas en retour automatiquement).
 */
export function resolveRanged(
  attacker: UnitState,
  defender: UnitState,
  modifiers: CombatModifiers,
  rng: () => number,
): CombatResult {
  const aStats = getUnitStats(attacker.kind)
  const dStats = getUnitStats(defender.kind)

  const atkEff = aStats.attack + moraleCombatBonus(attacker)
  const defEff = dStats.defense + (modifiers.terrainDefBonus ?? 0) + moraleCombatBonus(defender)

  const rollRaw = rng()
  const roll = rollRaw * ROLL_RANGE_RANGED - ROLL_RANGE_RANGED / 2
  const damage = Math.max(0, Math.round(atkEff - defEff + roll))
  const defenderHpAfter = Math.max(0, defender.hp - damage)
  const defenderKilled = defenderHpAfter === 0

  const attackerMoraleDelta = ATTACKER_MORALE_DELTA_RANGED
  const defenderMoraleDelta = -Math.round(damage / 6)

  const attackerAfter = applyMoraleDelta(attacker, attackerMoraleDelta)
  const defenderAfter = applyMoraleDelta(defender, defenderMoraleDelta)

  return {
    damageDealt: damage,
    defenderHpAfter,
    attackerMoraleDelta,
    defenderMoraleDelta,
    attackerMoraleAfter: attackerAfter.morale,
    defenderMoraleAfter: defenderAfter.morale,
    attackerRouted: attackerAfter.routed,
    defenderRouted: defenderAfter.routed,
    defenderKilled,
    rollUsed: rollRaw,
  }
}
