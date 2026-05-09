// v1.0 (08/05/2026) — Tests coordinates
import { describe, it, expect } from 'vitest'
import {
  cube,
  axialToCube,
  cubeToAxial,
  cubesEqual,
  cubeToWorld,
  worldToCube,
  cubeRound,
} from './coordinates'

describe('cube', () => {
  it('derive s quand non fourni', () => {
    expect(cube(0, 0)).toEqual({ q: 0, r: 0, s: 0 })
    expect(cube(2, -1)).toEqual({ q: 2, r: -1, s: -1 })
  })
  it('accepte un s explicite valide', () => {
    expect(cube(1, 2, -3)).toEqual({ q: 1, r: 2, s: -3 })
  })
  it('throw si invariant viole', () => {
    expect(() => cube(1, 2, 5)).toThrow()
  })
})

describe('axialToCube / cubeToAxial', () => {
  it('reversibles', () => {
    const c = { q: 3, r: -2, s: -1 }
    expect(axialToCube(cubeToAxial(c))).toEqual(c)
  })
  it('axialToCube preserve l\'invariant', () => {
    const c = axialToCube({ q: 5, r: -7 })
    expect(c.q + c.r + c.s).toBe(0)
  })
})

describe('cubesEqual', () => {
  it('compare structurellement', () => {
    expect(cubesEqual({ q: 1, r: 0, s: -1 }, { q: 1, r: 0, s: -1 })).toBe(true)
    expect(cubesEqual({ q: 1, r: 0, s: -1 }, { q: 0, r: 0, s: 0 })).toBe(false)
  })
})

describe('cubeToWorld flat-top', () => {
  it('origine -> (0,0)', () => {
    expect(cubeToWorld({ q: 0, r: 0, s: 0 }, 1)).toEqual({ x: 0, y: 0 })
  })
  it('voisin Est : (1,0,-1) -> (1.5, sqrt(3)/2)', () => {
    const w = cubeToWorld({ q: 1, r: 0, s: -1 }, 1)
    expect(w.x).toBeCloseTo(1.5, 6)
    expect(w.y).toBeCloseTo(Math.sqrt(3) / 2, 6)
  })
  it('hexSize=2 double les distances', () => {
    const w = cubeToWorld({ q: 1, r: 0, s: -1 }, 2)
    expect(w.x).toBeCloseTo(3, 6)
    expect(w.y).toBeCloseTo(Math.sqrt(3), 6)
  })
})

describe('worldToCube reversibilite', () => {
  const samples = [
    { q: 0, r: 0, s: 0 },
    { q: 1, r: 0, s: -1 },
    { q: -3, r: 2, s: 1 },
    { q: 5, r: -7, s: 2 },
    { q: -10, r: 4, s: 6 },
  ]
  it.each(samples)('roundtrip cube → world → cube : %j', (c) => {
    const { x, y } = cubeToWorld(c, 1)
    expect(worldToCube(x, y, 1)).toEqual(c)
  })
  it('roundtrip stable avec hexSize != 1', () => {
    const c = { q: 7, r: -3, s: -4 }
    const { x, y } = cubeToWorld(c, 3.5)
    expect(worldToCube(x, y, 3.5)).toEqual(c)
  })
})

describe('cubeRound', () => {
  it('zero stable', () => {
    expect(cubeRound(0, 0, 0)).toEqual({ q: 0, r: 0, s: 0 })
  })
  it('petit bruit absorbe', () => {
    expect(cubeRound(0.01, 0.01, -0.02)).toEqual({ q: 0, r: 0, s: 0 })
  })
  it('preserve l\'invariant meme apres round', () => {
    const c = cubeRound(1.4, -0.6, -0.8)
    expect(c.q + c.r + c.s).toBe(0)
  })
  it('majoration sur la composante avec le plus grand ecart', () => {
    // qf=0.6 => q rounded a 1, c'est l'ecart max → s sera derive
    const c = cubeRound(0.6, -0.4, -0.2)
    expect(c.q + c.r + c.s).toBe(0)
    expect(c.q).toBe(1)
  })
})
