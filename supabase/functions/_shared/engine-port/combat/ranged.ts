// v1.2 (10/05/2026) — Phase 1.5 : MIN_DAMAGE_RANGED = 1 (mirror src v1.2)
// v1.1 (10/05/2026) — Phase 1.5 : split casualties killed/woundedAdd via splitCasualties() (mirror src v1.1)
// v1.0 (09/05/2026) — Phase 1 L1B.4a : port combat/ranged pour Deno EF
// Source de verite : src/engine/combat/ranged.ts. Duplication controlee (piege #12).
// Pas de flanc, pas de riposte, roll plus large, attrition morale plus douce.

import type { UnitState } from '../units.ts'
import { getUnitStats } from '../units.ts'
import { applyMoraleDelta, moraleCombatBonus } from '../morale/morale.ts'
import { splitCasualties, type CombatModifiers, type CombatResult } from './types.ts'

const ROLL_RANGE_RANGED = 30  // roll = rng()*30 - 15 → [-15, +15)
const ATTACKER_MORALE_DELTA_RANGED = 1
const MIN_DAMAGE_RANGED = 1

/**
 * Resolution combat distance. Le caller verifie distance + LoS avant d'appeler.
 * Pas de bonus flanc (la cible ne sait pas d'ou ca vient au point de fuir).
 * Pas de riposte (la cible ne tire pas en retour automatiquement).
 * Le damage applique est split en killed (60 %) + woundedAdd (40 %) via splitCasualties.
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
  const damage = Math.max(MIN_DAMAGE_RANGED, Math.round(atkEff - defEff + roll))

  const split = splitCasualties(damage, defender.hp)
  const defenderKilled = split.defenderHpAfter === 0
  const defenderWoundedAfter = Math.min(defender.wounded + split.woundedAdd, defender.hpMax - split.defenderHpAfter)

  const attackerMoraleDelta = ATTACKER_MORALE_DELTA_RANGED
  const defenderMoraleDelta = -Math.round(split.actualDamage / 6)

  const attackerAfter = applyMoraleDelta(attacker, attackerMoraleDelta)
  const defenderAfter = applyMoraleDelta(defender, defenderMoraleDelta)

  return {
    damageDealt: damage,
    actualDamage: split.actualDamage,
    killed: split.killed,
    woundedAdd: split.woundedAdd,
    defenderHpAfter: split.defenderHpAfter,
    defenderWoundedAfter,
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
