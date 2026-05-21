// v1.0 (16/05/2026) — Phase 2.6 refonte : tests findAttackPosition (auto-charge cav + auto-march inf + auto-position art)
import { describe, expect, it } from 'vitest'
import { findAttackPosition } from './findAttackPosition'
import type { UnitState } from '../../units/types'
import { cube, cubeKey, spiral } from '../../hex'
import { UNIT_STATS_V2 } from '../../units/stats'

const BOARD_KEYS: ReadonlySet<string> = new Set(spiral(cube(0, 0), 10).map(cubeKey))

function makeUnit(overrides: Partial<UnitState> & Pick<UnitState, 'id' | 'kind' | 'team' | 'position'>): UnitState {
  const stats = UNIT_STATS_V2[overrides.kind]
  return {
    hp: 100,
    hpMax: 100,
    wounded: 0,
    morale: 100,
    moraleMax: 100,
    hasMoved: false,
    hasAttacked: false,
    routed: false,
    effective: stats.effectiveMax,
    effectiveMax: stats.effectiveMax,
    effectiveMin: stats.effectiveMin,
    killed: 0,
    ...overrides,
  } as UnitState
}

describe('findAttackPosition', () => {
  it('cav melee adjacent : retourne dest=position, path=[], pas de charge attendue', () => {
    const cav = makeUnit({ id: 'cav', kind: 'C', team: 'blue', position: cube(0, 0) })
    const def = makeUnit({ id: 'def', kind: 'I', team: 'red', position: cube(1, 0) })
    const result = findAttackPosition({ attacker: cav, defender: def, allUnits: [cav, def], boardKeys: BOARD_KEYS })
    expect(result).not.toBeNull()
    expect(result!.path).toHaveLength(0)
    expect(result!.dest).toEqual(cav.position)
    expect(result!.expectStraight).toBe(false)
  })

  it('cav distance 3 ligne droite : path droit de 2 hex, expectStraight=true', () => {
    const cav = makeUnit({ id: 'cav', kind: 'C', team: 'blue', position: cube(0, 0) })
    // Défenseur à (3, 0) sur axe → cav peut atteindre (2, 0) par path droit [(0,0),(1,0),(2,0)]
    const def = makeUnit({ id: 'def', kind: 'I', team: 'red', position: cube(3, 0) })
    const result = findAttackPosition({ attacker: cav, defender: def, allUnits: [cav, def], boardKeys: BOARD_KEYS })
    expect(result).not.toBeNull()
    expect(result!.path.length - 1).toBeGreaterThanOrEqual(2)
    expect(result!.expectStraight).toBe(true)
    // Le dest est UN voisin du défenseur
    expect([
      cubeKey(cube(2, 0)), cubeKey(cube(3, -1)), cubeKey(cube(4, -1)),
      cubeKey(cube(4, 0)), cubeKey(cube(3, 1)), cubeKey(cube(2, 1)),
    ]).toContain(cubeKey(result!.dest))
  })

  it('cav sans path droit (blocker sur la ligne) : fallback path court, expectStraight=false', () => {
    const cav = makeUnit({ id: 'cav', kind: 'C', team: 'blue', position: cube(0, 0) })
    // Blocker sur l'axe direct (1, 0) → force détour. Défenseur en (3, 0).
    const blocker = makeUnit({ id: 'b1', kind: 'I', team: 'blue', position: cube(1, 0) })
    const def = makeUnit({ id: 'def', kind: 'I', team: 'red', position: cube(3, 0) })
    const result = findAttackPosition({ attacker: cav, defender: def, allUnits: [cav, blocker, def], boardKeys: BOARD_KEYS })
    // Avec movement=4 et blocker à (1,0), la cav peut quand même contourner.
    if (result) {
      // Si trouve un path, expectStraight devrait être false (contournement).
      expect(result.expectStraight).toBe(false)
    }
  })

  it('inf distance 3 : auto-march, path court, expectStraight=false', () => {
    const inf = makeUnit({ id: 'inf', kind: 'I', team: 'blue', position: cube(0, 0) })
    const def = makeUnit({ id: 'def', kind: 'C', team: 'red', position: cube(3, 0) })
    const result = findAttackPosition({ attacker: inf, defender: def, allUnits: [inf, def], boardKeys: BOARD_KEYS })
    expect(result).not.toBeNull()
    expect(result!.expectStraight).toBe(false)
    expect(result!.path.length).toBeGreaterThan(0)
  })

  it('art déjà à portée : path=[], pas de move', () => {
    const art = makeUnit({ id: 'art', kind: 'A', team: 'blue', position: cube(0, 0), subKind: 'artillery_light' })
    // artillery_light range = 3, minRange = 2 → défenseur à dist 3 OK
    const def = makeUnit({ id: 'def', kind: 'I', team: 'red', position: cube(3, 0) })
    const result = findAttackPosition({ attacker: art, defender: def, allUnits: [art, def], boardKeys: BOARD_KEYS })
    expect(result).not.toBeNull()
    expect(result!.path).toHaveLength(0)
    expect(result!.dest).toEqual(art.position)
  })

  it('art hors portée mais reachable : auto-position dans range, path > 0', () => {
    const art = makeUnit({ id: 'art', kind: 'A', team: 'blue', position: cube(0, 0), subKind: 'artillery_heavy' })
    // artillery_heavy range = 6, movement = 2. Défenseur à (8, 0) → hors portée.
    // Move 2 hex vers (2, 0) → dist au défenseur = 6 = range max.
    const def = makeUnit({ id: 'def', kind: 'I', team: 'red', position: cube(8, 0) })
    const result = findAttackPosition({ attacker: art, defender: def, allUnits: [art, def], boardKeys: BOARD_KEYS })
    expect(result).not.toBeNull()
    expect(result!.path.length).toBeGreaterThan(0)
  })

  it('target injoignable (au-delà de movement) : retourne null', () => {
    const inf = makeUnit({ id: 'inf', kind: 'I', team: 'blue', position: cube(0, 0) })
    // Inf movement=3, défenseur à dist 8 → trop loin pour atteindre adjacent.
    const def = makeUnit({ id: 'def', kind: 'C', team: 'red', position: cube(8, 0) })
    const result = findAttackPosition({ attacker: inf, defender: def, allUnits: [inf, def], boardKeys: BOARD_KEYS })
    expect(result).toBeNull()
  })

  it('rejette même team / self / has_attacked', () => {
    const u1 = makeUnit({ id: 'u1', kind: 'I', team: 'blue', position: cube(0, 0) })
    const u2 = makeUnit({ id: 'u2', kind: 'I', team: 'blue', position: cube(1, 0) })
    expect(findAttackPosition({ attacker: u1, defender: u2, allUnits: [u1, u2], boardKeys: BOARD_KEYS })).toBeNull()
    expect(findAttackPosition({ attacker: u1, defender: u1, allUnits: [u1], boardKeys: BOARD_KEYS })).toBeNull()
    const attacked = makeUnit({ id: 'u3', kind: 'I', team: 'blue', position: cube(0, 0), hasAttacked: true })
    const enemy = makeUnit({ id: 'e', kind: 'I', team: 'red', position: cube(1, 0) })
    expect(findAttackPosition({ attacker: attacked, defender: enemy, allUnits: [attacked, enemy], boardKeys: BOARD_KEYS })).toBeNull()
  })
})
