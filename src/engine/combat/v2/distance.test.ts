// v1.0 (10/05/2026) — Phase 2 2A.8 : tests courbe distancePrecision
// Cible : 6+ tests (PLAN-PHASE-2-COMBAT-V2.md § 2A.8 + 2A.11)

import { describe, it, expect } from 'vitest'
import { distancePrecision } from './distance'

describe('engine/combat/v2/distance — distancePrecision', () => {
  it('artillerie minRange=2 distance=1 → 0 (impossible)', () => {
    expect(distancePrecision(1, 7, 2)).toBe(0)
  })

  it('artillerie minRange=2 distance=0 → 0 (melee, gere ailleurs)', () => {
    expect(distancePrecision(0, 7, 2)).toBe(0)
  })

  it('hors portee max → 0', () => {
    expect(distancePrecision(8, 7, 2)).toBe(0)
    expect(distancePrecision(5, 4, 0)).toBe(0)
  })

  it('archer range=4 distance=2 (sweet spot) → 1.0', () => {
    // sweetLow = max(0, round(4*0.4)) = max(0, 2) = 2
    // sweetHigh = round(4*0.7) = 3
    expect(distancePrecision(2, 4, 0)).toBe(1.0)
    expect(distancePrecision(3, 4, 0)).toBe(1.0)
  })

  it('archer range=4 distance=4 (max range) → 0.5 (tail-off)', () => {
    // sweetHigh = 3, range = 4 → lerp 1.0 → 0.5 entre 3 et 4
    expect(distancePrecision(4, 4, 0)).toBe(0.5)
  })

  it('archer range=4 distance=1 (pre-sweet) → entre 0.85 et 1.0', () => {
    const m = distancePrecision(1, 4, 0)
    expect(m).toBeGreaterThanOrEqual(0.85)
    expect(m).toBeLessThanOrEqual(1.0)
  })

  it('artillerie range=7 minRange=2 : sweet spot ~ distance 3-5', () => {
    // sweetLow = max(2, round(7*0.4)) = max(2, 3) = 3
    // sweetHigh = round(7*0.7) = 5
    expect(distancePrecision(3, 7, 2)).toBe(1.0)
    expect(distancePrecision(4, 7, 2)).toBe(1.0)
    expect(distancePrecision(5, 7, 2)).toBe(1.0)
    // distance 7 → tail-off lerp 1.0 → 0.5
    expect(distancePrecision(7, 7, 2)).toBe(0.5)
  })

  it('precision est monotone decroissante au-dela du sweet spot', () => {
    const at5 = distancePrecision(5, 7, 2)
    const at6 = distancePrecision(6, 7, 2)
    const at7 = distancePrecision(7, 7, 2)
    expect(at5).toBeGreaterThanOrEqual(at6)
    expect(at6).toBeGreaterThanOrEqual(at7)
  })
})
