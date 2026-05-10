// v1.0 (10/05/2026) — Phase 2 2A.4 : table TERRAIN_CAPS (saturation Thermopyles)
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.4 + AUDIT § 3.7
// Frontiere engine/ : zero React, zero Three, zero Supabase

import type { TerrainCaps, TerrainType } from './types'

/**
 * Tableau central des coefs par type de terrain.
 *
 * Plafonds d'hommes engages (cf. brainstorm 09-10/05/2026) :
 *   plaine_ouverte  : 300 (front large, deploiement complet)
 *   plaine_standard : 200 (reference)
 *   bosquet         : 150 (front reduit)
 *   foret           : 100 (combat par petits groupes)
 *   pont            : 80  (couloir)
 *   breche          : 50  (goulot extreme — Thermopyles)
 *
 * Object.freeze : verrou runtime. Toute valeur de jeu est en JSONB BDD
 * (combat_config, migration 014) — cette table est la source par defaut MVP.
 */
export const TERRAIN_CAPS: Readonly<Record<TerrainType, TerrainCaps>> = Object.freeze({
  plaine_ouverte: Object.freeze({
    contactCap: 300,
    defBonus: 1.0,
    atkPenalty: 1.0,
    cavMovementPenalty: 1.0,
    chargeAllowed: true,
  }),
  plaine_standard: Object.freeze({
    contactCap: 200,
    defBonus: 1.0,
    atkPenalty: 1.0,
    cavMovementPenalty: 1.0,
    chargeAllowed: true,
  }),
  bosquet: Object.freeze({
    contactCap: 150,
    defBonus: 1.2,
    atkPenalty: 0.9,
    cavMovementPenalty: 0.7,
    chargeAllowed: false,
  }),
  foret: Object.freeze({
    contactCap: 100,
    defBonus: 1.5,
    atkPenalty: 0.8,
    cavMovementPenalty: 0.4,
    chargeAllowed: false,
  }),
  pont: Object.freeze({
    contactCap: 80,
    defBonus: 1.3,
    atkPenalty: 1.0,
    cavMovementPenalty: 0.5,
    chargeAllowed: false,
  }),
  breche: Object.freeze({
    contactCap: 50,
    defBonus: 1.5,
    atkPenalty: 1.0,
    cavMovementPenalty: 0.0,
    chargeAllowed: false,
  }),
})

/** Acces direct aux caps d'un terrain. */
export function getTerrainCaps(type: TerrainType): TerrainCaps {
  return TERRAIN_CAPS[type]
}

/** True si la cavalerie peut traverser/charger ce terrain. */
export function isChargeAllowed(type: TerrainType): boolean {
  return TERRAIN_CAPS[type].chargeAllowed
}
