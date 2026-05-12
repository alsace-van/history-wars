// v2.2 (12/05/2026) — MVP tweak : C movement 6→4 + A range 7→6 (rééquilibrage)
// v2.1 (10/05/2026) — Phase 2.5 balance : nerf cav (1.5/0.7 → 1.1/0.9) — bug one-shot C vs C
// v2.0 (10/05/2026) — Phase 2 2A.2 : UNIT_STATS_V2 (effectif + facteurs unitaires + range/minRange + archerOverride)
// v1.0 (09/05/2026) — Phase 1 L1A.1 : stats de base par UnitKind (legacy v1, conserve 1 phase)
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.2

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
 * Override stats pour subKind specifique (ex: archer dans la categorie A).
 * Si present, override range / minRange / rangedPower.
 */
export interface SubKindOverride {
  readonly range?: number
  readonly minRange?: number
  readonly rangedPower?: number
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
 *  - archerOverride : si subKind='archer', override range/minRange/rangedPower.
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
  readonly archerOverride?: SubKindOverride
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
  }),
  A: Object.freeze({
    effectiveMax: 120,
    effectiveMin: 30,
    attack: 0.5,           // au contact c'est faible
    defense: 0.3,
    rangedPower: 4.0,      // par piece engage
    // v2.2 (12/05/2026) : range 7→6 (rééquilibrage MVP, board radius 7 sinon overshoot).
    range: 6,
    minRange: 2,
    movement: 2,
    moraleMax: 100,
    archerOverride: Object.freeze({
      range: 4,
      minRange: 0,
      rangedPower: 2.5,
    }),
  }),
})

/** Acces aux stats v2 d'une UnitKind. */
export function getUnitStatsV2(kind: UnitKind): UnitStatsV2 {
  return UNIT_STATS_V2[kind]
}

/**
 * Resout les stats d'une unite v2 en appliquant le subKind si present.
 * Pour subKind='archer' sur A : applique archerOverride sur range/minRange/rangedPower.
 * Pour subKind='artillery' sur A ou non defini : retourne les stats de base.
 */
export function resolveUnitStatsV2(kind: UnitKind, subKind?: UnitSubKind): UnitStatsV2 {
  const base = UNIT_STATS_V2[kind]
  if (subKind === 'archer' && base.archerOverride) {
    return Object.freeze({
      ...base,
      range: base.archerOverride.range ?? base.range,
      minRange: base.archerOverride.minRange ?? base.minRange,
      rangedPower: base.archerOverride.rangedPower ?? base.rangedPower,
    })
  }
  return base
}
