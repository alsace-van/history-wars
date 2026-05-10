// v1.0 (10/05/2026) — Phase 2 2C.1 : port engine/terrain/caps pour Deno
// Source de verite : src/engine/terrain/caps.ts. Duplication controlee (piege #12).

import type { TerrainCaps, TerrainType } from './types.ts'

export const TERRAIN_CAPS: Record<TerrainType, TerrainCaps> = Object.freeze({
  plaine_ouverte: Object.freeze({ contactCap: 300, defBonus: 1.0, atkPenalty: 1.0, cavMovementPenalty: 1.0, chargeAllowed: true }),
  plaine_standard: Object.freeze({ contactCap: 200, defBonus: 1.0, atkPenalty: 1.0, cavMovementPenalty: 1.0, chargeAllowed: true }),
  bosquet: Object.freeze({ contactCap: 150, defBonus: 1.2, atkPenalty: 0.9, cavMovementPenalty: 0.7, chargeAllowed: false }),
  foret: Object.freeze({ contactCap: 100, defBonus: 1.5, atkPenalty: 0.8, cavMovementPenalty: 0.4, chargeAllowed: false }),
  pont: Object.freeze({ contactCap: 80, defBonus: 1.3, atkPenalty: 1.0, cavMovementPenalty: 0.5, chargeAllowed: false }),
  breche: Object.freeze({ contactCap: 50, defBonus: 1.5, atkPenalty: 1.0, cavMovementPenalty: 0.0, chargeAllowed: false }),
}) as Record<TerrainType, TerrainCaps>

export function getTerrainCaps(type: TerrainType): TerrainCaps {
  return TERRAIN_CAPS[type]
}

export function isChargeAllowed(type: TerrainType): boolean {
  return TERRAIN_CAPS[type].chargeAllowed
}
