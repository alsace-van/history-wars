// v1.0 (10/05/2026) — Phase 2 2C.1 : port combat/v2/types pour Deno
// Source de verite : src/engine/combat/v2/types.ts. Duplication controlee (piege #12).

import type { UnitKind } from '../../../types.ts'

export type AttackPhase = 'melee' | 'ranged' | 'charge'

export interface BonusBreakdownEntry {
  label: string
  multiplier: number
  appliedTo: 'attacker' | 'defender'
}

export interface CombatResultV2 {
  // v1 hérités
  damageDealt: number
  actualDamage: number
  killed: number
  woundedAdd: number
  defenderHpAfter: number
  defenderWoundedAfter: number
  attackerMoraleDelta: number
  defenderMoraleDelta: number
  attackerMoraleAfter: number
  defenderMoraleAfter: number
  attackerRouted: boolean
  defenderRouted: boolean
  defenderKilled: boolean
  rollUsed: number
  // v2
  attackPhase: AttackPhase
  attackerEffectiveBefore: number
  attackerEffectiveAfter: number
  defenderEffectiveBefore: number
  defenderEffectiveAfter: number
  menEngagedAttacker: number
  menEngagedDefender: number
  contactCap: number
  bonusBreakdown: ReadonlyArray<BonusBreakdownEntry>
  chargeBonusApplied: boolean
}

export interface CombatConfig {
  diceVariance: { low: number; range: number }
  chargeMultipliers: { two: number; three: number; fourPlus: number }
  moraleThresholds: { rout: number; test: number }
  matchupMatrix: Record<AttackPhase, Record<UnitKind, Record<UnitKind, number>>>
  /** Phase 2.5 : plancher d'attrition naturelle (fraction des hommes engagés). Default 0.08. */
  baseAttritionRate?: number
}

export const DEFAULT_BASE_ATTRITION_RATE = 0.08

export const DEFAULT_COMBAT_CONFIG: CombatConfig = Object.freeze({
  diceVariance: Object.freeze({ low: 0.85, range: 0.30 }),
  chargeMultipliers: Object.freeze({ two: 1.3, three: 1.4, fourPlus: 1.5 }),
  moraleThresholds: Object.freeze({ rout: 25, test: 30 }),
  baseAttritionRate: DEFAULT_BASE_ATTRITION_RATE,
  matchupMatrix: Object.freeze({
    melee: Object.freeze({
      I: Object.freeze({ I: 1.0, C: 1.1, A: 1.5 }),
      C: Object.freeze({ I: 0.9, C: 1.0, A: 1.5 }),
      A: Object.freeze({ I: 0.5, C: 0.5, A: 1.0 }),
    }),
    ranged: Object.freeze({
      I: Object.freeze({ I: 0.8, C: 0.7, A: 0.9 }),
      C: Object.freeze({ I: 0.5, C: 0.5, A: 0.5 }),
      A: Object.freeze({ I: 1.0, C: 0.7, A: 1.5 }),
    }),
    charge: Object.freeze({
      I: Object.freeze({ I: 1.0, C: 1.0, A: 1.0 }),
      // Phase 2.5 balance 11/05/2026 — nerf C→I charge 1.5 → 1.2 (cf src/engine/combat/v2/types.ts).
      C: Object.freeze({ I: 1.2, C: 1.1, A: 1.5 }),
      A: Object.freeze({ I: 1.0, C: 1.0, A: 1.0 }),
    }),
  }),
}) as CombatConfig
