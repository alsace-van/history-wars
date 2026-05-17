// v1.3 (16/05/2026) — Phase 2.6 : from_charge → malus defense ×0.8 + attrition ×1.3 côté cavalerie (mirror src v1.3)
// v1.2 (14/05/2026) — Phase 3.3 : bonus défensif hold appliqué côté receveur (préparation + terrain doublé)
// v1.1 (13/05/2026) — Phase 3.2-bis : réduction dégâts côté dominant (mirror src v1.1)
// v1.0 (11/05/2026) — Phase 2.6 Vague B : port engagement/tick pour Deno
// Source de verite : src/engine/engagement/tick.ts. Duplication controlee (piege #12).

import type { SupportCount } from '../cohesion/types.ts'
import { splitCasualties } from '../combat/types.ts'
import { getMatchupCoef } from '../combat/v2/matchup.ts'
import { DEFAULT_BASE_ATTRITION_RATE, DEFAULT_COMBAT_CONFIG, type CombatConfig } from '../combat/v2/types.ts'
import { applyMoraleDelta, computeRouted, moraleCombatBonus, moraleCombatLossMultiplier } from '../morale/index.ts'
import { TERRAIN_CAPS } from '../terrain/caps.ts'
import type { TerrainType } from '../terrain/types.ts'
import { resolveUnitStatsV2 } from '../units.ts'
import type { UnitState } from '../units.ts'
import {
  DOMINANCE_DAMAGE_FLOOR,
  ENGAGEMENT_MORALE_DELTA_PER_TURN,
  ENGAGEMENT_VARIANCE_LOW,
  ENGAGEMENT_VARIANCE_RANGE,
  FROM_CHARGE_ATTRITION_MULT,
  FROM_CHARGE_DEFENSE_MULT,
  RESERVE_RELIEF_RATE,
  type EngagementDissolutionReason,
  type EngagementSideResult,
  type EngagementTickInput,
  type EngagementTickResult,
} from './types.ts'

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
  /** Phase 2.6 — true si le défenseur est une cavalerie pinnée via charge_stay. */
  defenderFromCharge = false,
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

  // Phase 2.6 — malus défense cavalerie pinnée après charge_stay.
  const fromChargeDefenseMult = defenderFromCharge ? FROM_CHARGE_DEFENSE_MULT : 1.0

  const resistance =
    menEngagedDefender
    * dStats.defense
    * holdDefenseMult
    * defTerrainMult
    * defenderMoraleMult
    * fromChargeDefenseMult

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

  // Phase 3.2-bis : damageNoFloor pour calcul de dominance dans resolveEngagementTick.
  const damageNoFloor = Math.max(0, Math.round(damageRawNoFloor * variance))

  return { rawDamage: damageFinal, rollUsed: rollRaw, damageNoFloor }
}

function applyAttritionToSide(
  unit: UnitState,
  damageRaw: number,
  contactCap: number,
  support: SupportCount | undefined,
  rollUsed: number,
  /** Phase 2.6 — true si l'unité est une cavalerie pinnée via charge_stay. */
  fromCharge = false,
): EngagementSideResult {
  const menEngagedBefore = Math.min(unit.effective, contactCap)
  const reserveCap = Math.max(0, unit.effective - menEngagedBefore)
  const reliefCap = Math.round(reserveCap * RESERVE_RELIEF_RATE)
  const absorbCapacity = menEngagedBefore + reliefCap

  // Phase 2.6 — multiplicateur attrition cavalerie pinnée (avant clamp).
  const damageAmplified = fromCharge
    ? Math.round(damageRaw * FROM_CHARGE_ATTRITION_MULT)
    : damageRaw
  const adjustedDamage = Math.min(damageAmplified, absorbCapacity)

  const split = splitCasualties(adjustedDamage, unit.effective)
  const effectiveAfter = unit.effective - split.actualDamage
  const menEngagedAfter = Math.min(effectiveAfter, contactCap)

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
    // Phase 3.2-bis : routed depuis effectif POST-tick.
    routedAfter: computeRouted(effectiveAfter, unit.effectiveMax),
    dissolved,
    rollUsed,
  }
}

export function resolveEngagementTick(input: EngagementTickInput): EngagementTickResult {
  const config = input.config ?? DEFAULT_COMBAT_CONFIG
  const caps = TERRAIN_CAPS[input.terrain]
  const contactCap = caps.contactCap

  // Phase 2.6 — flag from_charge appliqué uniquement aux cavaleries.
  const fromCharge = input.fromCharge === true
  const aIsCav = fromCharge && input.sideA.kind === 'C'
  const bIsCav = fromCharge && input.sideB.kind === 'C'

  const aToB = computeAttritionDamage(input.sideA, input.sideB, input.terrain, input.rng, config, input.onHoldB, bIsCav)
  const bToA = computeAttritionDamage(input.sideB, input.sideA, input.terrain, input.rng, config, input.onHoldA, aIsCav)

  // Phase 3.2-bis : réduction côté dominant (cf. src/engine/engagement/tick.ts v1.1).
  const eps = 1
  const dominanceA = (aToB.damageNoFloor + eps) / (bToA.damageNoFloor + eps)
  const reductionA = Math.max(DOMINANCE_DAMAGE_FLOOR, Math.min(1, 1 / dominanceA))
  const reductionB = Math.max(DOMINANCE_DAMAGE_FLOOR, Math.min(1, dominanceA))
  const damageToA = Math.round(bToA.rawDamage * reductionA)
  const damageToB = Math.round(aToB.rawDamage * reductionB)

  const resultA = applyAttritionToSide(input.sideA, damageToA, contactCap, input.supportA, bToA.rollUsed, aIsCav)
  const resultB = applyAttritionToSide(input.sideB, damageToB, contactCap, input.supportB, aToB.rollUsed, bIsCav)

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
