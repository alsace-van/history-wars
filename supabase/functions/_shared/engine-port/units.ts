// v2.4 (14/05/2026) — Phase 3.3 : arcedTrajectory (obusier vs canon) — mirror src v2.5
// v2.3 (14/05/2026) — Phase 3.3 : split artillery_light/heavy + optimalRangeMax (mirror src v2.4)
// v2.2 (12/05/2026) — Merge : bonus moral +25 + recalcul routed (mirror src sizing v1.1)
// v2.1 (12/05/2026) — MVP tweak : C movement 6→4 + A range 7→6 (mirror src v2.2)
// Source de verite : src/engine/units/{stats.ts,types.ts,sizing.ts}. Duplication controlee (piege #12).

import type { UnitKind, Team } from '../types.ts'
import type { Cube } from './hex/index.ts'
import { cubeDistance } from './hex/index.ts'
import { computeRouted } from './morale/index.ts'

/** Bonus moral à la fusion (mirror src v1.1) — voir engine/units/sizing.ts. */
export const MERGE_MORALE_BONUS = 25

export interface UnitStats {
  hpMax: number
  attack: number
  defense: number
  range: number
  movement: number
  moraleMax: number
}

export const UNIT_STATS_BY_KIND: Record<UnitKind, UnitStats> = Object.freeze({
  I: Object.freeze({ hpMax: 100, attack: 25, defense: 30, range: 1, movement: 3, moraleMax: 100 }),
  C: Object.freeze({ hpMax:  80, attack: 35, defense: 20, range: 1, movement: 6, moraleMax: 100 }),
  A: Object.freeze({ hpMax:  60, attack: 40, defense: 15, range: 4, movement: 2, moraleMax: 100 }),
}) as Record<UnitKind, UnitStats>

export function getUnitStats(kind: UnitKind): UnitStats {
  return UNIT_STATS_BY_KIND[kind]
}

// ----------------------------------------------------------------------------
// Phase 2 v2 : stats effectif + facteurs unitaires
// ----------------------------------------------------------------------------

// Phase 3.3 — split artillery_light / artillery_heavy. Mirror src/engine/units/types.ts v2.4.
export type UnitSubKind = 'archer' | 'artillery_light' | 'artillery_heavy'

export interface SubKindOverride {
  range?: number
  minRange?: number
  rangedPower?: number
  optimalRangeMax?: number
  /** Phase 3.3 — obusier (tir en cloche) ignore les blockers unités sur la trajectoire. */
  arcedTrajectory?: boolean
}

export interface UnitStatsV2 {
  effectiveMax: number
  effectiveMin: number
  attack: number
  defense: number
  rangedPower: number
  range: number
  minRange: number
  movement: number
  moraleMax: number
  /** Phase 3.1-A : portée vision hex (mirror src v2.3). */
  vision: number
  /** Phase 3.3 — borne haute zone optimale niveau base. */
  optimalRangeMax?: number
  /** Phase 3.3 — trajectoire en cloche niveau base. */
  arcedTrajectory?: boolean
  subKindOverrides?: Partial<Record<UnitSubKind, SubKindOverride>>
}

export const UNIT_STATS_V2: Record<UnitKind, UnitStatsV2> = Object.freeze({
  I: Object.freeze({
    effectiveMax: 800, effectiveMin: 100,
    attack: 1.0, defense: 1.0, rangedPower: 0,
    range: 1, minRange: 0, movement: 3, moraleMax: 100, vision: 3,
  }),
  C: Object.freeze({
    effectiveMax: 180, effectiveMin: 25,
    attack: 1.1, defense: 0.9, rangedPower: 0,
    range: 1, minRange: 0, movement: 4, moraleMax: 100, vision: 5,
  }),
  A: Object.freeze({
    // Phase 3.3 mirror — base = artillery_heavy implicite (préservation legacy si subKind NULL).
    effectiveMax: 120, effectiveMin: 30,
    attack: 0.5, defense: 0.3, rangedPower: 5.0,
    range: 6, minRange: 2, movement: 2, moraleMax: 100, vision: 4,
    optimalRangeMax: 3,
    subKindOverrides: Object.freeze({
      archer: Object.freeze({ range: 4, minRange: 0, rangedPower: 2.5 }),
      // Obusier : range courte + arcedTrajectory (ignore unités blockers).
      artillery_light: Object.freeze({ range: 3, minRange: 2, rangedPower: 3.0, optimalRangeMax: 3, arcedTrajectory: true }),
      // Canon : range longue + tir tendu (LoS requis).
      artillery_heavy: Object.freeze({ range: 6, minRange: 2, rangedPower: 5.0, optimalRangeMax: 3, arcedTrajectory: false }),
    }),
  }),
}) as Record<UnitKind, UnitStatsV2>

