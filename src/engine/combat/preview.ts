// v1.0 (09/05/2026) — Phase 1 L1A.3 : preview combat (UI A5)
// Source : PLAN-PHASE-1.md § 2.2 (engine/combat/preview.ts)
// Pas de rng : retourne juste les bornes du roll. Appele cote client uniquement.

import type { UnitState } from '../units/types'
import { getUnitStats } from '../units/stats'
import { moraleCombatBonus } from '../morale/morale'
import type { CombatModifiers } from './types'

const ROLL_RANGE_MELEE = 20
const ROLL_RANGE_RANGED = 30
const FLANK_BONUS = 10

export interface CombatPreview {
  readonly damageMin: number
  readonly damageMax: number
  readonly killProbability: number  // 0 ou 1 grossier (max >= hp ou min >= hp)
}

function buildPreview(
  attacker: UnitState,
  defender: UnitState,
  atkBase: number,
  defBase: number,
  flankBonus: number,
  rollRange: number,
): CombatPreview {
  const atkEff = atkBase + flankBonus + moraleCombatBonus(attacker)
  const defEff = defBase + moraleCombatBonus(defender)
  const rollMin = -rollRange / 2
  const rollMax = rollRange / 2
  const damageMin = Math.max(0, Math.round(atkEff - defEff + rollMin))
  const damageMax = Math.max(0, Math.round(atkEff - defEff + rollMax))
  const killProbability = damageMin >= defender.hp ? 1 : (damageMax >= defender.hp ? 0.5 : 0)
  return { damageMin, damageMax, killProbability }
}

export function previewMelee(
  attacker: UnitState,
  defender: UnitState,
  modifiers: CombatModifiers,
): CombatPreview {
  const a = getUnitStats(attacker.kind)
  const d = getUnitStats(defender.kind)
  const flank = modifiers.flanked ? FLANK_BONUS : 0
  const defWithTerrain = d.defense + (modifiers.terrainDefBonus ?? 0)
  return buildPreview(attacker, defender, a.attack, defWithTerrain, flank, ROLL_RANGE_MELEE)
}

export function previewRanged(
  attacker: UnitState,
  defender: UnitState,
  modifiers: CombatModifiers,
): CombatPreview {
  const a = getUnitStats(attacker.kind)
  const d = getUnitStats(defender.kind)
  const defWithTerrain = d.defense + (modifiers.terrainDefBonus ?? 0)
  return buildPreview(attacker, defender, a.attack, defWithTerrain, 0, ROLL_RANGE_RANGED)
}
