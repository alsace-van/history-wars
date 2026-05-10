// v1.0 (09/05/2026) — Phase 1 L1A.3 : tests melee
// Cible : 6 tests

import { describe, it, expect } from 'vitest'
import { cube } from '../hex'
import type { UnitState } from '../units/types'
import { seededRng } from './rng'
import { resolveMelee } from './melee'

function makeUnit(overrides: Partial<UnitState>): UnitState {
  return {
    id: 'u',
    kind: 'I',
    team: 'blue',
    position: cube(0, 0, 0),
    hp: 100,
    hpMax: 100,
    wounded: 0,
    morale: 100,
    moraleMax: 100,
    hasMoved: false,
    hasAttacked: false,
    routed: false,
    // Phase 2 (v2) defaults : mappes 1:1 sur hp pour tests legacy v1
    effective: 100,
    effectiveMax: 100,
    effectiveMin: 10,
    killed: 0,
    ...overrides,
  }
}

describe('engine/combat/melee', () => {
  it('ATK clairement > DEF → damage > 0', () => {
    // C: atk 35 vs I: def 30 + morale haute donne avantage
    const atk = makeUnit({ id: 'a', kind: 'C', team: 'blue', morale: 100 })
    const def = makeUnit({ id: 'd', kind: 'I', team: 'red', morale: 100, position: cube(1, 0, -1) })
    // moyenne sur plusieurs rolls pour eviter la queue de distribution
    const rng = seededRng(1)
    const total = Array.from({ length: 20 }, () =>
      resolveMelee(atk, def, { flanked: false }, rng).damageDealt,
    ).reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(0)
  })

  it('DEF >> ATK → damage clampe au plancher MIN_DAMAGE_MELEE = 1 (realisme)', () => {
    // attacker tres faible vs defender tres fort : ATK_eff - DEF_eff < 0
    // v1.2 : plancher 1 au lieu de 0 (un engagement melee tue toujours ≥ 1 soldat)
    const atk = makeUnit({ id: 'a', kind: 'A', team: 'blue', morale: 30 })
    const def = makeUnit({ id: 'd', kind: 'I', team: 'red', morale: 80, position: cube(1, 0, -1) })
    const rng = seededRng(2)
    for (let i = 0; i < 50; i++) {
      const r = resolveMelee(atk, def, { flanked: false }, rng)
      expect(r.damageDealt).toBeGreaterThanOrEqual(1)
    }
    // au moins une iteration tape le plancher 1 (cas defavorable)
    const rng2 = seededRng(2)
    const damages = Array.from({ length: 50 }, () => resolveMelee(atk, def, { flanked: false }, rng2).damageDealt)
    expect(damages.some(d => d === 1)).toBe(true)
  })

  it('flanc augmente le damage moyen (meme seed comparaison)', () => {
    const atk = makeUnit({ id: 'a', kind: 'I', team: 'blue', morale: 70 })
    const def = makeUnit({ id: 'd', kind: 'I', team: 'red', morale: 70, position: cube(1, 0, -1) })
    const sumDamage = (flanked: boolean) => {
      const rng = seededRng(99)
      let total = 0
      for (let i = 0; i < 30; i++) {
        total += resolveMelee(atk, def, { flanked }, rng).damageDealt
      }
      return total
    }
    expect(sumDamage(true)).toBeGreaterThan(sumDamage(false))
  })

  it('HP=10 et damage >= HP → defenderHpAfter=0 et defenderKilled=true', () => {
    const atk = makeUnit({ id: 'a', kind: 'C', team: 'blue', morale: 100 })
    const def = makeUnit({ id: 'd', kind: 'A', team: 'red', morale: 30, hp: 10, position: cube(1, 0, -1) })
    // C atk 35 vs A def 15 + malus morale -15 = 0 → ecart 35 + roll → damage tres souvent >= 10
    const rng = seededRng(7)
    let killed = false
    for (let i = 0; i < 30; i++) {
      const r = resolveMelee(atk, def, { flanked: true }, rng)
      if (r.defenderKilled) {
        expect(r.defenderHpAfter).toBe(0)
        killed = true
        break
      }
    }
    expect(killed).toBe(true)
  })

  it('seed reproductible : memes rng → memes resultats', () => {
    const atk = makeUnit({ id: 'a', kind: 'I', team: 'blue', morale: 70 })
    const def = makeUnit({ id: 'd', kind: 'I', team: 'red', morale: 70, position: cube(1, 0, -1) })
    const rngA = seededRng(123)
    const rngB = seededRng(123)
    const r1 = resolveMelee(atk, def, { flanked: false }, rngA)
    const r2 = resolveMelee(atk, def, { flanked: false }, rngB)
    expect(r1).toEqual(r2)
  })

  it('defender mort → defenderKilled true et morale appliquee', () => {
    const atk = makeUnit({ id: 'a', kind: 'C', team: 'blue', morale: 100 })
    const def = makeUnit({ id: 'd', kind: 'A', team: 'red', hp: 1, position: cube(1, 0, -1) })
    const rng = seededRng(5)
    const r = resolveMelee(atk, def, { flanked: true }, rng)
    expect(r.defenderKilled).toBe(true)
    expect(r.defenderHpAfter).toBe(0)
    // morale du defenseur a baisse (ou reste 0 si deja en bas)
    expect(r.defenderMoraleAfter).toBeLessThanOrEqual(def.morale)
  })

  it('split casualties : killed + woundedAdd === actualDamage (Phase 1.5)', () => {
    // Force des degats > 0 : C vs I avec flanc + morale haute
    const atk = makeUnit({ id: 'a', kind: 'C', morale: 100 })
    const def = makeUnit({ id: 'd', kind: 'I', morale: 100, hp: 100, position: cube(1, 0, -1) })
    const rng = seededRng(42)
    for (let i = 0; i < 30; i++) {
      const r = resolveMelee(atk, def, { flanked: true }, rng)
      expect(r.killed + r.woundedAdd).toBe(r.actualDamage)
      expect(r.killed).toBeGreaterThanOrEqual(0)
      expect(r.woundedAdd).toBeGreaterThanOrEqual(0)
      // ratio 60/40 attendu (round → tolerance ±1)
      if (r.actualDamage > 1) {
        const expectedKilled = Math.round(r.actualDamage * 0.6)
        expect(r.killed).toBe(expectedKilled)
      }
    }
  })

  it('defenderWoundedAfter = wounded initial + woundedAdd, capped a hpMax - hpAfter', () => {
    const atk = makeUnit({ id: 'a', kind: 'C', morale: 100 })
    const def = makeUnit({ id: 'd', kind: 'I', morale: 100, hp: 50, wounded: 30, hpMax: 100, position: cube(1, 0, -1) })
    const rng = seededRng(7)
    const r = resolveMelee(atk, def, { flanked: false }, rng)
    expect(r.defenderWoundedAfter).toBeLessThanOrEqual(def.hpMax - r.defenderHpAfter)
    expect(r.defenderWoundedAfter).toBeGreaterThanOrEqual(def.wounded)
  })
})
