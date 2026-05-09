// v1.0 (08/05/2026) — Tests distance
import { describe, it, expect } from 'vitest'
import { cubeDistance } from './distance'

describe('cubeDistance', () => {
  it('zero sur soi-meme', () => {
    expect(cubeDistance({ q: 0, r: 0, s: 0 }, { q: 0, r: 0, s: 0 })).toBe(0)
  })
  it('1 sur un voisin direct', () => {
    expect(cubeDistance({ q: 0, r: 0, s: 0 }, { q: 1, r: 0, s: -1 })).toBe(1)
  })
  it('valeur connue : (3,-2,-1) → 3', () => {
    expect(cubeDistance({ q: 0, r: 0, s: 0 }, { q: 3, r: -2, s: -1 })).toBe(3)
  })
  it('symetrie', () => {
    const a = { q: 4, r: -1, s: -3 }
    const b = { q: -2, r: 5, s: -3 }
    expect(cubeDistance(a, b)).toBe(cubeDistance(b, a))
  })
  it('inegalite triangulaire', () => {
    const a = { q: 0, r: 0, s: 0 }
    const b = { q: 3, r: -1, s: -2 }
    const c = { q: -2, r: 4, s: -2 }
    expect(cubeDistance(a, c)).toBeLessThanOrEqual(
      cubeDistance(a, b) + cubeDistance(b, c)
    )
  })
})
