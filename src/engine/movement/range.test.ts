// v1.0 (09/05/2026) — Phase 1 L1A.2 : tests range BFS
// Cible : 6 tests

import { describe, it, expect } from 'vitest'
import { cube, cubeKey, neighbors, ring } from '../hex'
import { bfsReachable } from './range'

const NO_BLOCK = new Set<string>()
const NO_ZOC = new Set<string>()

describe('engine/movement/range', () => {
  it('MP=0 → seul le start (1 hex)', () => {
    const start = cube(0, 0, 0)
    const r = bfsReachable({ start, movementPoints: 0, blockers: NO_BLOCK, enemyZocCubes: NO_ZOC })
    expect(r.size).toBe(1)
    expect(r.get(cubeKey(start))).toBe(0)
  })

  it('MP=1 → 7 hex (start + 6 voisins)', () => {
    const start = cube(0, 0, 0)
    const r = bfsReachable({ start, movementPoints: 1, blockers: NO_BLOCK, enemyZocCubes: NO_ZOC })
    expect(r.size).toBe(7)
    for (const n of neighbors(start)) {
      expect(r.get(cubeKey(n))).toBe(1)
    }
  })

  it('MP=2 → 19 hex (disque rayon 2)', () => {
    const start = cube(0, 0, 0)
    const r = bfsReachable({ start, movementPoints: 2, blockers: NO_BLOCK, enemyZocCubes: NO_ZOC })
    // disque rayon 2 = 1 + 6 + 12 = 19
    expect(r.size).toBe(19)
  })

  it('bloqueur sur 1 voisin : hex bloque exclu, hex au-dela accessible via contournement', () => {
    const start = cube(0, 0, 0)
    const blocked = cube(1, 0, -1)
    const r = bfsReachable({
      start,
      movementPoints: 2,
      blockers: new Set([cubeKey(blocked)]),
      enemyZocCubes: NO_ZOC,
    })
    expect(r.has(cubeKey(blocked))).toBe(false)
    // hex en ligne directe derriere le blocker (cout 3 via detour) : pas atteignable a MP=2
    expect(r.has(cubeKey(cube(2, 0, -2)))).toBe(false)
    // hex de cote a distance 2 reste atteignable cout 2 (ne passe pas par le blocker)
    expect(r.get(cubeKey(cube(2, -1, -1)))).toBe(2)
    // a MP=3, l'hex derriere le blocker est atteignable via detour cout 3
    const r3 = bfsReachable({
      start,
      movementPoints: 3,
      blockers: new Set([cubeKey(blocked)]),
      enemyZocCubes: NO_ZOC,
    })
    expect(r3.get(cubeKey(cube(2, 0, -2)))).toBe(3)
  })

  it('ZdC ennemie sur 1 voisin : entree OK (cout 1), pas d\'expansion depuis cet hex', () => {
    const start = cube(0, 0, 0)
    const zocHex = cube(1, 0, -1)
    const r = bfsReachable({
      start,
      movementPoints: 3,
      blockers: NO_BLOCK,
      enemyZocCubes: new Set([cubeKey(zocHex)]),
    })
    // l'hex en ZdC est atteignable cout 1
    expect(r.get(cubeKey(zocHex))).toBe(1)
    // l'hex derriere zocHex (en ligne directe) est inaccessible via zocHex,
    // mais reste atteignable par detour cout 3
    expect(r.get(cubeKey(cube(2, 0, -2)))).toBe(3)
    // a MP=2, le meme hex n'est PAS atteignable (detour trop long)
    const r2 = bfsReachable({
      start,
      movementPoints: 2,
      blockers: NO_BLOCK,
      enemyZocCubes: new Set([cubeKey(zocHex)]),
    })
    expect(r2.get(cubeKey(zocHex))).toBe(1)
    expect(r2.has(cubeKey(cube(2, 0, -2)))).toBe(false)
  })

  it('toutes positions adjacentes bloquees → seul start reachable', () => {
    const start = cube(0, 0, 0)
    const blockers = new Set(neighbors(start).map(cubeKey))
    const r = bfsReachable({ start, movementPoints: 5, blockers, enemyZocCubes: NO_ZOC })
    expect(r.size).toBe(1)
    expect(r.get(cubeKey(start))).toBe(0)
  })
})
