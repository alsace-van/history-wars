// v1.2 (14/05/2026) — Phase 3.3 : bonus défensif hold appliqué côté receveur (préparation + terrain doublé)
// v1.1 (13/05/2026) — Phase 3.2-bis : réduction dégâts subis côté dominant (récompense victoire tactique)
// v1.0 (11/05/2026) — Phase 2.6 Vague A : tick d'attrition continue (dégâts bilatéraux + relève 10%)
// Frontière engine/ : zéro React, zéro Three, zéro Supabase

import type { SupportCount } from '../cohesion/types'
import { splitCasualties } from '../combat/types'
import { getMatchupCoef } from '../combat/v2/matchup'
import { DEFAULT_BASE_ATTRITION_RATE, DEFAULT_COMBAT_CONFIG, type CombatConfig } from '../combat/v2/types'
import { applyMoraleDelta, computeRouted, moraleCombatBonus, moraleCombatLossMultiplier } from '../morale/morale'
import { TERRAIN_CAPS } from '../terrain/caps'
import type { TerrainType } from '../terrain/types'
import { resolveUnitStatsV2 } from '../units/stats'
import type { UnitState } from '../units/types'
import {
  DOMINANCE_DAMAGE_FLOOR,
  ENGAGEMENT_MORALE_DELTA_PER_TURN,
  ENGAGEMENT_VARIANCE_LOW,
  ENGAGEMENT_VARIANCE_RANGE,
  RESERVE_RELIEF_RATE,
  type EngagementSideResult,
  type EngagementTickInput,
  type EngagementTickResult,
  type EngagementDissolutionReason,
} from './types'

/**
 * Calcule les dégâts bruts qu'inflige `attacker` à `defender` pour un tick.
 *
 * Pipeline (simplifié vs resolveContact Phase 2) :
 *   1. menEngaged = min(effective, contactCap_terrain)
 *   2. power      = menEngagedAtk × stats.attack × matchup × atkPenalty × moraleAtkMult
 *   3. resistance = menEngagedDef × stats.defense × defBonus × moraleDefMult
 *   4. damageRaw  = max(baseAttritionFloor, power - resistance)
 *   5. variance   = ±5 % via ENGAGEMENT_VARIANCE_*
 *
 * Hypothèses vs Phase 2 :
 *  - Phase = 'melee' implicite (pas de ranged / charge dans un engagement continu)
 *  - Pas de bonus charge (charge = ponctuelle Phase 2)
 *  - Variance ±5 % au lieu de ±15 %
 *  - Pas de breakdown UI (ajouté en vague C si besoin)
 *
 * Engagement = combat de ligne sur le même hex frontière, donc on suppose que
 * les 2 unités sont sur le **même type de terrain** (cf. caller resolveEngagementTick).
 */
/** Phase 3.3 — mirror contact.ts : préparation +15% + terrain doublé. */
const HOLD_BASE_DEFENSE_MULT = 1.15
const HOLD_TERRAIN_AMPLIFY = 2.0

