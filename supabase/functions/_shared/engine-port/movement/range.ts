// v1.0 (09/05/2026) — Phase 1 L1B.3 : port movement/range pour Deno EF
// Source de verite : src/engine/movement/range.ts. Duplication controlee (piege #12).
// Contrat ZdC (piege #17) : entree OK, pas d'expansion depuis l'hex en ZdC.

import { neighbors, cubeKey } from '../hex/index.ts'
import type { Cube } from '../hex/index.ts'

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

export function bfsReachable(opts: RangeOptions): Map<string, number> {
  const { start, movementPoints, blockers, enemyZocCubes } = opts
  const cost = opts.costPerHex ?? (() => 1)

  const visited = new Map<string, number>()
  const startKey = cubeKey(start)
  visited.set(startKey, 0)

  const frontier: Frontier[] = [{ cube: start, cost: 0 }]

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost)
    const current = frontier.shift()!
    const currentKey = cubeKey(current.cube)

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
