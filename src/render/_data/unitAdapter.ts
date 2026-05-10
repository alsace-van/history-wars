// v1.1 (10/05/2026) — Phase 1.5 : ajout colonne `wounded` (migration 011) propage a UnitState
// v1.0 (09/05/2026) — L1C.1 : adapter UnitRow BDD → UnitInstance render / UnitState engine

import type { UnitInstance } from '../types'
import type { Team, UnitKind } from '@/types/game'
import type { UnitState } from '@engine/units'

/**
 * Forme brute renvoyee par SELECT * FROM units (table publique migration 007 + 011).
 * Position stockee en axial (q,r) cote BDD, on derive s = -q-r.
 */
export interface UnitRow {
  id: string
  game_id: string
  team: Team
  kind: UnitKind
  q: number
  r: number
  hp: number
  hp_max: number
  /** Migration 011 : soldats blesses (default 0). */
  wounded: number
  morale: number
  morale_max: number
  routed: boolean
  has_moved: boolean
  has_attacked: boolean
  created_at: string
  updated_at: string
}

/**
 * Converti une ligne BDD en UnitInstance (consommee par render/UnitPlaceholder).
 * `count` non utilise en Phase 1 (champ optionnel, sera moyenne effectif en Phase 3).
 */
export function unitRowToInstance(row: UnitRow): UnitInstance {
  return {
    id: row.id,
    position: { q: row.q, r: row.r, s: -row.q - row.r },
    team: row.team,
    kind: row.kind,
    hp: row.hp,
    hpMax: row.hp_max,
    wounded: row.wounded ?? 0,
    count: row.hp,
  }
}

/**
 * Converti une ligne BDD en UnitState (consomme par engine pur : bfsReachable,
 * previewMelee/Ranged, etc.). Distinct de UnitInstance car engine a besoin de
 * hp/morale/routed/hasMoved/hasAttacked pour la logique.
 */
export function unitRowToState(row: UnitRow): UnitState {
  return {
    id: row.id,
    kind: row.kind,
    team: row.team,
    position: { q: row.q, r: row.r, s: -row.q - row.r },
    hp: row.hp,
    hpMax: row.hp_max,
    wounded: row.wounded ?? 0,
    morale: row.morale,
    moraleMax: row.morale_max,
    hasMoved: row.has_moved,
    hasAttacked: row.has_attacked,
    routed: row.routed,
  }
}

/** Helper : convertit un tableau de UnitRow en UnitInstance[]. */
export function unitRowsToInstances(rows: UnitRow[]): UnitInstance[] {
  return rows.map(unitRowToInstance)
}

/** Helper : convertit un tableau de UnitRow en UnitState[]. */
export function unitRowsToStates(rows: UnitRow[]): UnitState[] {
  return rows.map(unitRowToState)
}
