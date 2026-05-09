// v1.0 (08/05/2026) — Tests line
import { describe, it, expect } from 'vitest'
import { cubeLerp, cubeLineDraw } from './line'
import { cubeDistance } from './distance'

const ORIGIN = { q: 0, r: 0, s: 0 }

describe('cubeLerp', () => {
  it('t=0 → a', () => {
    const a = { q: 1, r: 2, s: -3 }
    const b = { q: 5, r: -2, s: -3 }
    expect(cubeLerp(a, b, 0)).toEqual(a)
  })
  it('t=1 → b', () => {
    const a = { q: 1, r: 2, s: -3 }
    const b = { q: 5, r: -2, s: -3 }
    const r = cubeLerp(a, b, 1)
    expect(r.q).toBeCloseTo(5)
    expect(r.r).toBeCloseTo(-2)
  })
  it('t=0.5 → milieu', () => {
    const r = cubeLerp({ q: 0, r: 0, s: 0 }, { q: 4, r: -2, s: -2 }, 0.5)
    expect(r.q).toBeCloseTo(2)
    expect(r.r).toBeCloseTo(-1)
  })
})

describe('cubeLineDraw', () => {
  it('a === b → [a]', () => {
    expect(cubeLineDraw(ORIGIN, ORIGIN)).toEqual([ORIGIN])
  })
  it('voisin direct → 2 hex', () => {
    const result = cubeLineDraw(ORIGIN, { q: 1, r: 0, s: -1 })
    expect(result).toHaveLength(2)
  })
  it('distance 3 → 4 hex (inclusif)', () => {
    const target = { q: 3, r: 0, s: -3 }
    const result = cubeLineDraw(ORIGIN, target)
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual(ORIGIN)
    expect(result[result.length - 1]).toEqual(target)
  })
  it('chaque hex consecutif est voisin du precedent', () => {
    const result = cubeLineDraw(ORIGIN, { q: 5, r: -2, s: -3 })
    for (let i = 1; i < result.length; i++) {
      expect(cubeDistance(result[i - 1], result[i])).toBe(1)
    }
  })
  it('preserve l\'invariant sur tous les hex', () => {
    const result = cubeLineDraw(ORIGIN, { q: 4, r: -7, s: 3 })
    for (const h of result) {
      expect(h.q + h.r + h.s).toBe(0)
    }
  })
})
