// v1.0 (21/05/2026) — Phase 5 Lot 5.6 : tests helpers positions (multi-hex)
import { describe, it, expect } from 'vitest'
import { cube, cubeKey } from '../../hex'
import type { UnitState, UnitHexPosition } from '../types'
import { mainPosition, allCubes, centroid, isContiguous, totalEffective } from '../positions'

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
    effective: 100,
    effectiveMax: 100,
    effectiveMin: 10,
    killed: 0,
    ...overrides,
  }
}

describe('engine/units/positions — mainPosition', () => {
  it('retourne positions[0].cube quand positions non vide', () => {
    const u = makeUnit({
      position: cube(0, 0, 0),
      positions: [
        { cube: cube(3, -1, -2), effectiveShare: 50 },
        { cube: cube(2, 0, -2), effectiveShare: 50 },
      ],
    })
    expect(mainPosition(u)).toEqual(cube(3, -1, -2))
  })

  it('fallback sur unit.position quand positions absent (legacy)', () => {
    const u = makeUnit({ position: cube(1, 2, -3) })
    expect(mainPosition(u)).toEqual(cube(1, 2, -3))
  })

  it('fallback sur unit.position quand positions vide', () => {
    const u = makeUnit({ position: cube(4, -2, -2), positions: [] })
    expect(mainPosition(u)).toEqual(cube(4, -2, -2))
  })
})

describe('engine/units/positions — allCubes', () => {
  it('retourne tous les cubes de positions', () => {
    const u = makeUnit({
      positions: [
        { cube: cube(0, 0, 0), effectiveShare: 30 },
        { cube: cube(1, 0, -1), effectiveShare: 40 },
        { cube: cube(2, 0, -2), effectiveShare: 30 },
      ],
    })
    expect(allCubes(u)).toHaveLength(3)
    expect(allCubes(u)).toEqual([cube(0, 0, 0), cube(1, 0, -1), cube(2, 0, -2)])
  })

  it('retourne [unit.position] quand positions absent', () => {
    const u = makeUnit({ position: cube(5, -3, -2) })
    expect(allCubes(u)).toEqual([cube(5, -3, -2)])
  })

  it('retourne [unit.position] quand positions vide', () => {
    const u = makeUnit({ position: cube(5, -3, -2), positions: [] })
    expect(allCubes(u)).toEqual([cube(5, -3, -2)])
  })
})

describe('engine/units/positions — centroid', () => {
  it('1 hex → retourne ce hex', () => {
    const u = makeUnit({
      positions: [{ cube: cube(2, -1, -1), effectiveShare: 100 }],
    })
    expect(centroid(u)).toEqual(cube(2, -1, -1))
  })

  it('2 hex côte à côte → milieu arrondi (déterministe via cubeRound)', () => {
    const u = makeUnit({
      positions: [
        { cube: cube(0, 0, 0), effectiveShare: 50 },
        { cube: cube(2, 0, -2), effectiveShare: 50 },
      ],
    })
    // Moyenne = (1, 0, -1) qui est un cube valide entier.
    expect(centroid(u)).toEqual(cube(1, 0, -1))
  })

  it('3 hex en ligne → hex central', () => {
    const u = makeUnit({
      positions: [
        { cube: cube(0, 0, 0), effectiveShare: 30 },
        { cube: cube(1, 0, -1), effectiveShare: 40 },
        { cube: cube(2, 0, -2), effectiveShare: 30 },
      ],
    })
    expect(centroid(u)).toEqual(cube(1, 0, -1))
  })

  it('centroïde respecte l’invariant q+r+s=0', () => {
    const u = makeUnit({
      positions: [
        { cube: cube(0, 0, 0), effectiveShare: 25 },
        { cube: cube(1, 0, -1), effectiveShare: 25 },
        { cube: cube(0, 1, -1), effectiveShare: 25 },
        { cube: cube(1, 1, -2), effectiveShare: 25 },
      ],
    })
    const c = centroid(u)
    expect(c.q + c.r + c.s).toBe(0)
  })

  it('fallback unit.position quand positions vide', () => {
    const u = makeUnit({ position: cube(4, 1, -5), positions: [] })
    expect(centroid(u)).toEqual(cube(4, 1, -5))
  })
})

