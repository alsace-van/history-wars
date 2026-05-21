// v1.4 (21/05/2026) — Phase 5 Lot 5.6 : propagation positions[] depuis unit_positions BDD (fallback 1-hex MVP)
// v1.3 (14/05/2026) — Phase 3.3 Lot B : unitRowsToInstances accepte activeOrders Map<unitId, kind>
// v1.2 (10/05/2026) — Phase 2 2A.1 : adapter UnitRow → UnitState propage effective (defaults derives si absents)
// v1.1 (10/05/2026) — Phase 1.5 : ajout colonne `wounded` (migration 011) propage a UnitState
// v1.0 (09/05/2026) — L1C.1 : adapter UnitRow BDD → UnitInstance render / UnitState engine

import type { UnitInstance } from '../types'
import type { Team, UnitKind } from '@/types/game'
import type { UnitState, UnitSubKind, UnitHexPosition } from '@engine/units'
import type { Cube } from '@engine/hex'
import type { OrderActionKind } from '@engine/orders'
import { UNIT_STATS_V2, computeOrdinalLabels } from '@engine/units'

/**
 * Ligne brute renvoyée par SELECT * FROM unit_positions (migration 042).
 * 1 row = 1 hex occupé par 1 unit. `effective_share` = part de l'effectif total
 * de l'unité présente sur cet hex. Invariant : Σ(effective_share) = units.effective.
 *
 * Hook chargement attendu : `useBattleUnitPositions(gameId)` (futur Phase 5+).
 * En attendant, ce paramètre est optionnel — fallback 1-hex depuis units.q/r.
 */
export interface UnitPositionRow {
  unit_id: string
  q: number
  r: number
  effective_share: number
}

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
  /** Phase 2.6 (migration 025) : si non-null, cavalerie en attente du choix
   *  Rester/Replier après une charge où le défenseur a survécu. */
  pending_post_charge_target_id?: string | null
}

/**
 * Converti une ligne BDD en UnitInstance (consommee par render/UnitPlaceholder).
 * Phase 2 : propage effective + effective_max si dispo (sinon defaute via UNIT_STATS_V2).
 */
export function unitRowToInstance(
  row: UnitRow,
  positionsForUnit?: ReadonlyArray<UnitPositionRow>,
): UnitInstance {
  const stats = UNIT_STATS_V2[row.kind]
  const ratio = row.hp_max > 0 ? row.hp / row.hp_max : 1
  const effective = row.effective ?? Math.round(ratio * stats.effectiveMax)
  const effectiveMax = row.effective_max ?? stats.effectiveMax
  // Phase 5 Lot 5.6 — positions multi-hex (optionnel). Si fournies, leur ordre
  // détermine la figurine "principale" (positions[0] = mesh principal avec
  // label + healthbar centrés via centroïde dans UnitFigurines).
  const positions = positionsForUnit && positionsForUnit.length > 0
    ? positionsForUnit.map(p => ({
        cube: { q: p.q, r: p.r, s: -p.q - p.r },
        effectiveShare: p.effective_share,
      }))
    : undefined
  return {
    id: row.id,
    position: { q: row.q, r: row.r, s: -row.q - row.r },
    positions,
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
    // Phase 3.3 — propage subKind à UnitInstance pour labels + stats résolus UI.
    subKind: row.sub_kind ?? undefined,
    pendingPostChargeTargetId: row.pending_post_charge_target_id ?? undefined,
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
export function unitRowToState(
  row: UnitRow,
  positionsForUnit?: ReadonlyArray<UnitPositionRow>,
): UnitState {
  const stats = UNIT_STATS_V2[row.kind]
  const ratio = row.hp_max > 0 ? row.hp / row.hp_max : 1
  const effective = row.effective ?? Math.round(ratio * stats.effectiveMax)
  const effectiveMax = row.effective_max ?? stats.effectiveMax
  const effectiveMin = row.effective_min ?? stats.effectiveMin
  const killed = row.killed ?? 0
  const lastMovePath: ReadonlyArray<Cube> | undefined = row.last_move_path
    ? row.last_move_path.map(p => ({ q: p.q, r: p.r, s: p.s }))
    : undefined

  // Phase 5 Lot 5.6 — positions multi-hex. Fallback 1-hex via row.q/r si la table
  // unit_positions n'a pas été query (compat MVP, ou unit fraîchement spawnée).
  const positions: ReadonlyArray<UnitHexPosition> =
    positionsForUnit && positionsForUnit.length > 0
      ? positionsForUnit.map(p => ({
          cube: { q: p.q, r: p.r, s: -p.q - p.r },
          effectiveShare: p.effective_share,
        }))
      : [{
          cube: { q: row.q, r: row.r, s: -row.q - row.r },
          effectiveShare: effective,
        }]

  return {
    id: row.id,
    kind: row.kind,
    team: row.team,
    position: { q: row.q, r: row.r, s: -row.q - row.r },
    positions,
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
 *  injecte ordinalLabel calculé par team+kind dans l'ordre du tableau.
 *  Phase 3.3 Lot B : injecte activeOrder si fourni (ne s'applique qu'aux pions du
 *  viewer car la Map vient de useActiveOrdersByUnit filtré RLS owner-only). */
export function unitRowsToInstances(
  rows: UnitRow[],
  activeOrders?: ReadonlyMap<string, OrderActionKind>,
  positionsMap?: ReadonlyMap<string, ReadonlyArray<UnitPositionRow>>,
): UnitInstance[] {
  const labels = computeOrdinalLabels(rows.map(r => ({ id: r.id, kind: r.kind, team: r.team, subKind: r.sub_kind ?? undefined })))
  return rows.map(r => ({
    ...unitRowToInstance(r, positionsMap?.get(r.id)),
    ordinalLabel: labels.get(r.id),
    activeOrder: activeOrders?.get(r.id),
  }))
}

/** Helper : convertit un tableau de UnitRow en UnitState[].
 *  Phase 5 Lot 5.6 — si `positionsMap` fourni (issu de useBattleUnitPositions),
 *  chaque unit reçoit ses N hex. Sinon fallback 1-hex via row.q/r. */
export function unitRowsToStates(
  rows: UnitRow[],
  positionsMap?: ReadonlyMap<string, ReadonlyArray<UnitPositionRow>>,
): UnitState[] {
  return rows.map(r => unitRowToState(r, positionsMap?.get(r.id)))
}

/** Helper : groupe un tableau de UnitPositionRow par unit_id en Map.
 *  Pratique côté hook chargement (un seul SELECT * FROM unit_positions WHERE ...). */
export function groupPositionsByUnitId(
  rows: ReadonlyArray<UnitPositionRow>,
): Map<string, UnitPositionRow[]> {
  const map = new Map<string, UnitPositionRow[]>()
  for (const r of rows) {
    const list = map.get(r.unit_id)
    if (list) list.push(r)
    else map.set(r.unit_id, [r])
  }
  return map
}
