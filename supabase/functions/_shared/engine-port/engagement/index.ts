// v1.0 (11/05/2026) — Phase 2.6 Vague B : barrel engagement engine-port Deno
// Source de verite : src/engine/engagement/index.ts. Duplication controlee (piege #12).

import { splitCasualties } from '../combat/types.ts'
import type { UnitState } from '../units.ts'
import {
  BREAK_COMBAT_COST_RATIO,
  type BreakCombatResult,
  type EngagementId,
  type EngagementState,
} from './types.ts'

export type {
  BreakCombatResult,
  EngagementDissolutionReason,
  EngagementId,
  EngagementSideResult,
  EngagementState,
  EngagementTickInput,
  EngagementTickResult,
} from './types.ts'
export {
  BREAK_COMBAT_COST_RATIO,
  ENGAGEMENT_MORALE_DELTA_PER_TURN,
  ENGAGEMENT_VARIANCE_LOW,
  ENGAGEMENT_VARIANCE_RANGE,
  RESERVE_RELIEF_RATE,
} from './types.ts'
export { resolveEngagementTick } from './tick.ts'

export function startEngagement(
  unitA: UnitState,
  unitB: UnitState,
  currentTurn: number,
  gameId: string,
  options?: { id?: EngagementId },
): EngagementState {
  if (unitA.id === unitB.id) {
    throw new Error('startEngagement: cannot engage a unit with itself')
  }
  if (unitA.team === unitB.team) {
    throw new Error('startEngagement: units must be on opposing teams')
  }
  return {
    id: options?.id ?? '',
    gameId,
    unitAId: unitA.id,
    unitBId: unitB.id,
    startedTurn: currentTurn,
  }
}

export function breakCombat(unit: UnitState): BreakCombatResult {
  const rawLoss = Math.round(unit.effective * BREAK_COMBAT_COST_RATIO)
  const minLoss = unit.effective > 0 ? Math.max(1, rawLoss) : 0
  const maxLoss = Math.max(0, unit.effective - unit.effectiveMin)
  const finalLoss = Math.min(minLoss, maxLoss)

  const split = splitCasualties(finalLoss, unit.effective)
  const effectiveAfter = unit.effective - split.actualDamage
  const woundedAfter = unit.wounded + split.woundedAdd

  const ratioAfter = unit.effectiveMax > 0 ? effectiveAfter / unit.effectiveMax : 0
  const hpAfter = Math.max(0, Math.round(ratioAfter * unit.hpMax))

  return {
    unitAfter: {
      ...unit,
      effective: effectiveAfter,
      wounded: woundedAfter,
      hp: hpAfter,
      killed: unit.killed + split.killed,
      hasMoved: true,
      hasAttacked: true,
    },
    actualDamage: split.actualDamage,
    killed: split.killed,
    woundedAdd: split.woundedAdd,
  }
}

export function isEngagedWith(
  unitId: string,
  engagements: ReadonlyArray<EngagementState>,
): ReadonlyArray<EngagementState> {
  return engagements.filter(e => e.unitAId === unitId || e.unitBId === unitId)
}

export function getEngagementOpponent(
  engagement: EngagementState,
  selfId: string,
): string | null {
  if (engagement.unitAId === selfId) return engagement.unitBId
  if (engagement.unitBId === selfId) return engagement.unitAId
  return null
}

/**
 * Helper Deno : normalise une paire (unitAId, unitBId) en ordre lexicographique.
 * Respecte la contrainte CHECK engagements_pair_order de la migration 017
 * (uuid_a < uuid_b stringwise). Indispensable AVANT tout INSERT pour ne pas
 * dupliquer une paire (A,B) déjà stockée sous (B,A).
 */
export function normalizePair(idA: string, idB: string): { unitAId: string; unitBId: string } {
  return idA < idB
    ? { unitAId: idA, unitBId: idB }
    : { unitAId: idB, unitBId: idA }
}
