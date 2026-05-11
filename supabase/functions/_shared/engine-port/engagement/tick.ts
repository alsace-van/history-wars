// v1.0 (11/05/2026) — Phase 2.6 Vague B : port engagement/tick pour Deno
// Source de verite : src/engine/engagement/tick.ts. Duplication controlee (piege #12).

import type { SupportCount } from '../cohesion/types.ts'
import { splitCasualties } from '../combat/types.ts'
import { getMatchupCoef } from '../combat/v2/matchup.ts'
import { DEFAULT_BASE_ATTRITION_RATE, DEFAULT_COMBAT_CONFIG, type CombatConfig } from '../combat/v2/types.ts'
import { applyMoraleDelta, moraleCombatBonus, moraleCombatLossMultiplier } from '../morale/index.ts'
import { TERRAIN_CAPS } from '../terrain/caps.ts'
import type { TerrainType } from '../terrain/types.ts'
import { resolveUnitStatsV2 } from '../units.ts'
import type { UnitState } from '../units.ts'
import {
  ENGAGEMENT_MORALE_DELTA_PER_TURN,
  ENGAGEMENT_VARIANCE_LOW,
  ENGAGEMENT_VARIANCE_RANGE,
  RESERVE_RELIEF_RATE,
  type EngagementDissolutionReason,
  type EngagementSideResult,
  type EngagementTickInput,
  type EngagementTickResult,
} from './types.ts'

function computeAttritionDamage(
  attacker: UnitState,
  defender: UnitState,
  terrain: TerrainType,
  rng: () => number,
  config: CombatConfig,
): { rawDamage: number; rollUsed: number } {
  const aStats = resolveUnitStatsV2(attacker.kind, attacker.subKind)
  const dStats = resolveUnitStatsV2(defender.kind, defender.subKind)

  const caps = TERRAIN_CAPS[terrain]
  const contactCap = caps.contactCap
  const menEngagedAttacker = Math.min(attacker.effective, contactCap)
  const menEngagedDefender = Math.min(defender.effective, contactCap)

  const matchupCoef = getMatchupCoef(attacker.kind, defender.kind, 'melee', config)

  const attackerMoraleMult = 1 + moraleCombatBonus(attacker) / 100
  const defenderMoraleMult = 1 + moraleCombatBonus(defender) / 100

  const power =
    menEngagedAttacker
    * aStats.attack
    * matchupCoef
    * caps.atkPenalty
    * attackerMoraleMult

  const resistance =
    menEngagedDefender
    * dStats.defense
    * caps.defBonus
    * defenderMoraleMult

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

  return { rawDamage: damageFinal, rollUsed: rollRaw }
}

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
    routedAfter: unitAfter.routed,
    dissolved,
    rollUsed,
  }
}

export function resolveEngagementTick(input: EngagementTickInput): EngagementTickResult {
  const config = input.config ?? DEFAULT_COMBAT_CONFIG
  const caps = TERRAIN_CAPS[input.terrain]
  const contactCap = caps.contactCap

  const aToB = computeAttritionDamage(input.sideA, input.sideB, input.terrain, input.rng, config)
  const bToA = computeAttritionDamage(input.sideB, input.sideA, input.terrain, input.rng, config)

  const resultA = applyAttritionToSide(input.sideA, bToA.rawDamage, contactCap, input.supportA, bToA.rollUsed)
  const resultB = applyAttritionToSide(input.sideB, aToB.rawDamage, contactCap, input.supportB, aToB.rollUsed)

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
