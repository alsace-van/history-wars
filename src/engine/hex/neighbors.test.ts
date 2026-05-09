// v1.0 (08/05/2026) — Tests neighbors / ring / spiral
import { describe, it, expect } from 'vitest'
import { HEX_DIRECTIONS, neighbor, neighbors, ring, spiral } from './neighbors'
import { cubeDistance } from './distance'
import { cubeKey } from './key'

const ORIGIN = { q: 0, r: 0, s: 0 }

describe('HEX_DIRECTIONS', () => {
  it('a 6 entrees', () => {
    expect(HEX_DIRECTIONS).toHaveLength(6)
  })
  it('chaque direction respecte l\'invariant', () => {
    for (const d of HEX_DIRECTIONS) {
      expect(d.q + d.r + d.s).toBe(0)
    }
  })
  it('index 0 = Est = {1, 0, -1}', () => {
    expect(HEX_DIRECTIONS[0]).toEqual({ q: 1, r: 0, s: -1 })
  })
  it('index 3 = Ouest = oppose de l\'Est', () => {
    expect(HEX_DIRECTIONS[3]).toEqual({ q: -1, r: 0, s: 1 })
  })
})

describe('neighbor', () => {
  it('direction 0 (Est)', () => {
    expect(neighbor(ORIGIN, 0)).toEqual({ q: 1, r: 0, s: -1 })
  })
  it('modulo positif sur direction negative', () => {
    // direction -1 = direction 5 = SE
    expect(neighbor(ORIGIN, -1)).toEqual(neighbor(ORIGIN, 5))
  })
  it('modulo sur direction >= 6', () => {
    expect(neighbor(ORIGIN, 6)).toEqual(neighbor(ORIGIN, 0))
    expect(neighbor(ORIGIN, 13)).toEqual(neighbor(ORIGIN, 1))
  })
})

describe('neighbors', () => {
  it('retourne 6 hex', () => {
    expect(neighbors(ORIGIN)).toHaveLength(6)
  })
  it('tous a distance 1', () => {
    for (const n of neighbors(ORIGIN)) {
      expect(cubeDistance(ORIGIN, n)).toBe(1)
    }
  })
  it('ordre stable : neighbors[0] est toujours l\'Est', () => {
    expect(neighbors(ORIGIN)[0]).toEqual({ q: 1, r: 0, s: -1 })
  })
  it('flank(d) = (d+3)%6 donne la direction opposee', () => {
    const n = neighbors(ORIGIN)
    // Normalisation -0 -> +0 pour Object.is
    const nz = (x: number) => (x === 0 ? 0 : x)
    expect(nz(n[0].q)).toBe(nz(-n[3].q))
    expect(nz(n[0].r)).toBe(nz(-n[3].r))
    expect(nz(n[0].s)).toBe(nz(-n[3].s))
  })
})

describe('ring', () => {
  it('radius 0 = juste le centre', () => {
    expect(ring(ORIGIN, 0)).toEqual([ORIGIN])
  })
  it('radius 1 = 6 hex', () => {
    expect(ring(ORIGIN, 1)).toHaveLength(6)
  })
  it('radius 2 = 12 hex', () => {
    expect(ring(ORIGIN, 2)).toHaveLength(12)
  })
  it('radius N : tous les hex sont exactement a distance N', () => {
    for (const h of ring(ORIGIN, 3)) {
      expect(cubeDistance(ORIGIN, h)).toBe(3)
    }
  })
  it('throw sur radius negatif', () => {
    expect(() => ring(ORIGIN, -1)).toThrow()
  })
})

describe('spiral', () => {
  it('radius 0 = 1 hex', () => {
    expect(spiral(ORIGIN, 0)).toHaveLength(1)
  })
  it('radius 1 = 7 hex', () => {
    expect(spiral(ORIGIN, 1)).toHaveLength(7)
  })
  it('radius 2 = 19 hex', () => {
    expect(spiral(ORIGIN, 2)).toHaveLength(19)
  })
  it('pas de doublons', () => {
    const s = spiral(ORIGIN, 3)
    const keys = new Set(s.map(cubeKey))
    expect(keys.size).toBe(s.length)
  })
})
