// v1.0 (10/05/2026) — Phase 2 2A.10 : preview combat v2 (breakdown sans rng pour UI)
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.10

import { TERRAIN_CAPS } from '../../terrain/caps'
import type { TerrainType } from '../../terrain/types'
import { resolveUnitStatsV2 } from '../../units/stats'
import type { UnitState } from '../../units/types'
import { moraleCombatBonus } from '../../morale/morale'
import { KILLED_RATIO } from '../types'
import { distancePrecision } from './distance'
import { describeMatchup, getMatchupCoef } from './matchup'
import type { AttackPhase, BonusBreakdownEntry, CombatConfig } from './types'
import { DEFAULT_COMBAT_CONFIG } from './types'

export interface PreviewInput {
  readonly attacker: UnitState
  readonly defender: UnitState
  readonly phase: AttackPhase
  readonly attackerTerrain: TerrainType
  readonly defenderTerrain: TerrainType
  readonly distance: number
  readonly chargeMult: number
  readonly config?: CombatConfig
}

export interface PreviewResultV2 {
  readonly estimatedDamageMin: number
  readonly estimatedDamageMax: number
  readonly estimatedKilledMin: number
  readonly estimatedKilledMax: number
  readonly estimatedWoundedMin: number
  readonly estimatedWoundedMax: number
  readonly menEngagedAttacker: number
  readonly menEngagedDefender: number
  readonly contactCap: number
  readonly bonusBreakdown: ReadonlyArray<BonusBreakdownEntry>
}

/**
 * Preview combat v2 : retourne un intervalle [min, max] de degats / pertes
 * sans consommer de rng. Variance bornee par diceVariance (0.85 → 1.15 par defaut).
 *
 * Aligne sur resolveContact (contact.ts) pour que UI reflete fidelement le moteur.
 */
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
    menEngagedAttacker
    * baseAttackFactor
    * matchupCoef
    * chargeMult
    * atkTerrainMult
    * precisionMult
    * attackerMoraleMult

  const resistance =
    menEngagedDefender
    * baseDefenseFactor
    * defTerrainMult
    * defenderMoraleMult

  const attackPossible =
    baseAttackFactor > 0 && matchupCoef > 0 && (phase !== 'ranged' || precisionMult > 0)
  const damageRawNoFloor = Math.max(0, power - resistance)
  const damageRaw = attackPossible ? Math.max(1, damageRawNoFloor) : damageRawNoFloor

  // Bornes variance : low → low+range
  const varianceLow = config.diceVariance.low
  const varianceHigh = config.diceVariance.low + config.diceVariance.range

  let damageMinFloat = damageRaw * varianceLow
  let damageMaxFloat = damageRaw * varianceHigh
  // Plancher 1 sur les bornes si attack possible (cohérent avec contact.ts)
  if (attackPossible) {
    damageMinFloat = Math.max(1, damageMinFloat)
    damageMaxFloat = Math.max(1, damageMaxFloat)
  }
  const damageMin = Math.round(damageMinFloat)
  const damageMax = Math.round(damageMaxFloat)

  // Pertes plafonnees par effective defenseur
  const lostMin = Math.min(damageMin, defender.effective)
  const lostMax = Math.min(damageMax, defender.effective)

  // Split casualties
  const killedMin = Math.round(lostMin * KILLED_RATIO)
  const killedMax = Math.round(lostMax * KILLED_RATIO)
  const woundedMin = lostMin - killedMin
  const woundedMax = lostMax - killedMax

  // Breakdown (sans rng → sans entrée variance)
  const breakdown: BonusBreakdownEntry[] = [
    { label: `${phase === 'ranged' ? 'TIR' : 'ATK'} base`, multiplier: baseAttackFactor, appliedTo: 'attacker' },
    { label: describeMatchup(attacker.kind, defender.kind), multiplier: matchupCoef, appliedTo: 'attacker' },
  ]
  if (chargeMult !== 1.0) {
    breakdown.push({ label: 'Charge cav', multiplier: chargeMult, appliedTo: 'attacker' })
  }
  if (atkTerrainMult !== 1.0) {
    breakdown.push({ label: `Terrain attaque (${attackerTerrain})`, multiplier: atkTerrainMult, appliedTo: 'attacker' })
  }
  if (precisionMult !== 1.0 && phase === 'ranged') {
    breakdown.push({ label: `Distance ${distance}/${aStats.range}`, multiplier: precisionMult, appliedTo: 'attacker' })
  }
  if (attackerMoraleMult !== 1.0) {
    breakdown.push({ label: 'Moral attaquant', multiplier: attackerMoraleMult, appliedTo: 'attacker' })
  }
  breakdown.push({ label: 'DEF base', multiplier: baseDefenseFactor, appliedTo: 'defender' })
  if (defTerrainMult !== 1.0) {
    breakdown.push({ label: `Terrain defense (${defenderTerrain})`, multiplier: defTerrainMult, appliedTo: 'defender' })
  }
  if (defenderMoraleMult !== 1.0) {
    breakdown.push({ label: 'Moral defenseur', multiplier: defenderMoraleMult, appliedTo: 'defender' })
  }

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