export function getUnitStatsV2(kind: UnitKind): UnitStatsV2 {
  return UNIT_STATS_V2[kind]
}

export function resolveUnitStatsV2(kind: UnitKind, subKind?: UnitSubKind): UnitStatsV2 {
  const base = UNIT_STATS_V2[kind]
  if (!subKind || !base.subKindOverrides) return base
  const override = base.subKindOverrides[subKind]
  if (!override) return base
  return Object.freeze({
    ...base,
    range: override.range ?? base.range,
    minRange: override.minRange ?? base.minRange,
    rangedPower: override.rangedPower ?? base.rangedPower,
    optimalRangeMax: override.optimalRangeMax ?? base.optimalRangeMax,
    arcedTrajectory: override.arcedTrajectory ?? base.arcedTrajectory,
  }) as UnitStatsV2
}

/**
 * Etat d'une unite consomme par les fonctions engine pures (morale, combat).
 * Bati a la volee dans les EF depuis UnitRow.
 * Source : src/engine/units/types.ts (UnitState v2.0).
 */
export interface UnitState {
  readonly id: string
  readonly kind: UnitKind
  readonly team: Team
  readonly position: Cube
  /** Soldats actifs au combat (legacy v1, conserve 1 phase). */
  readonly hp: number
  readonly hpMax: number
  /** Phase 1.5 : soldats blesses (recoverable Phase 5). hp + wounded <= hpMax. */
  readonly wounded: number
  readonly morale: number
  readonly moraleMax: number
  readonly hasMoved: boolean
  readonly hasAttacked: boolean
  readonly routed: boolean
  // Phase 2 v2 :
  readonly effective: number
  readonly effectiveMax: number
  readonly effectiveMin: number
  readonly killed: number
  readonly lastMovePath?: ReadonlyArray<Cube>
  readonly subKind?: UnitSubKind
  readonly regimentId?: string
  readonly formation?: string
}

// ----------------------------------------------------------------------------
// Phase 2 v2 : sizing (split / merge)
// ----------------------------------------------------------------------------

export type SplitRatio = 'half' | 'three_quarter' | 'nine_one'

const RATIO_VALUES: Record<SplitRatio, number> = { half: 0.5, three_quarter: 0.75, nine_one: 0.9 }

export interface SplitParams {
  source: UnitState
  ratio: SplitRatio
  targetPosition: Cube
  newUnitId: string
}

export interface SplitResult {
  left: UnitState
  right: UnitState
}

export interface MergeParams {
  target: UnitState
  source: UnitState
}

export type SizingErrorCode =
  | 'effective_too_low'
  | 'target_not_adjacent'
  | 'has_attacked_already'
  | 'kind_mismatch'
  | 'team_mismatch'
  | 'units_not_adjacent'
  | 'effective_overflow'

export interface SizingError {
  code: SizingErrorCode
  message: string
}

export function isSizingError(x: SplitResult | UnitState | SizingError): x is SizingError {
  return typeof (x as SizingError).code === 'string' && typeof (x as SizingError).message === 'string'
}

