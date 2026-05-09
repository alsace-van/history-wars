// v1.0 (09/05/2026) — Phase 1 L1A.2 : tests A*
// Cible : 5 tests

import { describe, it, expect } from 'vitest'
import { cube, cubeKey, cubeDistance, cubesEqual } from '../hex'
import { aStar } from './path'

const NO_BLOCK = new Set<string>()
const NO_ZOC = new Set<string>()

describe('engine/movement/path', () => {
  it('chemin direct distance 3 → 4 hex (start + 3)', () => {
    const start = cube(0, 0, 0)
    const goal = cube(3, 0, -3)
    const path = aStar({ start, goal, blockers: NO_BLOCK, enemyZocCubes: NO_ZOC })
    expect(path).not.toBeNull()
    expect(path!.length).toBe(4)
    expect(cubesEqual(path![0], start)).toBe(true)
    expect(cubesEqual(path![path!.length - 1], goal)).toBe(true)
  })

  it('goal = start → [start]', () => {
    const start = cube(2, -1, -1)
    const path = aStar({ start, goal: start, blockers: NO_BLOCK, enemyZocCubes: NO_ZOC })
    expect(path).not.toBeNull()
    expect(path!.length).toBe(1)
    expect(cubesEqual(path![0], start)).toBe(true)
  })

  it('goal dans blockers → null', () => {
    const start = cube(0, 0, 0)
    const goal = cube(2, 0, -2)
    const path = aStar({
      start,
      goal,
      blockers: new Set([cubeKey(goal)]),
      enemyZocCubes: NO_ZOC,
    })
    expect(path).toBeNull()
  })

  it('contournement obstacle → longueur >= distance directe', () => {
    const start = cube(0, 0, 0)
    const goal = cube(3, 0, -3)
    const obstacles = [cube(1, 0, -1), cube(2, 0, -2)]
    const path = aStar({
      start,
      goal,
      blockers: new Set(obstacles.map(cubeKey)),
      enemyZocCubes: NO_ZOC,
    })
    expect(path).not.toBeNull()
    const directDistance = cubeDistance(start, goal)
    expect(path!.length - 1).toBeGreaterThanOrEqual(directDistance)
    // aucun hex du chemin n'est sur un blocker
    for (const hex of path!) {
      expect(obstacles.some(o => cubesEqual(o, hex))).toBe(false)
    }
  })

  it('ZdC sur le trajet direct → contourne (chemin plus long ou egal)', () => {
    const start = cube(0, 0, 0)
    const goal = cube(3, 0, -3)
    // ZdC sur l'hex au milieu : on peut y entrer mais pas continuer.
    // → A* devrait preferer un detour pour atteindre goal.
    const zocHex = cube(1, 0, -1)
    const path = aStar({
      start,
      goal,
      blockers: NO_BLOCK,
      enemyZocCubes: new Set([cubeKey(zocHex)]),
    })
    expect(path).not.toBeNull()
    // chemin ne doit pas inclure zocHex en intermediaire (sinon il bloquerait l'expansion)
    const includesZoc = path!.some(h => cubesEqual(h, zocHex))
    expect(includesZoc).toBe(false)
    expect(path!.length - 1).toBeGreaterThanOrEqual(cubeDistance(start, goal))
  })
})
