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

  // ---------------------------------------------------------------------------
  // Phase 3.3 — mode explicit (optimalRangeMax fourni, typique artillerie light/heavy)
  // ---------------------------------------------------------------------------

  it('artillery_light (range=3, minRange=2, optimalMax=3) : 1.0 sur tout [2,3]', () => {
    // max = optimal → pas de falloff possible.
    expect(distancePrecision(2, 3, 2, 3)).toBe(1.0)
    expect(distancePrecision(3, 3, 2, 3)).toBe(1.0)
  })

  it('artillery_heavy (range=6, minRange=2, optimalMax=3) : zone optimale puis falloff vers 0.4', () => {
    // Optimal zone [2, 3] → 1.0
    expect(distancePrecision(2, 6, 2, 3)).toBe(1.0)
    expect(distancePrecision(3, 6, 2, 3)).toBe(1.0)
    // distance > optimalMax → lerp 1.0 → 0.4
    // d=4 : t = (4-3)/(6-3) = 1/3 → 1.0 - 0.6*(1/3) = 0.8
    expect(distancePrecision(4, 6, 2, 3)).toBeCloseTo(0.8, 5)
    // d=5 : t = 2/3 → 1.0 - 0.6*(2/3) = 0.6
    expect(distancePrecision(5, 6, 2, 3)).toBeCloseTo(0.6, 5)
    // d=6 : t = 1.0 → floor 0.4
    expect(distancePrecision(6, 6, 2, 3)).toBeCloseTo(0.4, 5)
  })

  it('mode explicit : hors portée [minRange, range] → 0', () => {
    expect(distancePrecision(1, 3, 2, 3)).toBe(0)  // < minRange
    expect(distancePrecision(7, 6, 2, 3)).toBe(0)  // > range
  })

  it('mode explicit est monotone décroissant au-delà de optimalMax', () => {
    const at3 = distancePrecision(3, 6, 2, 3)
    const at4 = distancePrecision(4, 6, 2, 3)
    const at5 = distancePrecision(5, 6, 2, 3)
    const at6 = distancePrecision(6, 6, 2, 3)
    expect(at3).toBeGreaterThanOrEqual(at4)
    expect(at4).toBeGreaterThanOrEqual(at5)
    expect(at5).toBeGreaterThanOrEqual(at6)
  })
})
