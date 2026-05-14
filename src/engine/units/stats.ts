// v2.5 (14/05/2026) — Phase 3.3 : arcedTrajectory (obusier vs canon) — obusier ignore les blockers unités
// v2.4 (14/05/2026) — Phase 3.3 : split artillery_light/heavy + optimalRangeMax (zone optimale [2,3])
// v2.3 (12/05/2026) — Phase 3.1-A : ajout vision (I=3, C=5, A=4) pour fog of war évolué
// v2.2 (12/05/2026) — MVP tweak : C movement 6→4 + A range 7→6 (rééquilibrage)
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.2 + Phase 3.3

import type { UnitKind } from '../../types/game'
import type { UnitStats, UnitSubKind } from './types'

/**
 * Stats de base par type d'unite (LEGACY v1).
 *   I (Infanterie) : tank de ligne, melee, mobilite moyenne.
 *   C (Cavalerie)  : punch + mobilite, defense faible.
 *   A (Artillerie) : range 4, faible HP, faible mobilite.
 * Conserve 1 phase pour retrocompat. Combat v2 utilise UNIT_STATS_V2.
 * @deprecated drop Phase 4
 */
export const UNIT_STATS_BY_KIND: Readonly<Record<UnitKind, UnitStats>> = Object.freeze({
  I: Object.freeze({ hpMax: 100, attack: 25, defense: 30, range: 1, movement: 3, moraleMax: 100 }),
  C: Object.freeze({ hpMax:  80, attack: 35, defense: 20, range: 1, movement: 6, moraleMax: 100 }),
  A: Object.freeze({ hpMax:  60, attack: 40, defense: 15, range: 4, movement: 2, moraleMax: 100 }),
})

export function getUnitStats(kind: UnitKind): UnitStats {
  return UNIT_STATS_BY_KIND[kind]
}

// ----------------------------------------------------------------------------
// Phase 2 v2 : stats effectif + facteurs unitaires
// ----------------------------------------------------------------------------

/**
 * Override stats pour subKind specifique (ex: archer / artillery_light / artillery_heavy).
 * Si present, override les champs définis. Les autres champs héritent du base UNIT_STATS_V2[kind].
 */
export interface SubKindOverride {
  readonly range?: number
  readonly minRange?: number
  readonly rangedPower?: number
  /** Phase 3.3 — borne haute de la zone de précision optimale (1.0 multiplier). */
  readonly optimalRangeMax?: number
  /**
   * Phase 3.3 — trajectoire en cloche (obusier). Si true : ignore les blockers unités
   * sur la ligne (tir par-dessus les troupes). false = tir tendu (canon) bloqué par tout
   * corps sur la trajectoire. Le terrain (forêt/relief, Phase 5+) reste bloquant dans
   * tous les cas — à câbler quand on aura des terrains LoS.
   */
  readonly arcedTrajectory?: boolean
}

/**
 * Stats v2 par UnitKind.
 *  - effectiveMax : capacite plein regiment (1 pion = 1 bataillon historique).
 *  - effectiveMin : seuil de disparition (BACKLOG-effectif-critique).
 *  - attack       : facteur unitaire d'attaque par homme engage en melee.
 *  - defense      : facteur unitaire de defense par homme engage.
 *  - rangedPower  : facteur unitaire pour attaque distance (artillerie surtout).
 *  - range        : portee max d'attaque distance (1 = melee uniquement).
 *  - minRange     : portee min d'attaque distance (artillerie : 2, archers : 0).
 *  - movement     : nombre d'hex parcourables par tour.
 *  - moraleMax    : moral max.
 *  - optimalRangeMax : Phase 3.3 — borne haute zone optimale (precision 1.0 jusqu'à
 *    cette distance, falloff au-delà vers RANGED_PRECISION_FLOOR à `range`). Optionnel :
 *    si absent, courbe legacy sweet spot 40-70% (cf. distancePrecision).
 *  - subKindOverrides : overrides par sous-type (archer, artillery_light, artillery_heavy).
 *
 * Calibrage indicatif (cf. PLAN-PHASE-2 § 2A.2) — affine en 2A.6 via tests d'equilibrage.
 */
