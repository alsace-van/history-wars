// v1.0 (10/05/2026) — Phase 2 2A.6 : pipeline central calcul de degats par contact
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.6 + AUDIT § 3.6

import { applyMoraleDelta, moraleCombatBonus } from '../../morale/morale'
import { TERRAIN_CAPS } from '../../terrain/caps'
import type { TerrainType } from '../../terrain/types'
import { resolveUnitStatsV2 } from '../../units/stats'
import type { UnitState } from '../../units/types'
import { splitCasualties } from '../types'
import { distancePrecision } from './distance'
import { describeMatchup, getMatchupCoef } from './matchup'
import type { AttackPhase, BonusBreakdownEntry, CombatConfig, CombatResultV2 } from './types'
import { DEFAULT_COMBAT_CONFIG } from './types'

export interface ContactInput {
  readonly attacker: UnitState
  readonly defender: UnitState
  readonly phase: AttackPhase
  readonly attackerTerrain: TerrainType
  readonly defenderTerrain: TerrainType
  /** Distance entre attaquant et defenseur en hex (1 pour melee, 2-7 pour ranged). */
  readonly distance: number
  /** Multiplicateur de charge (1.0 si phase != 'charge'). Calcule par charge.ts. */
  readonly chargeMult: number
  readonly rng: () => number
  readonly config?: CombatConfig
}

/**
 * Resolution d'un coup unique attaquant → defenseur. Le caller orchestre la riposte.
 *
 * Pipeline (cf. AUDIT § 3.6) :
 *   1. Hommes engages = min(effective, contactCap_terrain)
 *   2. Puissance attaquant = hommes_att × facteur_type × matchup × charge × terrain_atk × precision_dist
 *   3. Resistance defenseur = hommes_def × facteur_defense × terrain_def
 *   4. Degats bruts = max(0, puissance - resistance)
 *   5. Variance = × (0.85 + rng()*0.30)  → ±15 %
 *   6. Pertes hommes = round(degats) (resistance_humaine = 1)
 *   7. Update wounded/killed/morale defenseur
 *
 * Modificateurs moral combat appliques en bonus additif sur facteurs (pas multiplicatif)
 * pour rester proche du modele v1 et lisible dans le breakdown.
 */
