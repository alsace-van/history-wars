// v1.0 (09/05/2026) — Phase 1 L1A.3 : combat melee
// Source : PLAN-PHASE-1.md § 2.2 (engine/combat/melee.ts)

import type { UnitState } from '../units/types'
import { getUnitStats } from '../units/stats'
import { applyMoraleDelta, moraleCombatBonus } from '../morale/morale'
import type { CombatModifiers, CombatResult } from './types'

const ROLL_RANGE_MELEE = 20  // roll = rng()*20 - 10 → [-10, +10)
const FLANK_BONUS = 10
const ATTACKER_MORALE_DELTA_MELEE = 2

/**
 * Resolution melee : ATK/DEF effectifs avec modifiers + bonus morale,
 * roll uniforme [-10, +10), damage clampe a 0.
 * Le rng est passe par le caller (EF) pour determinisme cross-runtime + replays.
 */
export function resolveMelee(
  attacker: UnitState,
  defender: UnitState,
  modifiers: CombatModifiers,
  rng: () => number,
): CombatResult {
  const aStats = getUnitStats(attacker.kind)
  const dStats = getUnitStats(defender.kind)

  const atkEff = aStats.attack + (modifiers.flanked ? FLANK_BONUS : 0) + moraleCombatBonus(attacker)
  const defEff = dStats.defense + (modifiers.terrainDefBonus ?? 0) + moraleCombatBonus(defender)

  const rollRaw = rng()
  const roll = rollRaw * ROLL_RANGE_MELEE - ROLL_RANGE_MELEE / 2  // [-10, +10)
  const damage = Math.max(0, Math.round(atkEff - defEff + roll))
  const defenderHpAfter = Math.max(0, defender.hp - damage)
  const defenderKilled = defenderHpAfter === 0

  const attackerMoraleDelta = ATTACKER_MORALE_DELTA_MELEE
  const defenderMoraleDelta = -Math.round(damage / 4)

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