export function splitUnit(params: SplitParams): SplitResult | SizingError {
  const { source, ratio, targetPosition, newUnitId } = params
  const stats = resolveUnitStatsV2(source.kind, source.subKind)

  if (source.hasAttacked) {
    return { code: 'has_attacked_already', message: 'cannot split after attacking this turn' }
  }
  if (source.effective < 2 * stats.effectiveMin) {
    return { code: 'effective_too_low', message: `effective ${source.effective} < 2 * effectiveMin ${stats.effectiveMin}` }
  }
  if (cubeDistance(source.position, targetPosition) !== 1) {
    return { code: 'target_not_adjacent', message: 'target position must be adjacent to source' }
  }

  const r = RATIO_VALUES[ratio]
  const leftEffective = Math.floor(source.effective * r)
  const rightEffective = source.effective - leftEffective
  if (leftEffective < stats.effectiveMin || rightEffective < stats.effectiveMin) {
    return { code: 'effective_too_low', message: `split would put one side under effectiveMin ${stats.effectiveMin}` }
  }

  const leftWounded = Math.round(source.wounded * r)
  const rightWounded = source.wounded - leftWounded
  const leftKilled = Math.round(source.killed * r)
  const rightKilled = source.killed - leftKilled
  const leftHp = Math.round(source.hp * r)
  const rightHp = source.hp - leftHp

  const left: UnitState = {
    ...source,
    effective: leftEffective,
    effectiveMax: stats.effectiveMax,
    effectiveMin: stats.effectiveMin,
    wounded: leftWounded,
    killed: leftKilled,
    hp: leftHp,
    hasMoved: true,
    hasAttacked: true,
    lastMovePath: undefined,
  }

  const right: UnitState = {
    ...source,
    id: newUnitId,
    position: targetPosition,
    effective: rightEffective,
    effectiveMax: stats.effectiveMax,
    effectiveMin: stats.effectiveMin,
    wounded: rightWounded,
    killed: rightKilled,
    hp: rightHp,
    hasMoved: true,
    hasAttacked: true,
    lastMovePath: undefined,
  }

  return { left, right }
}

export function mergeUnits(params: MergeParams): UnitState | SizingError {
  const { target, source } = params

  if (target.kind !== source.kind) return { code: 'kind_mismatch', message: `kinds differ` }
  if ((target.subKind ?? null) !== (source.subKind ?? null)) {
    return { code: 'kind_mismatch', message: 'subKinds differ' }
  }
  if (target.team !== source.team) return { code: 'team_mismatch', message: 'teams differ' }
  if (cubeDistance(target.position, source.position) !== 1) {
    return { code: 'units_not_adjacent', message: 'units must be adjacent to merge' }
  }
  if (target.hasAttacked || source.hasAttacked) {
    return { code: 'has_attacked_already', message: 'cannot merge units that have attacked this turn' }
  }

  const totalEffective = target.effective + source.effective
  const mergedEffectiveMax = target.effectiveMax + source.effectiveMax
  if (totalEffective > mergedEffectiveMax) {
    return { code: 'effective_overflow', message: `total ${totalEffective} > max ${mergedEffectiveMax}` }
  }

  const totalWounded = target.wounded + source.wounded
  const totalKilled = target.killed + source.killed
  const totalHpMax = target.hpMax + source.hpMax
  const totalHp = Math.min(target.hp + source.hp, totalHpMax)
  // v2.2 mirror — effectiveMin = max des 2 sources (= standard du type), pas cumul.
  // Cumul rendait pion fusionné fragile à la retraite (dissolution sous 200 alors qu'un
  // pion classique tient à 100). Voir src/engine/units/sizing.ts v1.1.
  const mergedEffectiveMin = Math.max(target.effectiveMin, source.effectiveMin)
  const weightedMorale = totalEffective > 0
    ? Math.round((target.morale * target.effective + source.morale * source.effective) / totalEffective)
    : Math.round((target.morale + source.morale) / 2)
  // v2.2 — bonus regroupement + recalc routed (mirror src/engine/units/sizing.ts v1.1)
  // v2.3 (Phase 3.2-bis) — routed dérive de l'effectif fusionné, pas du moral.
  const moraleMax = target.moraleMax
  const mergedMorale = Math.min(moraleMax, weightedMorale + MERGE_MORALE_BONUS)
  const mergedRouted = computeRouted(totalEffective, mergedEffectiveMax)

  const merged: UnitState = {
    ...target,
    effective: totalEffective,
    effectiveMax: mergedEffectiveMax,
    effectiveMin: mergedEffectiveMin,
    wounded: totalWounded,
    killed: totalKilled,
    hp: totalHp,
    hpMax: totalHpMax,
    morale: mergedMorale,
    routed: mergedRouted,
    hasMoved: true,
    hasAttacked: true,
    lastMovePath: undefined,
  }

  return merged
}
