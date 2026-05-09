// v1.0 (09/05/2026) — Phase 1 L1A.2 : range de mouvement BFS
// Source : PLAN-PHASE-1.md § 2.2 (engine/movement/range.ts)
// Contrat ZdC (D7 / piege #17) : on peut ENTRER dans un hex en ZdC ennemie,
//                                mais on ne peut pas EN SORTIR (pas d'expansion).
// costPerHex en option : Phase 3 = terrain, Phase 1 = 1 partout.

import { neighbors, cubeKey } from '../hex'
import type { Cube } from '../hex'

export interface RangeOptions {
  readonly start: Cube
  readonly movementPoints: number
  readonly blockers: ReadonlySet<string>
  readonly enemyZocCubes: ReadonlySet<string>
  readonly costPerHex?: (c: Cube) => number
}

interface Frontier {
  cube: Cube
  cost: number
}

/**
 * BFS / Dijkstra borne par MP. Retourne une Map cubeKey → cout cumule
 * pour tous les hex atteignables (start inclus, cout 0).
 */
export function bfsReachable(opts: RangeOptions): Map<string, number> {
  const { start, movementPoints, blockers, enemyZocCubes } = opts
  const cost = opts.costPerHex ?? (() => 1)

  const visited = new Map<string, number>()
  const startKey = cubeKey(start)
  visited.set(startKey, 0)

  const frontier: Frontier[] = [{ cube: start, cost: 0 }]

  while (frontier.length > 0) {
    // tri par cout croissant pour gerer cout variable proprement (Phase 3)
    frontier.sort((a, b) => a.cost - b.cost)
    const current = frontier.shift()!
    const currentKey = cubeKey(current.cube)

    // ZdC ennemie : entree OK (deja visite ci-dessus), pas d'expansion sauf si c'est le start
    if (currentKey !== startKey && enemyZocCubes.has(currentKey)) continue

    for (const n of neighbors(current.cube)) {
      const nKey = cubeKey(n)
      if (blockers.has(nKey)) continue
      const stepCost = cost(n)
      const newCost = current.cost + stepCost
      if (newCost > movementPoints) continue
      const prev = visited.get(nKey)
      if (prev === undefined || newCost < prev) {
        visited.set(nKey, newCost)
        frontier.push({ cube: n, cost: newCost })
      }
    }
  }

  return visited
}
