// v1.1 (12/05/2026) — Merge : bonus moral +25 + recalcul routed (regroupement remet en ordre)
// v1.0 (10/05/2026) — Phase 2 2A.3 : split / merge de pions (effectif elastique)
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.3
// Frontiere engine/ : zero React, zero Three, zero Supabase, zero rng

import type { Cube } from '../hex'
import { cubeDistance } from '../hex'
import { MORALE_ROUT_THRESHOLD } from '../morale'
import { resolveUnitStatsV2 } from './stats'
import type { UnitState } from './types'

/**
 * Bonus de moral appliqué lors d'une fusion : représente le ralliement (les hommes
 * voient renforts, ravitaillement, regroupement → reprennent confiance).
 * Permet à 2 pions Brisés (moral 0) de se regrouper et sortir de la déroute.
 */
export const MERGE_MORALE_BONUS = 25

/**
 * Ratios autorises pour scinder un pion :
 *   half           = 50/50  → 0.5  / 0.5
 *   three_quarter  = 75/25  → 0.75 / 0.25
 *   nine_one       = 90/10  → 0.9  / 0.1
 * MVP Phase 2 : 3 presets, pas de slider continu (BACKLOG-Phase 8 polish).
 */
export type SplitRatio = 'half' | 'three_quarter' | 'nine_one'

const RATIO_VALUES: Readonly<Record<SplitRatio, number>> = Object.freeze({
  half: 0.5,
  three_quarter: 0.75,
  nine_one: 0.9,
})

export interface SplitParams {
  /** Pion source. Doit avoir effective >= 2 * effectiveMin pour pouvoir scinder. */
  readonly source: UnitState
  /** Repartition (left = ratio, right = 1 - ratio). */
  readonly ratio: SplitRatio
  /** Position cible du nouveau pion (right). Doit etre adjacente a source. */
  readonly targetPosition: Cube
  /** Identifiant pour le nouveau pion (genere par caller : EF crypto.randomUUID). */
  readonly newUnitId: string
}

export interface SplitResult {
  /** Pion source mis a jour (effective reduit, has_attacked=true, has_moved=true). */
  readonly left: UnitState
  /** Nouveau pion cree sur targetPosition (effective complementaire). */
  readonly right: UnitState
}

export type SizingError =
  | { code: 'effective_too_low'; message: string }
  | { code: 'target_not_adjacent'; message: string }
  | { code: 'has_attacked_already'; message: string }
  | { code: 'kind_mismatch'; message: string }
  | { code: 'team_mismatch'; message: string }
  | { code: 'units_not_adjacent'; message: string }
  | { code: 'effective_overflow'; message: string }

/**
 * Scinder un pion en 2 selon un ratio preset.
 *
 * Regles :
 *  - source.effective >= 2 * effectiveMin
 *  - source.hasAttacked === false (pas de split apres attaque)
 *  - targetPosition adjacente a source.position (caller verifie aussi que la case est libre)
 *  - Les 2 pions resultants ont chacun >= effectiveMin
 *  - Apres split : les 2 pions sont marques hasMoved=true et hasAttacked=true
 *    (1 tour d'inactivite offensive — cf. AUDIT § 3.3)
 *  - wounded / morale propages proportionnellement
 *
 * @returns Result | erreur structuree (pas d'exception : engine pur deterministe)
 */