function computeAttritionDamage(
  attacker: UnitState,
  defender: UnitState,
  terrain: TerrainType,
  rng: () => number,
  config: CombatConfig,
  defenderOnHold = false,
): { rawDamage: number; rollUsed: number; damageNoFloor: number } {
  const aStats = resolveUnitStatsV2(attacker.kind, attacker.subKind)
  const dStats = resolveUnitStatsV2(defender.kind, defender.subKind)

  const caps = TERRAIN_CAPS[terrain]
  const contactCap = caps.contactCap
  const menEngagedAttacker = Math.min(attacker.effective, contactCap)
  const menEngagedDefender = Math.min(defender.effective, contactCap)

  const matchupCoef = getMatchupCoef(attacker.kind, defender.kind, 'melee', config)

  const attackerMoraleMult = 1 + moraleCombatBonus(attacker) / 100
  const defenderMoraleMult = 1 + moraleCombatBonus(defender) / 100

  // Phase 3.3 — bonus terrain défensif doublé si défenseur en hold.
  const baseDefBonus = caps.defBonus
  const defTerrainMult = defenderOnHold
    ? 1.0 + (baseDefBonus - 1.0) * HOLD_TERRAIN_AMPLIFY
    : baseDefBonus
  const holdDefenseMult = defenderOnHold ? HOLD_BASE_DEFENSE_MULT : 1.0

  const power =
    menEngagedAttacker
    * aStats.attack
    * matchupCoef
    * caps.atkPenalty
    * attackerMoraleMult

  const resistance =
    menEngagedDefender
    * dStats.defense
    * holdDefenseMult
    * defTerrainMult
    * defenderMoraleMult

  // Plancher d'attrition naturelle (cf. contact.ts v1.1 — Phase 2.5 balance)
  const attackPossible = aStats.attack > 0 && matchupCoef > 0
  const attritionRate = config.baseAttritionRate ?? DEFAULT_BASE_ATTRITION_RATE
  const baseAttrition = Math.max(1, Math.round(menEngagedAttacker * attritionRate))
  const damageRawNoFloor = Math.max(0, power - resistance)
  const damageRaw = attackPossible ? Math.max(baseAttrition, damageRawNoFloor) : damageRawNoFloor

  const rollRaw = rng()
  const variance = ENGAGEMENT_VARIANCE_LOW + rollRaw * ENGAGEMENT_VARIANCE_RANGE
  const damageFinal = attackPossible
    ? Math.max(baseAttrition, Math.round(damageRaw * variance))
    : Math.max(0, Math.round(damageRaw * variance))

  // Phase 3.2-bis : damageNoFloor = dégâts purs (power - resistance) hors plancher.
  // Sert au calcul de dominance dans resolveEngagementTick (réduction côté gagnant).
  const damageNoFloor = Math.max(0, Math.round(damageRawNoFloor * variance))

  return { rawDamage: damageFinal, rollUsed: rollRaw, damageNoFloor }
}

/**
 * Applique les pertes brutes à une unité en tenant compte de la relève des réserves.
 *
 * Absorbtion (cf. plan § 2) :
 *   reserveCap     = max(0, effective - menEngaged)
 *   reliefCap      = round(reserveCap × RESERVE_RELIEF_RATE)   // 10 % réserve / tour
 *   absorbCapacity = menEngaged + reliefCap
 *   adjustedDamage = min(damageRaw, absorbCapacity)
 *
 * Interprétation : on ne peut tuer plus, en un tour, que les hommes au contact
 * **plus** 10 % de la réserve qui peut monter combler. Le surplus est ignoré
 * (modélise les vagues d'assaut qui s'épuisent au-delà de la capacité défensive).
 *
 * Effets moral :
 *   moraleCombatDelta = -round(actualDamage / 4)              // identique melee Phase 2
 *   modulé par moraleCombatLossMultiplier(support)
 *   + ENGAGEMENT_MORALE_DELTA_PER_TURN                        // -2 fatigue tour
 */
function applyAttritionToSide(
  unit: UnitState,
  damageRaw: number,
  contactCap: number,
  support: SupportCount | undefined,
  rollUsed: number,
): EngagementSideResult {
  const menEngagedBefore = Math.min(unit.effective, contactCap)
  const reserveCap = Math.max(0, unit.effective - menEngagedBefore)
  const reliefCap = Math.round(reserveCap * RESERVE_RELIEF_RATE)
  const absorbCapacity = menEngagedBefore + reliefCap
  const adjustedDamage = Math.min(damageRaw, absorbCapacity)

  const split = splitCasualties(adjustedDamage, unit.effective)
  const effectiveAfter = unit.effective - split.actualDamage
  const menEngagedAfter = Math.min(effectiveAfter, contactCap)

  // Moral : perte par pertes (modulée par soutien) + bonus fatigue tour engagé.
  const supportMult = support ? moraleCombatLossMultiplier(support) : 1.0
  const rawCombatDelta = -Math.round(split.actualDamage / 4)
  const moraleDelta = Math.round(rawCombatDelta * supportMult) + ENGAGEMENT_MORALE_DELTA_PER_TURN
  const unitAfter = applyMoraleDelta(unit, moraleDelta)

  const dissolved = effectiveAfter <= unit.effectiveMin

  return {
    unitId: unit.id,
    effectiveBefore: unit.effective,
    effectiveAfter,
    menEngagedBefore,
    menEngagedAfter,
    killed: split.killed,
    woundedAdd: split.woundedAdd,
    actualDamage: split.actualDamage,
    moraleBefore: unit.morale,
    moraleAfter: unitAfter.morale,
    moraleDelta,
    // Phase 3.2-bis : routed dérive de l'effectif POST-tick (pas du moral). On
    // recompute ici avec effectiveAfter — applyMoraleDelta a calculé routed sur
    // unit.effective pré-tick, ce qui sous-estime les déroutes.
    routedAfter: computeRouted(effectiveAfter, unit.effectiveMax),
    dissolved,
    rollUsed,
  }
}

