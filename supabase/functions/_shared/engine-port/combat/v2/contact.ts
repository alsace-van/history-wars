// v1.0 (10/05/2026) — Phase 2 2C.1 : port combat/v2/contact pour Deno
// Source de verite : src/engine/combat/v2/contact.ts. Duplication controlee (piege #12).

import { applyMoraleDelta, moraleCombatBonus } from '../../morale/morale.ts'
import { TERRAIN_CAPS } from '../../terrain/caps.ts'
import type { TerrainType } from '../../terrain/types.ts'
import { resolveUnitStatsV2, type UnitState } from '../../units.ts'
import { splitCasualties } from '../types.ts'
import { distancePrecision } from './distance.ts'
import { describeMatchup, getMatchupCoef } from './matchup.ts'
import type { AttackPhase, BonusBreakdownEntry, CombatConfig, CombatResultV2 } from './types.ts'
import { DEFAULT_BASE_ATTRITION_RATE, DEFAULT_COMBAT_CONFIG } from './types.ts'

export interface ContactInput {
  attacker: UnitState
  defender: UnitState
  phase: AttackPhase
  attackerTerrain: TerrainType
  defenderTerrain: TerrainType
  distance: number
  chargeMult: number
  rng: () => number
  config?: CombatConfig
}

export function resolveContact(input: ContactInput): CombatResultV2 {
  const config = input.config ?? DEFAULT_COMBAT_CONFIG
  const { attacker, defender, phase, attackerTerrain, defenderTerrain, distance, chargeMult, rng } = input

  const aStats = resolveUnitStatsV2(attacker.kind, attacker.subKind)
  const dStats = resolveUnitStatsV2(defender.kind, defender.subKind)

  const attackerCaps = TERRAIN_CAPS[attackerTerrain]
  const defenderCaps = TERRAIN_CAPS[defenderTerrain]
  const contactCap = Math.min(attackerCaps.contactCap, defenderCaps.contactCap)
  const menEngagedAttacker = Math.min(attacker.effective, contactCap)
  const menEngagedDefender = Math.min(defender.effective, contactCap)

  const baseAttackFactor = phase === 'ranged' ? aStats.rangedPower : aStats.attack
  const baseDefenseFactor = dStats.defense
  const matchupCoef = getMatchupCoef(attacker.kind, defender.kind, phase, config)
  const atkTerrainMult = attackerCaps.atkPenalty
  const defTerrainMult = defenderCaps.defBonus
  const precisionMult =
    phase === 'ranged' ? distancePrecision(distance, aStats.range, aStats.minRange) : 1.0
  const attackerMoraleMult = 1 + moraleCombatBonus(attacker) / 100
  const defenderMoraleMult = 1 + moraleCombatBonus(defender) / 100

  const power =
    menEngagedAttacker * baseAttackFactor * matchupCoef * chargeMult
    * atkTerrainMult * precisionMult * attackerMoraleMult
  const resistance =
    menEngagedDefender * baseDefenseFactor * defTerrainMult * defenderMoraleMult

  // Phase 2.5 : plancher d'attrition proportionnel aux hommes engagés (mirror src v1.1)
  const attackPossible =
    baseAttackFactor > 0 && matchupCoef > 0 && (phase !== 'ranged' || precisionMult > 0)
  const attritionRate = config.baseAttritionRate ?? DEFAULT_BASE_ATTRITION_RATE
  const baseAttrition = Math.max(1, Math.round(menEngagedAttacker * attritionRate))
  const damageRawNoFloor = Math.max(0, power - resistance)
  const damageRaw = attackPossible ? Math.max(baseAttrition, damageRawNoFloor) : damageRawNoFloor

  const rollRaw = rng()
  const variance = config.diceVariance.low + rollRaw * config.diceVariance.range
  const damageFinal = attackPossible
    ? Math.max(baseAttrition, Math.round(damageRaw * variance))
    : Math.max(0, Math.round(damageRaw * variance))

  const menLost = Math.min(damageFinal, defender.effective)
  const split = splitCasualties(menLost, defender.effective)
  const defenderEffectiveAfter = defender.effective - split.actualDamage
  const defenderWoundedAfter = defender.wounded + split.woundedAdd

  const ratioAfter = defender.effectiveMax > 0 ? defenderEffectiveAfter / defender.effectiveMax : 0
  const defenderHpAfter = Math.max(0, Math.round(ratioAfter * defender.hpMax))

  const attackerMoraleDelta = phase === 'ranged' ? 1 : 2
  const defenderMoraleDelta = -Math.round(split.actualDamage / (phase === 'ranged' ? 6 : 4))

  const attackerAfter = applyMoraleDelta(attacker, attackerMoraleDelta)
  const defenderAfter = applyMoraleDelta(defender, defenderMoraleDelta)

  const defenderKilled = defenderEffectiveAfter <= defender.effectiveMin

  const breakdown: BonusBreakdownEntry[] = [
    { label: `${phase === 'ranged' ? 'TIR' : 'ATK'} base`, multiplier: baseAttackFactor, appliedTo: 'attacker' },
    { label: describeMatchup(attacker.kind, defender.kind), multiplier: matchupCoef, appliedTo: 'attacker' },
  ]
  if (chargeMult !== 1.0) breakdown.push({ label: 'Charge cav', multiplier: chargeMult, appliedTo: 'attacker' })
  if (atkTerrainMult !== 1.0) breakdown.push({ label: `Terrain attaque (${attackerTerrain})`, multiplier: atkTerrainMult, appliedTo: 'attacker' })
  if (precisionMult !== 1.0 && phase === 'ranged') breakdown.push({ label: `Distance ${distance}/${aStats.range}`, multiplier: precisionMult, appliedTo: 'attacker' })
  if (attackerMoraleMult !== 1.0) breakdown.push({ label: 'Moral attaquant', multiplier: attackerMoraleMult, appliedTo: 'attacker' })
  breakdown.push({ label: 'DEF base', multiplier: baseDefenseFactor, appliedTo: 'defender' })
  if (defTerrainMult !== 1.0) breakdown.push({ label: `Terrain defense (${defenderTerrain})`, multiplier: defTerrainMult, appliedTo: 'defender' })
  if (defenderMoraleMult !== 1.0) breakdown.push({ label: 'Moral defenseur', multiplier: defenderMoraleMult, appliedTo: 'defender' })
  breakdown.push({ label: 'Variance dé', multiplier: variance, appliedTo: 'attacker' })

  return {
    damageDealt: damageFinal,
    actualDamage: split.actualDamage,
    killed: split.killed,
    woundedAdd: split.woundedAdd,
    defenderHpAfter,
    defenderWoundedAfter,
    attackerMoraleDelta,
    defenderMoraleDelta,
    attackerMoraleAfter: attackerAfter.morale,
    defenderMoraleAfter: defenderAfter.morale,
    attackerRouted: attackerAfter.routed,
    defenderRouted: defenderAfter.routed,
    defenderKilled,
    rollUsed: rollRaw,
    attackPhase: phase,
    attackerEffectiveBefore: attacker.effective,
    attackerEffectiveAfter: attacker.effective,
    defenderEffectiveBefore: defender.effective,
    defenderEffectiveAfter,
    menEngagedAttacker,
    menEngagedDefender,
    contactCap,
    bonusBreakdown: Object.freeze(breakdown),
    chargeBonusApplied: chargeMult !== 1.0,
  }
}
