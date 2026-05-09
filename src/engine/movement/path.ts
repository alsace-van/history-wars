// v1.0 (09/05/2026) — Phase 1 L1A.2 : pathfinding A*
// Source : PLAN-PHASE-1.md § 2.2 (engine/movement/path.ts)
// Heuristique = cubeDistance (admissible, consistante sur grille hex uniforme).
// ZdC : meme contrat que range.ts → entree OK, pas d'expansion (sauf si goal).

import { cubeDistance, neighbors, cubeKey, parseCubeKey, cubesEqual } from '../hex'
import type { Cube } from '../hex'

export interface PathOptions {
  readonly start: Cube
  readonly goal: Cube
  readonly blockers: ReadonlySet<string>
  readonly enemyZocCubes: ReadonlySet<string>
  readonly costPerHex?: (c: Cube) => number
}

interface OpenNode {
  cube: Cube
  fScore: number
}

/**
 * A* sur grille hex. Retourne le chemin start → goal (inclus) ou null.
 * Contrat ZdC : on peut entrer dans un hex en ZdC ennemie, mais pas en sortir.
 *               Donc si current est en ZdC ET current != goal → pas d'expansion.
 *               Si goal est en ZdC, on l'atteint (entree OK).
 */
export function aStar(opts: PathOptions): Cube[] | null {
  const { start, goal, blockers, enemyZocCubes } = opts
  const cost = opts.costPerHex ?? (() => 1)

  const startKey = cubeKey(start)
  const goalKey = cubeKey(goal)

  if (cubesEqual(start, goal)) return [start]
  if (blockers.has(goalKey)) return null

  const gScore = new Map<string, number>([[startKey, 0]])
  const cameFrom = new Map<string, string>()
  const openSet: OpenNode[] = [{ cube: start, fScore: cubeDistance(start, goal) }]

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.fScore - b.fScore)
    const current = openSet.shift()!
    const currentKey = cubeKey(current.cube)

    if (currentKey === goalKey) {
      // reconstruct
      const path: Cube[] = [current.cube]
      let k = currentKey
      while (cameFrom.has(k)) {
        const prevK = cameFrom.get(k)!
        path.unshift(parseCubeKey(prevK))
        k = prevK
      }
      return path
    }

    // ZdC : pas d'expansion sauf depuis le start
    if (currentKey !== startKey && enemyZocCubes.has(currentKey)) continue

    for (const n of neighbors(current.cube)) {
      const nKey = cubeKey(n)
      if (blockers.has(nKey)) continue
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + cost(n)
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, currentKey)
        gScore.set(nKey, tentativeG)
        const f = tentativeG + cubeDistance(n, goal)
        openSet.push({ cube: n, fScore: f })
      }
    }
  }

  return null
}
