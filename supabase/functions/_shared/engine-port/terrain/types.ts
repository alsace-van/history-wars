// v1.0 (10/05/2026) — Phase 2 2C.1 : port engine/terrain/types pour Deno
// Source de verite : src/engine/terrain/types.ts. Duplication controlee (piege #12).

export type TerrainType =
  | 'plaine_ouverte'
  | 'plaine_standard'
  | 'bosquet'
  | 'foret'
  | 'pont'
  | 'breche'

export interface TerrainCaps {
  contactCap: number
  defBonus: number
  atkPenalty: number
  cavMovementPenalty: number
  chargeAllowed: boolean
}

export const TERRAIN_TYPES: ReadonlyArray<TerrainType> = Object.freeze([
  'plaine_ouverte',
  'plaine_standard',
  'bosquet',
  'foret',
  'pont',
  'breche',
]) as ReadonlyArray<TerrainType>

export const DEFAULT_TERRAIN: TerrainType = 'plaine_standard'
