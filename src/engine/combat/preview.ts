// v1.2 (10/05/2026) — Phase 1.5 : MIN_DAMAGE = 1 dans bornes preview (aligne avec resolveMelee/Ranged)
// v1.1 (10/05/2026) — Phase 1.5 : ajout bornes killed/woundedAdd dans CombatPreview
// v1.0 (09/05/2026) — Phase 1 L1A.3 : preview combat (UI A5)
// Source : PLAN-PHASE-1.md § 2.2 (engine/combat/preview.ts)
// Pas de rng : retourne juste les bornes du roll. Appele cote client uniquement.

import type { UnitState } from '../units/types'
import { getUnitStats } from '../units/stats'
import { moraleCombatBonus } from '../morale/morale'
import { KILLED_RATIO, type CombatModifiers } from './types'

const ROLL_RANGE_MELEE = 20
const ROLL_RANGE_RANGED = 30
const FLANK_BONUS = 10
/** Plancher de degats : un combat reel cause toujours ≥ 1 perte (cf melee.ts/ranged.ts MIN_DAMAGE). */
const MIN_DAMAGE = 1

export interface CombatPreview {
  readonly damageMin: number
  readonly damageMax: number
  /** Bornes de soldats tues (definitif) — round(actualDamage * KILLED_RATIO). */
  readonly killedMin: number
  readonly killedMax: number
  /** Bornes de soldats blesses ajoutes — actualDamage - killed. */
  readonly woundedAddMin: number
  readonly woundedAddMax: number
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
  const damageMin = Math.max(MIN_DAMAGE, Math.round(atkEff - defEff + rollMin))
  const damageMax = Math.max(MIN_DAMAGE, Math.round(atkEff - defEff + rollMax))

  // Bornes effectives clamp sur defender.hp (un dead n'est blesse qu'une fois)
  const actualMin = Math.min(damageMin, defender.hp)
  const actualMax = Math.min(damageMax, defender.hp)
  const killedMin = Math.round(actualMin * KILLED_RATIO)
  const killedMax = Math.round(actualMax * KILLED_RATIO)
  const woundedAddMin = actualMin - killedMin
  const woundedAddMax = actualMax - killedMax

  const killProbability = damageMin >= defender.hp ? 1 : (damageMax >= defender.hp ? 0.5 : 0)
  return { damageMin, damageMax, killedMin, killedMax, woundedAddMin, woundedAddMax, killProbability }
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
