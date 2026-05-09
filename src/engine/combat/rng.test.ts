// v1.0 (09/05/2026) — Phase 1 L1A.3 : tests rng Mulberry32
// Cible : 3 tests

import { describe, it, expect } from 'vitest'
import { seededRng } from './rng'

describe('engine/combat/rng', () => {
  it('seed identique → suite reproductible (cross-runtime determinisme)', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).toEqual(seqB)
    // toutes valeurs ∈ [0, 1)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('10000 tirages : moyenne ~ 0.5, min >= 0, max < 1', () => {
    const rng = seededRng(12345)
    const N = 10000
    let sum = 0, min = 1, max = 0
    for (let i = 0; i < N; i++) {
      const v = rng()
      sum += v
      if (v < min) min = v
      if (v > max) max = v
    }
    const mean = sum / N
    expect(mean).toBeGreaterThan(0.49)
    expect(mean).toBeLessThan(0.51)
    expect(min).toBeGreaterThanOrEqual(0)
    expect(max).toBeLessThan(1)
  })

  it('seeds differentes → suites differentes', () => {
    const a = seededRng(42)
    const b = seededRng(43)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })
})
