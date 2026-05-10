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

  it('A possede archerOverride pour subKind=archer (range=4, minRange=0)', () => {
    expect(UNIT_STATS_V2.A.archerOverride).toBeDefined()
    expect(UNIT_STATS_V2.A.archerOverride?.range).toBe(4)
    expect(UNIT_STATS_V2.A.archerOverride?.minRange).toBe(0)
    expect(UNIT_STATS_V2.A.archerOverride?.rangedPower).toBe(2.5)
  })

  it('resolveUnitStatsV2 applique archerOverride si subKind=archer', () => {
    const baseA = getUnitStatsV2('A')
    const archer = resolveUnitStatsV2('A', 'archer')
    expect(archer.range).toBe(4)
    expect(archer.minRange).toBe(0)
    expect(archer.rangedPower).toBe(2.5)
    // les autres champs restent identiques (effectiveMax, attack, defense, etc.)
    expect(archer.effectiveMax).toBe(baseA.effectiveMax)
    expect(archer.attack).toBe(baseA.attack)
  })

  it('resolveUnitStatsV2 retourne les stats de base pour subKind=artillery ou undefined', () => {
    const baseA = getUnitStatsV2('A')
    expect(resolveUnitStatsV2('A')).toBe(baseA)
    expect(resolveUnitStatsV2('A', 'artillery')).toBe(baseA)
  })

  it('UNIT_STATS_V2 et chaque entree sont frozen runtime', () => {
    expect(Object.isFrozen(UNIT_STATS_V2)).toBe(true)
    expect(Object.isFrozen(UNIT_STATS_V2.I)).toBe(true)
    expect(Object.isFrozen(UNIT_STATS_V2.C)).toBe(true)
    expect(Object.isFrozen(UNIT_STATS_V2.A)).toBe(true)
    expect(Object.isFrozen(UNIT_STATS_V2.A.archerOverride!)).toBe(true)
  })
})
