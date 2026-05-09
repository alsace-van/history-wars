// v1.0 (09/05/2026) — Phase 1 L1A.1 : tests stats de base
// Cible : 3 tests (PLAN-PHASE-1.md § 2.2)

import { describe, it, expect } from 'vitest'
import { UNIT_STATS_BY_KIND, getUnitStats } from './stats'

describe('engine/units/stats', () => {
  it('definit des stats pour I, C et A avec les bonnes valeurs', () => {
    expect(UNIT_STATS_BY_KIND.I).toEqual({ hpMax: 100, attack: 25, defense: 30, range: 1, movement: 3, moraleMax: 100 })
    expect(UNIT_STATS_BY_KIND.C).toEqual({ hpMax:  80, attack: 35, defense: 20, range: 1, movement: 6, moraleMax: 100 })
    expect(UNIT_STATS_BY_KIND.A).toEqual({ hpMax:  60, attack: 40, defense: 15, range: 4, movement: 2, moraleMax: 100 })
    expect(getUnitStats('I')).toBe(UNIT_STATS_BY_KIND.I)
  })

  it('verrouille les stats runtime (Object.isFrozen)', () => {
    expect(Object.isFrozen(UNIT_STATS_BY_KIND)).toBe(true)
    expect(Object.isFrozen(UNIT_STATS_BY_KIND.I)).toBe(true)
    expect(Object.isFrozen(UNIT_STATS_BY_KIND.C)).toBe(true)
    expect(Object.isFrozen(UNIT_STATS_BY_KIND.A)).toBe(true)
  })

  it('respecte les invariants de jeu : hpMax > 0, range >= 1, movement >= 1, attack/defense >= 0', () => {
    for (const kind of ['I', 'C', 'A'] as const) {
      const s = UNIT_STATS_BY_KIND[kind]
      expect(s.hpMax).toBeGreaterThan(0)
      expect(s.range).toBeGreaterThanOrEqual(1)
      expect(s.movement).toBeGreaterThanOrEqual(1)
      expect(s.attack).toBeGreaterThanOrEqual(0)
      expect(s.defense).toBeGreaterThanOrEqual(0)
      expect(s.moraleMax).toBeGreaterThan(0)
    }
  })
})
