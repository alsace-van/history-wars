// v1.0 (10/05/2026) — Phase 2 2A.4 : types terrain (6 types MVP, etendus Phase 5/7)
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.4

/**
 * Types de terrain disponibles MVP Phase 2.
 *
 * Bornes :
 *   plaine_ouverte  : meilleur deploiement, charge cav OK, plafond hommes 300
 *   plaine_standard : terrain de reference, plafond hommes 200
 *   bosquet         : front reduit, defense +20%, mvt cav -30%, charge interdite
 *   foret           : combat par petits groupes, defense +50%, mvt cav -60%, charge interdite
 *   pont            : couloir, defense +30%, mvt cav -50%, charge interdite
 *   breche          : goulot extreme, defense +50%, mvt cav bloque, charge interdite
 *
 * Phase 5 : ajout collines, riviere, marais, route.
 * Phase 7 : derivation depuis heightmap (relief 3D).
 */
export type TerrainType =
  | 'plaine_ouverte'
  | 'plaine_standard'
  | 'bosquet'
  | 'foret'
  | 'pont'
  | 'breche'

/**
 * Coefficients applicables a un terrain donne lors d'un combat.
 *
 *  - contactCap          : plafond d'hommes engages au contact (saturation Thermopyles).
 *  - defBonus            : multiplicateur defense (1.0 = neutre).
 *  - atkPenalty          : multiplicateur attaque (1.0 = neutre, < 1 = malus).
 *  - cavMovementPenalty  : multiplicateur de mouvement cavalerie (1.0 = normal, 0 = bloque).
 *  - chargeAllowed       : la cavalerie peut-elle charger en passant par ce terrain ?
 */
export interface TerrainCaps {
  readonly contactCap: number
  readonly defBonus: number
  readonly atkPenalty: number
  readonly cavMovementPenalty: number
  readonly chargeAllowed: boolean
}

/** Liste statique de tous les types de terrain (utile pour iterations / UI). */
export const TERRAIN_TYPES = Object.freeze([
  'plaine_ouverte',
  'plaine_standard',
  'bosquet',
  'foret',
  'pont',
  'breche',
] as const) satisfies ReadonlyArray<TerrainType>

/** Type par defaut quand le scenario ne specifie rien (Phase 2 : monotone). */
export const DEFAULT_TERRAIN: TerrainType = 'plaine_standard'