describe('engine/units/positions — isContiguous', () => {
  it('0 hex → contigu (cas dégénéré, true par convention)', () => {
    expect(isContiguous([])).toBe(true)
  })

  it('1 hex → contigu', () => {
    const ps: UnitHexPosition[] = [{ cube: cube(0, 0, 0), effectiveShare: 100 }]
    expect(isContiguous(ps)).toBe(true)
  })

  it('2 hex voisins → contigu', () => {
    const ps: UnitHexPosition[] = [
      { cube: cube(0, 0, 0), effectiveShare: 50 },
      { cube: cube(1, 0, -1), effectiveShare: 50 },
    ]
    expect(isContiguous(ps)).toBe(true)
  })

  it('2 hex non voisins → NON contigu', () => {
    const ps: UnitHexPosition[] = [
      { cube: cube(0, 0, 0), effectiveShare: 50 },
      { cube: cube(3, 0, -3), effectiveShare: 50 },
    ]
    expect(isContiguous(ps)).toBe(false)
  })

  it('ligne 3 hex E → contigu', () => {
    const ps: UnitHexPosition[] = [
      { cube: cube(0, 0, 0), effectiveShare: 33 },
      { cube: cube(1, 0, -1), effectiveShare: 33 },
      { cube: cube(2, 0, -2), effectiveShare: 34 },
    ]
    expect(isContiguous(ps)).toBe(true)
  })

  it('triangle 3 hex (E + NE + W de NE) → contigu', () => {
    const ps: UnitHexPosition[] = [
      { cube: cube(0, 0, 0), effectiveShare: 33 },
      { cube: cube(1, 0, -1), effectiveShare: 33 },
      { cube: cube(1, -1, 0), effectiveShare: 34 },
    ]
    expect(isContiguous(ps)).toBe(true)
  })

  it('2 clusters disjoints (2 hex + 1 hex isolé) → NON contigu', () => {
    const ps: UnitHexPosition[] = [
      { cube: cube(0, 0, 0), effectiveShare: 30 },
      { cube: cube(1, 0, -1), effectiveShare: 30 },
      { cube: cube(5, 0, -5), effectiveShare: 40 },
    ]
    expect(isContiguous(ps)).toBe(false)
  })

  it('contiguïté ne dépend pas de l’ordre du tableau (BFS robust)', () => {
    const ps: UnitHexPosition[] = [
      { cube: cube(2, 0, -2), effectiveShare: 33 },
      { cube: cube(0, 0, 0), effectiveShare: 33 },
      { cube: cube(1, 0, -1), effectiveShare: 34 },
    ]
    // Démarre par cube(2,0,-2), visite (1,0,-1) puis (0,0,0).
    expect(isContiguous(ps)).toBe(true)
  })

  it('clés cubeKey uniques même si ordre différent', () => {
    const ps: UnitHexPosition[] = [
      { cube: cube(0, 0, 0), effectiveShare: 50 },
      { cube: cube(1, 0, -1), effectiveShare: 50 },
    ]
    const keys = ps.map(p => cubeKey(p.cube))
    expect(new Set(keys).size).toBe(2)
  })
})

describe('engine/units/positions — totalEffective', () => {
  it('somme effectiveShare quand positions rempli', () => {
    const u = makeUnit({
      effective: 100,
      positions: [
        { cube: cube(0, 0, 0), effectiveShare: 30 },
        { cube: cube(1, 0, -1), effectiveShare: 70 },
      ],
    })
    expect(totalEffective(u)).toBe(100)
  })

  it('fallback unit.effective quand positions absent (legacy 1-hex)', () => {
    const u = makeUnit({ effective: 250 })
    expect(totalEffective(u)).toBe(250)
  })

  it('fallback unit.effective quand positions vide', () => {
    const u = makeUnit({ effective: 350, positions: [] })
    expect(totalEffective(u)).toBe(350)
  })

  it('ne fait pas confiance à effective si positions diffère (source de vérité = positions)', () => {
    // Cas pathologique : positions désynchronisé d'effective. La fonction
    // retourne ce que positions dit (source de vérité multi-hex), pas le
    // champ effective. À l'appelant de réconcilier.
    const u = makeUnit({
      effective: 100,
      positions: [
        { cube: cube(0, 0, 0), effectiveShare: 60 },
        { cube: cube(1, 0, -1), effectiveShare: 80 },
      ],
    })
    expect(totalEffective(u)).toBe(140)
  })
})
