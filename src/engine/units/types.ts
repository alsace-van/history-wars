// v1.0 (09/05/2026) — Phase 1 L1A.1 : types unite tactique
// Source : PLAN-PHASE-1.md § 2.2 (engine/units/types.ts)
// Frontiere engine/ : zero React, zero Three, zero Supabase

import type { Cube } from '../hex'
import type { Team, UnitKind } from '../../types/game'

export type UnitId = string

/**
 * Stats de base d'un type d'unite. Constantes par UnitKind.
 * range = 1 → melee. range >= 2 → ranged.
 * Phase 3 : extension via terrainBonus, fatigue, etc.
 */
export interface UnitStats {
  readonly hpMax: number
  readonly attack: number
  readonly defense: number
  readonly range: number
  readonly movement: number
  readonly moraleMax: number
}

/**
 * Etat vivant d'une unite sur le plateau.
 * Stocke hpMax/moraleMax separement (D10) → robuste aux rebalances.
 * Toutes les proprietes readonly : on retourne un nouveau UnitState a chaque mutation
 * (engine fonctionnel pur, partage entre client preview et EF Deno).
 */
export interface UnitState {
  readonly id: UnitId
  readonly kind: UnitKind
  readonly team: Team
  readonly position: Cube
  readonly hp: number
  readonly hpMax: number
  readonly morale: number
  readonly moraleMax: number
  readonly hasMoved: boolean
  readonly hasAttacked: boolean
  readonly routed: boolean
}
