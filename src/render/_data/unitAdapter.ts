// v1.2 (10/05/2026) — Phase 2 2A.1 : adapter UnitRow → UnitState propage effective (defaults derives si absents)
// v1.1 (10/05/2026) — Phase 1.5 : ajout colonne `wounded` (migration 011) propage a UnitState
// v1.0 (09/05/2026) — L1C.1 : adapter UnitRow BDD → UnitInstance render / UnitState engine

import type { UnitInstance } from '../types'
import type { Team, UnitKind } from '@/types/game'
import type { UnitState, UnitSubKind } from '@engine/units'
import type { Cube } from '@engine/hex'
import { UNIT_STATS_V2, computeOrdinalLabels } from '@engine/units'

/**
 * Forme brute renvoyee par SELECT * FROM units (table publique migration 007 + 011 + 012).
 * Position stockee en axial (q,r) cote BDD, on derive s = -q-r.
 * Migration 012 (Phase 2) : effective / effective_max / effective_min / killed / sub_kind / regiment_id / formation / last_move_path.
 * En attendant la migration 012 deployee, ces champs sont optionnels et defaultes via UNIT_STATS_V2.
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
  // --- Migration 012 (optionnels en transition Phase 2) ---
  effective?: number
  effective_max?: number
  effective_min?: number
  killed?: number
  sub_kind?: UnitSubKind | null
  regiment_id?: string | null
  formation?: string | null
  last_move_path?: ReadonlyArray<{ q: number; r: number; s: number }> | null
}

/**
 * Converti une ligne BDD en UnitInstance (consommee par render/UnitPlaceholder).
 * Phase 2 : propage effective + effective_max si dispo (sinon defaute via UNIT_STATS_V2).
 */
export function unitRowToInstance(row: UnitRow): UnitInstance {
  const stats = UNIT_STATS_V2[row.kind]
  const ratio = row.hp_max > 0 ? row.hp / row.hp_max : 1
  const effective = row.effective ?? Math.round(ratio * stats.effectiveMax)
  const effectiveMax = row.effective_max ?? stats.effectiveMax
  return {
    id: row.id,
    position: { q: row.q, r: row.r, s: -row.q - row.r },
    team: row.team,
    kind: row.kind,
    hp: row.hp,
    hpMax: row.hp_max,
    wounded: row.wounded ?? 0,
    count: effective,
    effective,
    effectiveMax,
    routed: row.routed,
    hasMoved: row.has_moved,
    hasAttacked: row.has_attacked,
  }
}

/**
 * Converti une ligne BDD en UnitState (consomme par engine pur : bfsReachable,
 * previewMelee/Ranged, etc.). Distinct de UnitInstance car engine a besoin de
 * hp/morale/routed/hasMoved/hasAttacked pour la logique.
 *
 * Phase 2 : si la BDD ne contient pas encore les colonnes effective/effective_max/etc.
 * (avant migration 012 deployee), on derive depuis hp/hp_max + UNIT_STATS_V2[kind].
 * Mapping conservatif : effective conserve le ratio de "sante" : effective = round(hp/hp_max * effectiveMax).
 */
export function unitRowToState(row: UnitRow): UnitState {
  const stats = UNIT_STATS_V2[row.kind]
  const ratio = row.hp_max > 0 ? row.hp / row.hp_max : 1
  const effective = row.effective ?? Math.round(ratio * stats.effectiveMax)
  const effectiveMax = row.effective_max ?? stats.effectiveMax
  const effectiveMin = row.effective_min ?? stats.effectiveMin
  const killed = row.killed ?? 0
  const lastMovePath: ReadonlyArray<Cube> | undefined = row.last_move_path
    ? row.last_move_path.map(p => ({ q: p.q, r: p.r, s: p.s }))
    : undefined

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
    effective,
    effectiveMax,
    effectiveMin,
    killed,
    lastMovePath,
    subKind: row.sub_kind ?? undefined,
    regimentId: row.regiment_id ?? undefined,
    formation: row.formation ?? undefined,
  }
}

/** Helper : convertit un tableau de UnitRow en UnitInstance[]. Phase 3.2-bis :
 *  injecte ordinalLabel calculé par team+kind dans l'ordre du tableau. */
export function unitRowsToInstances(rows: UnitRow[]): UnitInstance[] {
  const labels = computeOrdinalLabels(rows.map(r => ({ id: r.id, kind: r.kind, team: r.team })))
  return rows.map(r => ({ ...unitRowToInstance(r), ordinalLabel: labels.get(r.id) }))
}

/** Helper : convertit un tableau de UnitRow en UnitState[]. */
export function unitRowsToStates(rows: UnitRow[]): UnitState[] {
  return rows.map(unitRowToState)
}
