// v1.1 (21/05/2026) — Phase 5 Lot 5.6 : tests ZdC sommée multi-hex
// v1.0 (09/05/2026) — Phase 1 L1A.2 : tests ZdC
// Cible : 4 tests legacy + 5 tests multi-hex

import { describe, it, expect } from 'vitest'
import { cube, cubeKey, neighbors } from '../hex'
import type { UnitState } from '../units/types'
import { computeEnemyZoc } from './zoc'

function makeUnit(overrides: Partial<UnitState>): UnitState {
  return {
    id: overrides.id ?? 'u',
    kind: 'I',
    team: 'red',
    position: cube(0, 0, 0),
    hp: 100,
    hpMax: 100,
    wounded: 0,
    morale: 100,
    moraleMax: 100,
    hasMoved: false,
    hasAttacked: false,
    routed: false,
    // Phase 2 (v2) defaults
    effective: 100,
    effectiveMax: 100,
    effectiveMin: 10,
    killed: 0,
    ...overrides,
  }
}

describe('engine/zoc', () => {
  it('1 ennemie isolee → 6 hex en ZdC', () => {
    const enemy = makeUnit({ id: 'e', team: 'red', position: cube(0, 0, 0) })
    const zoc = computeEnemyZoc([enemy], 'blue')
    expect(zoc.size).toBe(6)
    for (const n of neighbors(enemy.position)) {
      expect(zoc.has(cubeKey(n))).toBe(true)
    }
    // la case de l'ennemi elle-meme n'est PAS en ZdC
    expect(zoc.has(cubeKey(enemy.position))).toBe(false)
  })

  it('2 ennemies adjacentes → moins de 12 (overlap)', () => {
    const e1 = makeUnit({ id: 'e1', team: 'red', position: cube(0, 0, 0) })
    const e2 = makeUnit({ id: 'e2', team: 'red', position: cube(1, 0, -1) })
    const zoc = computeEnemyZoc([e1, e2], 'blue')
    expect(zoc.size).toBeLessThan(12)
    expect(zoc.size).toBeGreaterThanOrEqual(8)
  })

  it('ennemie routed → 0 ZdC', () => {
    const enemy = makeUnit({ id: 'e', team: 'red', position: cube(0, 0, 0), routed: true })
    const zoc = computeEnemyZoc([enemy], 'blue')
    expect(zoc.size).toBe(0)
  })

  it('mix routed / non-routed → seules les non-routed comptent ; alliees ignorees', () => {
    const allied  = makeUnit({ id: 'a',  team: 'blue', position: cube(2, 0, -2) })
    const routedE = makeUnit({ id: 'er', team: 'red',  position: cube(0, 0, 0), routed: true })
    const aliveE  = makeUnit({ id: 'ea', team: 'red',  position: cube(3, 0, -3) })
    const zoc = computeEnemyZoc([allied, routedE, aliveE], 'blue')
    expect(zoc.size).toBe(6)
    for (const n of neighbors(aliveE.position)) {
      expect(zoc.has(cubeKey(n))).toBe(true)
    }
  })

  // ----- Phase 5 Lot 5.6 — multi-hex -----

  it('unité multi-hex 1 entrée explicite → comportement identique au 1-hex legacy', () => {
    const enemy = makeUnit({
      id: 'e',
      team: 'red',
      position: cube(0, 0, 0),
      positions: [{ cube: cube(0, 0, 0), effectiveShare: 100 }],
    })
    const zoc = computeEnemyZoc([enemy], 'blue')
    expect(zoc.size).toBe(6)
    for (const n of neighbors(enemy.position)) {
      expect(zoc.has(cubeKey(n))).toBe(true)
    }
    expect(zoc.has(cubeKey(enemy.position))).toBe(false)
  })

  it('unité 2-hex en ligne E → ZdC sur 8 hex (5+5 voisins − 2 dupliqués)', () => {
    const enemy = makeUnit({
      id: 'e',
      team: 'red',
      position: cube(0, 0, 0),
      positions: [
        { cube: cube(0, 0, 0), effectiveShare: 50 },
        { cube: cube(1, 0, -1), effectiveShare: 50 },
      ],
    })
    const zoc = computeEnemyZoc([enemy], 'blue')
    // 6 voisins de A + 6 de B − 2 occupés par l'unité elle-même (A et B en cross-neighbor)
    // − 2 voisins dupliqués (NE A = NW B ; SE A = SW B) = 8.
    expect(zoc.size).toBe(8)
    // Les hex de l'unité elle-même ne sont JAMAIS en ZdC.
    expect(zoc.has(cubeKey(cube(0, 0, 0)))).toBe(false)
    expect(zoc.has(cubeKey(cube(1, 0, -1)))).toBe(false)
  })

  it('unité 3-hex en ligne E → ZdC sur 10 hex (3 internes exclus)', () => {
    const enemy = makeUnit({
      id: 'e',
      team: 'red',
      position: cube(0, 0, 0),
      positions: [
        { cube: cube(0, 0, 0), effectiveShare: 33 },
        { cube: cube(1, 0, -1), effectiveShare: 33 },
        { cube: cube(2, 0, -2), effectiveShare: 34 },
      ],
    })
    const zoc = computeEnemyZoc([enemy], 'blue')
    expect(zoc.size).toBe(10)
    // Aucun hex interne ne doit être en ZdC.
    expect(zoc.has(cubeKey(cube(0, 0, 0)))).toBe(false)
    expect(zoc.has(cubeKey(cube(1, 0, -1)))).toBe(false)
    expect(zoc.has(cubeKey(cube(2, 0, -2)))).toBe(false)
  })

  it('unité multi-hex routed → 0 ZdC (panique, multi-hex compris)', () => {
    const enemy = makeUnit({
      id: 'e',
      team: 'red',
      position: cube(0, 0, 0),
      routed: true,
      positions: [
        { cube: cube(0, 0, 0), effectiveShare: 50 },
        { cube: cube(1, 0, -1), effectiveShare: 50 },
      ],
    })
    const zoc = computeEnemyZoc([enemy], 'blue')
    expect(zoc.size).toBe(0)
  })

  it('unité 2-hex collée à un allié — ZdC inclut le voisin allié', () => {
    // L'allié (team blue, attaquant) est à (-1, 0, 1) = voisin W de A.
    // ZdC = voisins de l'ennemi (A,B) = 8 hex y compris l'hex où l'allié se trouve.
    // Le BFS du joueur consulte ZdC sans tenir compte de qui occupe l'hex
    // (le blocker est traité séparément).
    const enemy = makeUnit({
      id: 'e',
      team: 'red',
      position: cube(0, 0, 0),
      positions: [
        { cube: cube(0, 0, 0), effectiveShare: 50 },
        { cube: cube(1, 0, -1), effectiveShare: 50 },
      ],
    })
    const allied = makeUnit({ id: 'a', team: 'blue', position: cube(-1, 0, 1) })
    const zoc = computeEnemyZoc([enemy, allied], 'blue')
    expect(zoc.size).toBe(8)
    expect(zoc.has(cubeKey(cube(-1, 0, 1)))).toBe(true)
  })
})
