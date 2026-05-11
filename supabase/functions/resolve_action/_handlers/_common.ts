// v1.1 (11/05/2026) — Phase 2.5 : helpers cohésion (computeCohesionFor, getCampEffectiveRatio)
// v1.0 (10/05/2026) — Phase 2 2C.2 : helpers communs aux handlers (UnitRow v2 + buildUnitState v2 + terrain map + combat_config loader)

import type { Cube } from '../../_shared/engine-port/hex/index.ts'
import { cube, cubeKey } from '../../_shared/engine-port/hex/index.ts'
import type { Team, UnitKind } from '../../_shared/types.ts'
import type { TerrainType } from '../../_shared/engine-port/terrain/index.ts'
import { DEFAULT_TERRAIN } from '../../_shared/engine-port/terrain/index.ts'
import type { UnitState, UnitSubKind } from '../../_shared/engine-port/units.ts'
import type { CombatConfig } from '../../_shared/engine-port/combat/v2/types.ts'
import { DEFAULT_COMBAT_CONFIG } from '../../_shared/engine-port/combat/v2/types.ts'
import { UNIT_STATS_V2 } from '../../_shared/engine-port/units.ts'
import {
  computeCohesion,
  computeSupport,
  type CohesionScore,
  type SupportCount,
} from '../../_shared/engine-port/cohesion/index.ts'

/**
 * Forme brute d'une ligne `units` apres migrations 007 + 011 + 012.
 * Phase 2 : effective + sub_kind + last_move_path optionnels (NULL si avant 012 deployee).
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
  wounded: number
  morale: number
  morale_max: number
  routed: boolean
  has_moved: boolean
  has_attacked: boolean
  // Phase 2 (migration 012) :
  effective: number
  effective_max: number
  effective_min: number
  killed: number
  sub_kind: UnitSubKind | null
  regiment_id: string | null
  formation: string | null
  last_move_path: Array<{ q: number; r: number; s: number }> | null
}

/** SELECT explicite de toutes les colonnes units Phase 2 (cf. piege #31). */
export const UNIT_SELECT_COLUMNS =
  'id, game_id, team, kind, q, r, hp, hp_max, wounded, morale, morale_max, routed, has_moved, has_attacked, ' +
  'effective, effective_max, effective_min, killed, sub_kind, regiment_id, formation, last_move_path'

/**
 * Construit un UnitState (engine-port v2) a partir d'une UnitRow.
 * Si la BDD ne contient pas encore les colonnes Phase 2 (migration 012 pas appliquee),
 * defaute via UNIT_STATS_V2 + ratio hp/hp_max (mapping conservatif).
 */
export function buildUnitState(row: UnitRow): UnitState {
  const stats = UNIT_STATS_V2[row.kind]
  const ratio = row.hp_max > 0 ? row.hp / row.hp_max : 1
  const effective = row.effective ?? Math.round(ratio * stats.effectiveMax)
  const effectiveMax = row.effective_max ?? stats.effectiveMax
  const effectiveMin = row.effective_min ?? stats.effectiveMin
  const lastMovePath: ReadonlyArray<Cube> | undefined = row.last_move_path
    ? row.last_move_path.map(p => ({ q: p.q, r: p.r, s: p.s }))
    : undefined

  return {
    id: row.id,
    kind: row.kind,
    team: row.team,
    position: cube(row.q, row.r),
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
    killed: row.killed ?? 0,
    lastMovePath,
    subKind: row.sub_kind ?? undefined,
    regimentId: row.regiment_id ?? undefined,
    formation: row.formation ?? undefined,
  }
}

/**
 * Charge tous les terrain_tiles d'une partie et indexe par cubeKey(q,r).
 * Retourne une Map vide si la table est vide (cas avant seed start_battle Phase 2).
 */
// deno-lint-ignore no-explicit-any
export async function loadTerrainMap(admin: any, gameId: string): Promise<Map<string, TerrainType>> {
  const terrainMap = new Map<string, TerrainType>()
  const { data, error } = await admin
    .from('terrain_tiles')
    .select('q, r, type')
    .eq('game_id', gameId)
  if (error) {
    console.warn('[resolve_action] terrain_tiles fetch failed:', error.message)
    return terrainMap
  }
  for (const row of data ?? []) {
    terrainMap.set(cubeKey(cube(row.q, row.r)), row.type as TerrainType)
  }
  return terrainMap
}

/** Retourne le terrain d'un hex. Defaut DEFAULT_TERRAIN (plaine_standard) si absent. */
export function terrainAt(map: Map<string, TerrainType>, position: Cube): TerrainType {
  return map.get(cubeKey(position)) ?? DEFAULT_TERRAIN
}

/**
 * Charge la config combat tactical v1 depuis la BDD. Defaut sur DEFAULT_COMBAT_CONFIG si absente.
 * Une seule lecture par invocation EF (pas de cache cross-invocations).
 */
// deno-lint-ignore no-explicit-any
export async function loadCombatConfig(admin: any): Promise<CombatConfig> {
  const { data, error } = await admin
    .from('combat_config')
    .select('config')
    .eq('scale', 'tactical')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) {
    console.warn('[resolve_action] combat_config fetch failed, using defaults:', error?.message)
    return DEFAULT_COMBAT_CONFIG
  }
  return data.config as CombatConfig
}

// ----------------------------------------------------------------------------
// Phase 2.5 — Helpers cohésion (état + soutien + effectif global camp)
// ----------------------------------------------------------------------------

/**
 * Convertit toutes les UnitRow en UnitState (engine-port). Pratique pour
 * calculer support/cohésion sur la totalité du board en 1 passe.
 */
export function buildAllUnitStates(units: UnitRow[]): UnitState[] {
  return units.map(buildUnitState)
}

/**
 * Calcule le support + cohésion d'une unité parmi un set complet d'unités.
 * Retourne null si l'unité n'est pas trouvée (sécurité).
 */
export function computeCohesionFor(
  unitId: string,
  units: UnitRow[],
): { support: SupportCount; cohesion: CohesionScore } | null {
  const target = units.find(u => u.id === unitId)
  if (!target) return null
  const allStates = buildAllUnitStates(units)
  const targetState = allStates.find(u => u.id === unitId)!
  const support = computeSupport(targetState, allStates)
  const cohesion = computeCohesion(targetState, support)
  return { support, cohesion }
}

/**
 * Ratio effectif d'un camp = sum(effective) / sum(effectiveMax) sur unités vivantes du camp.
 * MVP : `effectiveMax` cumulé sert de proxy de "force initiale du camp" (i.e.
 * suppose que toutes les unités étaient à plein effectif au début).
 *
 * Utilisé par handleSuicide pour décider si le combat suicide est autorisé
 * (ratio ≥ 25% = guerre encore jouable, voir docs/PLAN-MORAL-COHESION.md § 4).
 *
 * Retourne 0 si aucune unité du camp.
 */
export function getCampEffectiveRatio(team: Team, units: UnitRow[]): number {
  let alive = 0
  let max = 0
  for (const u of units) {
    if (u.team !== team) continue
    alive += u.effective ?? u.hp ?? 0
    max += u.effective_max ?? UNIT_STATS_V2[u.kind].effectiveMax
  }
  if (max === 0) return 0
  return alive / max
}
