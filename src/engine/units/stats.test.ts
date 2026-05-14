// v2.0 (10/05/2026) — Phase 2 2A.2 : tests UNIT_STATS_V2 + resolveUnitStatsV2
// v1.0 (09/05/2026) — Phase 1 L1A.1 : tests stats de base
// Cible : 3 tests v1 + 4 tests v2

import { describe, it, expect } from 'vitest'
import {
  UNIT_STATS_BY_KIND,
  getUnitStats,
  UNIT_STATS_V2,
  getUnitStatsV2,
  resolveUnitStatsV2,
} from './stats'

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

describe('engine/units/stats — UNIT_STATS_V2 (Phase 2)', () => {
  it('definit les effectiveMax / effectiveMin Phase 2 conformes au brainstorm', () => {
    // I = 1 bataillon (700-800 hommes), C = 1 escadron (~180), A = 1 batterie (~120 servants)
    expect(UNIT_STATS_V2.I.effectiveMax).toBe(800)
    expect(UNIT_STATS_V2.I.effectiveMin).toBe(100)
    expect(UNIT_STATS_V2.C.effectiveMax).toBe(180)
    expect(UNIT_STATS_V2.C.effectiveMin).toBe(25)
    expect(UNIT_STATS_V2.A.effectiveMax).toBe(120)
    expect(UNIT_STATS_V2.A.effectiveMin).toBe(30)
  })

  it('A.subKindOverrides expose archer + artillery_light + artillery_heavy', () => {
    const overrides = UNIT_STATS_V2.A.subKindOverrides
    expect(overrides).toBeDefined()
    expect(overrides?.archer?.range).toBe(4)
    expect(overrides?.archer?.minRange).toBe(0)
    expect(overrides?.archer?.rangedPower).toBe(2.5)
    expect(overrides?.artillery_light?.range).toBe(3)
    expect(overrides?.artillery_light?.optimalRangeMax).toBe(3)
    expect(overrides?.artillery_heavy?.range).toBe(6)
    expect(overrides?.artillery_heavy?.optimalRangeMax).toBe(3)
  })

  it('resolveUnitStatsV2 applique override archer', () => {
    const baseA = getUnitStatsV2('A')
    const archer = resolveUnitStatsV2('A', 'archer')
    expect(archer.range).toBe(4)
    expect(archer.minRange).toBe(0)
    expect(archer.rangedPower).toBe(2.5)
    expect(archer.effectiveMax).toBe(baseA.effectiveMax)
    expect(archer.attack).toBe(baseA.attack)
  })

  it('resolveUnitStatsV2 retourne stats lourdes pour subKind=undefined (legacy)', () => {
    const baseA = getUnitStatsV2('A')
    expect(resolveUnitStatsV2('A')).toBe(baseA)
    expect(baseA.range).toBe(6)
    expect(baseA.optimalRangeMax).toBe(3)
  })

  it('resolveUnitStatsV2 artillery_light → range 3 + pas de falloff (max = optimal)', () => {
    const light = resolveUnitStatsV2('A', 'artillery_light')
    expect(light.range).toBe(3)
    expect(light.minRange).toBe(2)
    expect(light.rangedPower).toBe(3.0)
    expect(light.optimalRangeMax).toBe(3)
  })

  it('resolveUnitStatsV2 artillery_heavy → range 6 + zone optimale [2,3]', () => {
    const heavy = resolveUnitStatsV2('A', 'artillery_heavy')
    expect(heavy.range).toBe(6)
    expect(heavy.minRange).toBe(2)
    expect(heavy.rangedPower).toBe(5.0)
    expect(heavy.optimalRangeMax).toBe(3)
  })

  it('Phase 3.3 arcedTrajectory : light=obusier (true), heavy=canon (false)', () => {
    const light = resolveUnitStatsV2('A', 'artillery_light')
    const heavy = resolveUnitStatsV2('A', 'artillery_heavy')
    const archer = resolveUnitStatsV2('A', 'archer')
    expect(light.arcedTrajectory).toBe(true)
    expect(heavy.arcedTrajectory).toBe(false)
    // Archer = tir tendu (pas d'arc dans cette balance v1).
    expect(archer.arcedTrajectory ?? false).toBe(false)
  })

  it('UNIT_STATS_V2 et chaque entree sont frozen runtime', () => {
    expect(Object.isFrozen(UNIT_STATS_V2)).toBe(true)
    expect(Object.isFrozen(UNIT_STATS_V2.I)).toBe(true)
    expect(Object.isFrozen(UNIT_STATS_V2.C)).toBe(true)
    expect(Object.isFrozen(UNIT_STATS_V2.A)).toBe(true)
    expect(Object.isFrozen(UNIT_STATS_V2.A.subKindOverrides!)).toBe(true)
  })
})