export interface UnitStatsV2 {
  readonly effectiveMax: number
  readonly effectiveMin: number
  readonly attack: number
  readonly defense: number
  readonly rangedPower: number
  readonly range: number
  readonly minRange: number
  readonly movement: number
  readonly moraleMax: number
  /**
   * Phase 3.1-A : portée de vision (hex). Un ennemi à distance ≤ vision et avec LoS
   * est `spotted` ; à distance ≤ floor(vision/2) il devient `identified`.
   * Valeurs initiales calibrage Vague D : I=3, C=5, A=4.
   */
  readonly vision: number
  /** Phase 3.3 — borne haute zone optimale, niveau "base" du kind. */
  readonly optimalRangeMax?: number
  /** Phase 3.3 — trajectoire en cloche au niveau base du kind (cf. SubKindOverride). */
  readonly arcedTrajectory?: boolean
  /** Phase 3.3 — overrides par subKind. Inclut l'ancien archerOverride. */
  readonly subKindOverrides?: Readonly<Partial<Record<UnitSubKind, SubKindOverride>>>
}

export const UNIT_STATS_V2: Readonly<Record<UnitKind, UnitStatsV2>> = Object.freeze({
  I: Object.freeze({
    effectiveMax: 800,
    effectiveMin: 100,
    attack: 1.0,
    defense: 1.0,
    rangedPower: 0,
    range: 1,
    minRange: 0,
    movement: 3,
    moraleMax: 100,
    vision: 3,
  }),
  C: Object.freeze({
    effectiveMax: 180,
    effectiveMin: 25,
    // Phase 2.5 balance (10/05/2026) : 1.5/0.7 donnait power-resistance ≈ 150 sur
    // C 180 vs C 180 plaine → one-shot. Nerf vers 1.1/0.9 pour duels cav vs cav
    // soutenables (~30-40 morts/tour). La domination cav reste forte via la
    // charge (matchupCoef C→I = 1.5 + multiplicateur charge 1.3-1.5).
    attack: 1.1,
    defense: 0.9,
    rangedPower: 0,
    range: 1,
    minRange: 0,
    // v2.2 (12/05/2026) : portee de manoeuvre reduite 6→4. Vitesse d'animation
    // compensee a la hausse cote render (cf. UnitPlaceholder MOVE_SECONDS_PER_HEX).
    movement: 4,
    moraleMax: 100,
    vision: 5,
  }),
  A: Object.freeze({
    // Phase 3.3 — base = artillery_heavy implicite (préservation legacy si subKind NULL).
    effectiveMax: 120,
    effectiveMin: 30,
    attack: 0.5,           // au contact c'est faible
    defense: 0.3,
    rangedPower: 5.0,      // Phase 3.3 : 4.0 → 5.0 pour heavy (compense la chute de précision à distance).
    range: 6,
    minRange: 2,
    movement: 2,
    moraleMax: 100,
    vision: 4,
    /** Phase 3.3 — zone optimale [minRange, 3]. Falloff [3..6] vers 0.4. */
    optimalRangeMax: 3,
    subKindOverrides: Object.freeze({
      // Archer : courbe legacy auto sweet spot 40-70% (optimalRangeMax absent intentionnellement).
      archer: Object.freeze({
        range: 4,
        minRange: 0,
        rangedPower: 2.5,
      }),
      // Phase 3.3 : obusier court — tir en cloche (ignore les unités obstruantes),
      // courte portée (max 3), pas de falloff (max = optimal), dégâts modérés.
      artillery_light: Object.freeze({
        range: 3,
        minRange: 2,
        rangedPower: 3.0,
        optimalRangeMax: 3,
        arcedTrajectory: true,
      }),
      // Phase 3.3 : canon long — tir tendu (LoS requis), longue portée (max 6) avec
      // falloff [3..6] vers 0.4, dégâts élevés au sweet spot.
      artillery_heavy: Object.freeze({
        range: 6,
        minRange: 2,
        rangedPower: 5.0,
        optimalRangeMax: 3,
        arcedTrajectory: false,
      }),
    }),
  }),
})

/** Acces aux stats v2 d'une UnitKind. */
export function getUnitStatsV2(kind: UnitKind): UnitStatsV2 {
  return UNIT_STATS_V2[kind]
}

/**
 * Resout les stats d'une unite v2 en appliquant le subKind si present.
 * Phase 3.3 — supporte subKindOverrides générique (archer / artillery_light / artillery_heavy).
 * Pour subKind non défini, retourne les stats de base (= artillery_heavy implicite pour A).
 */
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
  })
}
