// v1.0 (10/05/2026) — Phase 2 2C.1 : port combat/v2/preview pour Deno
// Source de verite : src/engine/combat/v2/preview.ts. Duplication controlee (piege #12).

import { TERRAIN_CAPS } from '../../terrain/caps.ts'
import type { TerrainType } from '../../terrain/types.ts'
import { resolveUnitStatsV2, type UnitState } from '../../units.ts'
import { moraleCombatBonus } from '../../morale/morale.ts'
import { KILLED_RATIO } from '../types.ts'
import { distancePrecision } from './distance.ts'
import { describeMatchup, getMatchupCoef } from './matchup.ts'
import type { AttackPhase, BonusBreakdownEntry, CombatConfig } from './types.ts'
import { DEFAULT_BASE_ATTRITION_RATE, DEFAULT_COMBAT_CONFIG } from './types.ts'

export interface PreviewInput {
  attacker: UnitState
  defender: UnitState
  phase: AttackPhase
  attackerTerrain: TerrainType
  defenderTerrain: TerrainType
  distance: number
  chargeMult: number
  config?: CombatConfig
}

export interface PreviewResultV2 {
  estimatedDamageMin: number
  estimatedDamageMax: number
  estimatedKilledMin: number
  estimatedKilledMax: number
  estimatedWoundedMin: number
  estimatedWoundedMax: number
  menEngagedAttacker: number
  menEngagedDefender: number
  contactCap: number
  bonusBreakdown: ReadonlyArray<BonusBreakdownEntry>
}

export function previewCombatV2(input: PreviewInput): PreviewResultV2 {
  const config = input.config ?? DEFAULT_COMBAT_CONFIG
  const { attacker, defender, phase, attackerTerrain, defenderTerrain, distance, chargeMult } = input

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

  // Phase 2.5 : bornes preview ≥ baseAttrition (mirror contact.ts v1.1)
  const attackPossible =
    baseAttackFactor > 0 && matchupCoef > 0 && (phase !== 'ranged' || precisionMult > 0)
  const attritionRate = config.baseAttritionRate ?? DEFAULT_BASE_ATTRITION_RATE
  const baseAttrition = Math.max(1, Math.round(menEngagedAttacker * attritionRate))
  const damageRawNoFloor = Math.max(0, power - resistance)
  const damageRaw = attackPossible ? Math.max(baseAttrition, damageRawNoFloor) : damageRawNoFloor

  const varianceLow = config.diceVariance.low
  const varianceHigh = config.diceVariance.low + config.diceVariance.range
  let damageMinFloat = damageRaw * varianceLow
  let damageMaxFloat = damageRaw * varianceHigh
  if (attackPossible) {
    damageMinFloat = Math.max(baseAttrition, damageMinFloat)
    damageMaxFloat = Math.max(baseAttrition, damageMaxFloat)
  }
  const damageMin = Math.round(damageMinFloat)
  const damageMax = Math.round(damageMaxFloat)

  const lostMin = Math.min(damageMin, defender.effective)
  const lostMax = Math.min(damageMax, defender.effective)
  const killedMin = Math.round(lostMin * KILLED_RATIO)
  const killedMax = Math.round(lostMax * KILLED_RATIO)
  const woundedMin = lostMin - killedMin
  const woundedMax = lostMax - killedMax

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

  return {
    estimatedDamageMin: damageMin,
    estimatedDamageMax: damageMax,
    estimatedKilledMin: killedMin,
    estimatedKilledMax: killedMax,
    estimatedWoundedMin: woundedMin,
    estimatedWoundedMax: woundedMax,
    menEngagedAttacker,
    menEngagedDefender,
    contactCap,
    bonusBreakdown: Object.freeze(breakdown),
  }
}