export function resolveContact(input: ContactInput): CombatResultV2 {
  const config = input.config ?? DEFAULT_COMBAT_CONFIG
  const { attacker, defender, phase, attackerTerrain, defenderTerrain, distance, chargeMult, rng } = input

  const aStats = resolveUnitStatsV2(attacker.kind, attacker.subKind)
  const dStats = resolveUnitStatsV2(defender.kind, defender.subKind)

  const attackerCaps = TERRAIN_CAPS[attackerTerrain]
  const defenderCaps = TERRAIN_CAPS[defenderTerrain]
  // Plafond de saturation utilise = min des 2 (le terrain le plus restrictif gouverne)
  const contactCap = Math.min(attackerCaps.contactCap, defenderCaps.contactCap)

  const menEngagedAttacker = Math.min(attacker.effective, contactCap)
  const menEngagedDefender = Math.min(defender.effective, contactCap)

  // Facteur d'attaque selon la phase
  // - melee/charge : utilise UnitStatsV2.attack
  // - ranged       : utilise rangedPower (0 si l'unite ne tire pas → degats 0)
  const baseAttackFactor =
    phase === 'ranged' ? aStats.rangedPower : aStats.attack
  const baseDefenseFactor = dStats.defense

  // Matchup
  const matchupCoef = getMatchupCoef(attacker.kind, defender.kind, phase, config)

  // Modificateurs terrain
  const atkTerrainMult = attackerCaps.atkPenalty
  const defTerrainMult = defenderCaps.defBonus

  // Precision distance (1.0 si melee/charge ; calcul si ranged)
  const precisionMult =
    phase === 'ranged' ? distancePrecision(distance, aStats.range, aStats.minRange) : 1.0

  // Bonus moral additif sur facteurs unitaires (pas multiplicatif)
  // → on l'integre comme un coef multiplicatif normalise pour rester dans le breakdown lisible.
  // moraleCombatBonus retourne -15 / 0 / +5 (formule v1) → on map sur multiplicateur centre 1.0.
  const attackerMoraleBonus = moraleCombatBonus(attacker)  // -15, 0, +5
  const defenderMoraleBonus = moraleCombatBonus(defender)
  const attackerMoraleMult = 1 + attackerMoraleBonus / 100  // 0.85 / 1.00 / 1.05
  const defenderMoraleMult = 1 + defenderMoraleBonus / 100

  // Puissance offensive
  const power =
    menEngagedAttacker
    * baseAttackFactor
    * matchupCoef
    * chargeMult
    * atkTerrainMult
    * precisionMult
    * attackerMoraleMult

  // Resistance defensive
  const resistance =
    menEngagedDefender
    * baseDefenseFactor
    * defTerrainMult
    * defenderMoraleMult

  // Degats bruts. Plancher 1 si l'attaque est theoriquement capable de toucher
  // (cf. v1 melee MIN_DAMAGE_MELEE — un engagement valide tue toujours >= 1 soldat).
  // Pour ranged : seulement si precision > 0 (pas de plancher si distance impossible).
  const attackPossible =
    baseAttackFactor > 0 && matchupCoef > 0 && (phase !== 'ranged' || precisionMult > 0)
  const damageRawNoFloor = Math.max(0, power - resistance)
  const damageRaw = attackPossible ? Math.max(1, damageRawNoFloor) : damageRawNoFloor

  // Variance (rng() ∈ [0,1) → multi ∈ [low, low+range))
  const rollRaw = rng()
  const variance = config.diceVariance.low + rollRaw * config.diceVariance.range
  const damageFinal = attackPossible
    ? Math.max(1, Math.round(damageRaw * variance))
    : Math.max(0, Math.round(damageRaw * variance))

  // Pertes hommes (resistance humaine = 1)
  // Plafonne aux hommes engages defenseur (pas de pertes au-dela de l'effectif present au contact)
  const menLost = Math.min(damageFinal, defender.effective)

  // Mapping vers killed / woundedAdd via splitCasualties (60/40 par defaut Phase 1.5)
  // splitCasualties travaille sur hp v1 : on l'utilise sur effective pour cohérence.
  const split = splitCasualties(menLost, defender.effective)
  const defenderEffectiveAfter = defender.effective - split.actualDamage
  const defenderWoundedAfter = defender.wounded + split.woundedAdd

  // Mapping legacy hp pour rétrocompat consommateurs : ratio effective / effectiveMax → hp / hpMax
  const ratioAfter = defender.effectiveMax > 0 ? defenderEffectiveAfter / defender.effectiveMax : 0
  const defenderHpAfter = Math.max(0, Math.round(ratioAfter * defender.hpMax))

  // Morale
  const attackerMoraleDelta = phase === 'ranged' ? 1 : 2
  const defenderMoraleDelta = -Math.round(split.actualDamage / (phase === 'ranged' ? 6 : 4))

  const attackerAfter = applyMoraleDelta(attacker, attackerMoraleDelta)
  const defenderAfter = applyMoraleDelta(defender, defenderMoraleDelta)

  // Defender mort si effective tombe sous effectiveMin
  const defenderKilled = defenderEffectiveAfter <= defender.effectiveMin

  // Breakdown UI
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
    attackerEffectiveAfter: attacker.effective,   // updated par caller s'il y a riposte
    defenderEffectiveBefore: defender.effective,
    defenderEffectiveAfter,
    menEngagedAttacker,
    menEngagedDefender,
    contactCap,
    bonusBreakdown: Object.freeze(breakdown),
    chargeBonusApplied: chargeMult !== 1.0,
  }
}
