// v1.0 (09/05/2026) — Phase 1 L1A.2 : tests ZdC
// Cible : 4 tests

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
})