/**
 * Résolution d'un tick d'engagement (1 par engagement actif, en fin de tour).
 *
 * Symétrie : on calcule les dégâts bilatéraux **à partir du snapshot d'avant tick**
 * (pas de sequence A puis B). Les 2 unités frappent simultanément, comme dans
 * une mêlée continue. Cohérent avec la modélisation napoléonienne du combat de
 * ligne.
 *
 * RNG : 2 rolls consommés (1 par côté). Le caller doit garantir un seed stable
 * pour le replay. Convention : on tire d'abord A→B puis B→A.
 *
 * Multi-engagement : si une unité est dans N engagements, le caller (resolve_turn)
 * appelle `resolveEngagementTick` N fois en passant l'unité telle qu'elle était
 * **au début du tour** (pas après chaque tick). Les pertes se cumulent côté BDD
 * via un UPDATE final. Voir plan § 6.
 */
export function resolveEngagementTick(input: EngagementTickInput): EngagementTickResult {
  const config = input.config ?? DEFAULT_COMBAT_CONFIG
  const caps = TERRAIN_CAPS[input.terrain]
  const contactCap = caps.contactCap

  // 1. Dégâts bilatéraux calculés sur le snapshot d'avant tick (symétrie)
  const aToB = computeAttritionDamage(input.sideA, input.sideB, input.terrain, input.rng, config, input.onHoldB)
  const bToA = computeAttritionDamage(input.sideB, input.sideA, input.terrain, input.rng, config, input.onHoldA)

  // 2. Phase 3.2-bis — réduction côté dominant. dominance = ratio damageNoFloor (A→B / B→A).
  //    Si A inflige bien plus de dégâts qu'il en reçoit, A est dominant tactique
  //    → ses pertes subies sont réduites de 1/dominanceA (clampé à DOMINANCE_DAMAGE_FLOOR).
  const eps = 1
  const dominanceA = (aToB.damageNoFloor + eps) / (bToA.damageNoFloor + eps)
  const reductionA = Math.max(DOMINANCE_DAMAGE_FLOOR, Math.min(1, 1 / dominanceA))
  const reductionB = Math.max(DOMINANCE_DAMAGE_FLOOR, Math.min(1, dominanceA))
  const damageToA = Math.round(bToA.rawDamage * reductionA)
  const damageToB = Math.round(aToB.rawDamage * reductionB)

  // 3. Application : sideA subit damageToA, sideB subit damageToB
  const resultA = applyAttritionToSide(input.sideA, damageToA, contactCap, input.supportA, bToA.rollUsed)
  const resultB = applyAttritionToSide(input.sideB, damageToB, contactCap, input.supportB, aToB.rollUsed)

  // 4. Dissolution
  const dissolved = resultA.dissolved || resultB.dissolved
  let dissolutionReason: EngagementDissolutionReason
  if (!dissolved) dissolutionReason = 'none'
  else if (resultA.dissolved && resultB.dissolved) dissolutionReason = 'both'
  else if (resultA.dissolved) dissolutionReason = 'sideA'
  else dissolutionReason = 'sideB'

  return {
    sideA: resultA,
    sideB: resultB,
    contactCap,
    terrain: input.terrain,
    dissolved,
    dissolutionReason,
    currentTurn: input.currentTurn,
  }
}
