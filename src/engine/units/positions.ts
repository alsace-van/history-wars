// v1.0 (21/05/2026) — Phase 5 Lot 5.6 : helpers multi-hex (mainPosition/allCubes/centroid/isContiguous/totalEffective)
// Frontiere engine/ : zero React, zero Three, zero Supabase.

import { cubeKey, cubeRound, neighbors, type Cube } from '../hex'
import type { UnitState, UnitHexPosition } from './types'

/**
 * Retourne le hex "principal" d'une unité. Source unique pour tout code qui
 * a besoin d'un Cube de référence (label, hint, premier hex sélectionné).
 *
 *   - `positions` non vide → `positions[0].cube` (ordre stable BDD/insertion)
 *   - sinon (legacy 1-hex sans positions remplies) → `unit.position`
 */
export function mainPosition(unit: UnitState): Cube {
  const ps = unit.positions
  if (ps && ps.length > 0) return ps[0].cube
  return unit.position
}

/** Retourne tous les hex occupés par l'unité. Au moins 1 (fallback `position`). */
export function allCubes(unit: UnitState): Cube[] {
  const ps = unit.positions
  if (!ps || ps.length === 0) return [unit.position]
  return ps.map(p => p.cube)
}

/**
 * Centroïde géométrique des positions, arrondi au cube entier le plus proche
 * (via `cubeRound`, conserve l'invariant q+r+s=0).
 *
 * Utilisé pour positionner le label, la healthbar, le ring de sélection
 * d'une unité multi-hex. Pour 1 hex → ce hex lui-même.
 *
 * Note : le centroïde arrondi peut ne PAS appartenir à `positions` (cas d'une
 * forme creuse en U). Pour un point garanti dans la forme, utiliser
 * `mainPosition(unit)`.
 */
export function centroid(unit: UnitState): Cube {
  const cubes = allCubes(unit)
  if (cubes.length === 1) return cubes[0]
  let qSum = 0
  let rSum = 0
  let sSum = 0
  for (const c of cubes) {
    qSum += c.q
    rSum += c.r
    sSum += c.s
  }
  const n = cubes.length
  return cubeRound(qSum / n, rSum / n, sSum / n)
}

/**
 * Vérifie que toutes les positions forment une zone connexe (BFS).
 * Règle Phase 5 : une unité multi-hex doit toujours être contiguë (sinon elle
 * doit se scinder via `splitUnit`). Validation côté engine, pas BDD (contrainte
 * SQL trop complexe pour la contiguïté de graphe).
 *
 * Cas dégénérés : 0 ou 1 hex → toujours contigu (vrai par convention).
 */
export function isContiguous(positions: ReadonlyArray<UnitHexPosition>): boolean {
  if (positions.length <= 1) return true
  const keys = new Set(positions.map(p => cubeKey(p.cube)))
  const seen = new Set<string>()
  const start = positions[0].cube
  const queue: Cube[] = [start]
  seen.add(cubeKey(start))
  while (queue.length > 0) {
    const c = queue.shift() as Cube
    for (const nb of neighbors(c)) {
      const k = cubeKey(nb)
      if (!keys.has(k)) continue
      if (seen.has(k)) continue
      seen.add(k)
      queue.push(nb)
    }
  }
  return seen.size === keys.size
}

/**
 * Somme des `effectiveShare` de toutes les positions de l'unité.
 * Invariant attendu : `totalEffective(unit) === unit.effective`.
 *
 * Fallback : si `positions` absent ou vide (legacy 1-hex), retourne `unit.effective`.
 */
export function totalEffective(unit: UnitState): number {
  const ps = unit.positions
  if (!ps || ps.length === 0) return unit.effective
  let sum = 0
  for (const p of ps) sum += p.effectiveShare
  return sum
}