export function splitUnit(params: SplitParams): SplitResult | SizingError {
  const { source, ratio, targetPosition, newUnitId } = params
  const stats = resolveUnitStatsV2(source.kind, source.subKind)

  if (source.hasAttacked) {
    return { code: 'has_attacked_already', message: 'cannot split after attacking this turn' }
  }

  if (source.effective < 2 * stats.effectiveMin) {
    return {
      code: 'effective_too_low',
      message: `effective ${source.effective} < 2 * effectiveMin ${stats.effectiveMin}`,
    }
  }

  if (cubeDistance(source.position, targetPosition) !== 1) {
    return { code: 'target_not_adjacent', message: 'target position must be adjacent to source' }
  }

  // Repartition arrondie : left reçoit Math.floor(effective * ratio), right reçoit le reste.
  const r = RATIO_VALUES[ratio]
  const leftEffective = Math.floor(source.effective * r)
  const rightEffective = source.effective - leftEffective

  // Garantie : les 2 cotes >= effectiveMin (sinon refuser)
  if (leftEffective < stats.effectiveMin || rightEffective < stats.effectiveMin) {
    return {
      code: 'effective_too_low',
      message: `split ${leftEffective}/${rightEffective} would put one side under effectiveMin ${stats.effectiveMin}`,
    }
  }

  // Wounded reparti proportionnellement (round, le reste sur left)
  const leftWounded = Math.round(source.wounded * r)
  const rightWounded = source.wounded - leftWounded

  // Morale identique sur les 2 (un meme pion qui se divise garde son etat moral)
  // Killed cumul : reparti proportionnellement
  const leftKilled = Math.round(source.killed * r)
  const rightKilled = source.killed - leftKilled

  // hp legacy reparti proportionnellement (defaultable a effective Phase 4)
  const leftHp = Math.round(source.hp * r)
  const rightHp = source.hp - leftHp

  // Apres split : chaque fragment retombe sur effectiveMax standard du type
  // (un pion fusionne se split en 2 bataillons standards, pas en 2 super-bataillons).
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

export interface MergeParams {
  /** Pion qui absorbe (recoit le total, conserve son id). */
  readonly target: UnitState
  /** Pion absorbe (sera supprime cote BDD apres merge). */
  readonly source: UnitState
}

export type MergeResult = UnitState

/**
 * Fusionner 2 pions adjacents en un seul.
 *
 * Regles :
 *  - same kind (subKind doit aussi matcher si present)
 *  - same team
 *  - cubeDistance(target, source) === 1
 *  - target.hasAttacked === false ET source.hasAttacked === false
 *  - total effective <= effectiveMax (caller doit prevenir l'utilisateur sinon)
 *  - Apres merge : pion resultant marque hasMoved=true et hasAttacked=true
 *    (1 tour d'inactivite offensive — cf. AUDIT § 3.3)
 *  - wounded sommes, killed sommes, morale = moyenne ponderee par effective
 *  - hp legacy = somme clampee a hpMax + max(target.hpMax, source.hpMax)
 *
 * @returns UnitState merge | erreur structuree
 */
export function mergeUnits(params: MergeParams): MergeResult | SizingError {
  const { target, source } = params

  if (target.kind !== source.kind) {
    return { code: 'kind_mismatch', message: `kinds differ: ${target.kind} vs ${source.kind}` }
  }

  if ((target.subKind ?? null) !== (source.subKind ?? null)) {
    return { code: 'kind_mismatch', message: `subKinds differ: ${target.subKind} vs ${source.subKind}` }
  }

  if (target.team !== source.team) {
    return { code: 'team_mismatch', message: `teams differ: ${target.team} vs ${source.team}` }
  }

  if (cubeDistance(target.position, source.position) !== 1) {
    return { code: 'units_not_adjacent', message: 'units must be adjacent to merge' }
  }

  if (target.hasAttacked || source.hasAttacked) {
    return { code: 'has_attacked_already', message: 'cannot merge units that have attacked this turn' }
  }

  const totalEffective = target.effective + source.effective
  // Un pion fusionne accumule les effectiveMax des 2 sources (cf. AUDIT § 3.1 : ~1600 max manipulable I).
  const mergedEffectiveMax = target.effectiveMax + source.effectiveMax

  if (totalEffective > mergedEffectiveMax) {
    return {
      code: 'effective_overflow',
      message: `total effective ${totalEffective} > merged effectiveMax ${mergedEffectiveMax}`,
    }
  }

  const totalWounded = target.wounded + source.wounded
  const totalKilled = target.killed + source.killed
  const totalHpRaw = target.hp + source.hp
  const totalHpMax = target.hpMax + source.hpMax
  const totalHp = Math.min(totalHpRaw, totalHpMax)

  // v1.1 — effectiveMin du pion fusionné : on garde le standard du type (= max des 2 sources,
  // identique en pratique puisque le kind est garanti identique). Le cumul (100+100=200) rendait
  // les pions fusionnés très fragiles : une retraite à 86% de pertes pouvait dissoudre un pion
  // de 200 hommes (sous le seuil 200) alors qu'un pion classique à 100 aurait survécu.
  // Le seuil dur reste celui d'un bataillon viable (100 pour I, 25 pour C, 30 pour A).
  const mergedEffectiveMin = Math.max(target.effectiveMin, source.effectiveMin)

  // Morale pondérée par les effectifs + bonus de regroupement (v1.1).
  // Le bonus traduit le ralliement : renforts vus, repli ordonné, ravitaillement.
  // Permet à 2 pions brisés (moral 0) de fusionner et sortir de la déroute (à 25).
  const weightedMorale = totalEffective > 0
    ? Math.round((target.morale * target.effective + source.morale * source.effective) / totalEffective)
    : Math.round((target.morale + source.morale) / 2)
  const moraleMax = target.moraleMax // = source.moraleMax (constante 100 par kind)
  const mergedMorale = Math.min(moraleMax, weightedMorale + MERGE_MORALE_BONUS)
  // Routed recalculé sur le moral fusionné (et non plus AND legacy) → cohérent
  // avec MORALE_ROUT_THRESHOLD partout dans le moteur.
  const mergedRouted = mergedMorale < MORALE_ROUT_THRESHOLD

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

/**
 * Type guard : distingue SizingError d'un resultat valide (SplitResult ou MergeResult).
 */
export function isSizingError(x: SplitResult | MergeResult | SizingError): x is SizingError {
  return typeof (x as SizingError).code === 'string' && typeof (x as SizingError).message === 'string'
}
