// v1.0 (11/05/2026) — Phase 2.5 : tests computeSupport, computeCohesion, getCohesionState
// Source : docs/PLAN-MORAL-COHESION.md § 1-2

import { describe, expect, it } from 'vitest'
import { cube } from '../hex'
import type { UnitState } from '../units/types'
import {
  computeCohesion,
  computeSupport,
  getCohesionState,
  SUPPORT_PLAFOND,
} from './index'

function makeUnit(overrides: Partial<UnitState> = {}): UnitState {
  return {
    id: 'u1',
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
    effective: 800,
    effectiveMax: 800,
    effectiveMin: 100,
    killed: 0,
    ...overrides,
  }
}

describe('engine/cohesion — computeSupport', () => {
  it('unité totalement isolée → 0 partout', () => {
    const u = makeUnit()
    const s = computeSupport(u, [u])
    expect(s.adjacent).toBe(0)
    expect(s.nearby).toBe(0)
    expect(s.total).toBe(0)
  })

  it('1 allié adjacent (rayon 1) → adjacent=1, total=1', () => {
    const u = makeUnit({ id: 'u1', position: cube(0, 0, 0) })
    const ally = makeUnit({ id: 'u2', position: cube(1, 0, -1) }) // distance 1
    const s = computeSupport(u, [u, ally])
    expect(s.adjacent).toBe(1)
    expect(s.nearby).toBe(0)
    expect(s.total).toBe(1)
  })

  it('1 allié rayon 2 → nearby=1, total=0.5', () => {
    const u = makeUnit({ id: 'u1', position: cube(0, 0, 0) })
    const ally = makeUnit({ id: 'u2', position: cube(2, 0, -2) }) // distance 2
    const s = computeSupport(u, [u, ally])
    expect(s.adjacent).toBe(0)
    expect(s.nearby).toBe(1)
    expect(s.total).toBe(0.5)
  })

  it('mix : 2 adjacents + 2 rayon 2 → total = 2 + 1 = 3 (capé au plafond)', () => {
    const u = makeUnit({ id: 'u1', position: cube(0, 0, 0) })
    const allies = [
      makeUnit({ id: 'a1', position: cube(1, 0, -1) }),
      makeUnit({ id: 'a2', position: cube(-1, 0, 1) }),
      makeUnit({ id: 'a3', position: cube(2, 0, -2) }),
      makeUnit({ id: 'a4', position: cube(-2, 0, 2) }),
    ]
    const s = computeSupport(u, [u, ...allies])
    expect(s.adjacent).toBe(2)
    expect(s.nearby).toBe(2)
    expect(s.total).toBe(SUPPORT_PLAFOND) // 2 + 2×0.5 = 3, exact
  })

  it('plafond : 5 adjacents → total clampé à 3', () => {
    const u = makeUnit({ id: 'u1', position: cube(0, 0, 0) })
    const allies = [
      makeUnit({ id: 'a1', position: cube(1, 0, -1) }),
      makeUnit({ id: 'a2', position: cube(-1, 0, 1) }),
      makeUnit({ id: 'a3', position: cube(0, 1, -1) }),
      makeUnit({ id: 'a4', position: cube(0, -1, 1) }),
      makeUnit({ id: 'a5', position: cube(1, -1, 0) }),
    ]
    const s = computeSupport(u, [u, ...allies])
    expect(s.adjacent).toBe(5)
    expect(s.total).toBe(SUPPORT_PLAFOND)
  })

  it('ennemis adjacents ignorés', () => {
    const u = makeUnit({ id: 'u1', position: cube(0, 0, 0), team: 'blue' })
    const enemy = makeUnit({ id: 'e1', position: cube(1, 0, -1), team: 'red' })
    const s = computeSupport(u, [u, enemy])
    expect(s.total).toBe(0)
  })

  it('alliés routés ignorés (proxy Brisé)', () => {
    const u = makeUnit({ id: 'u1', position: cube(0, 0, 0) })
    const allyRouted = makeUnit({
      id: 'a1',
      position: cube(1, 0, -1),
      routed: true,
      morale: 10,
    })
    const s = computeSupport(u, [u, allyRouted])
    expect(s.total).toBe(0)
  })

  it('alliés sous effectiveMin ignorés (proxy Brisé)', () => {
    const u = makeUnit({ id: 'u1', position: cube(0, 0, 0) })
    const allyEmpty = makeUnit({
      id: 'a1',
      position: cube(1, 0, -1),
      effective: 100, // = effectiveMin → exclu
    })
    const s = computeSupport(u, [u, allyEmpty])
    expect(s.total).toBe(0)
  })

  it('rayon 3+ ignoré', () => {
    const u = makeUnit({ id: 'u1', position: cube(0, 0, 0) })
    const far = makeUnit({ id: 'a1', position: cube(3, 0, -3) }) // distance 3
    const s = computeSupport(u, [u, far])
    expect(s.total).toBe(0)
  })
})

describe('engine/cohesion — computeCohesion', () => {
  it('unité pleine isolée → cohésion ~0.8 (Nominal)', () => {
    // morale 100/100 = 1.0 × 0.5 = 0.5
    // effective 800/800 = 1.0 × 0.3 = 0.3
    // support 0 = 0
    // total = 0.8 → Nominal
    const u = makeUnit()
    const c = computeCohesion(u, { adjacent: 0, nearby: 0, total: 0 })
    expect(c.total).toBeCloseTo(0.8, 5)
    expect(c.state).toBe('nominal')
  })

  it('unité pleine + 3 alliés adjacents → cohésion = 1.0 (Nominal max)', () => {
    const u = makeUnit()
    const c = computeCohesion(u, { adjacent: 3, nearby: 0, total: 3 })
    expect(c.total).toBeCloseTo(1.0, 5)
    expect(c.state).toBe('nominal')
  })

  it('reproduit le soft-lock Session 16 : I 354/800 moral 22 isolée → Ébranlée (pas Brisée)', () => {
    // morale 22/100 × 0.5 = 0.11
    // effective 354/800 × 0.3 = 0.13275
    // support 0
    // total ≈ 0.24 → shaken
    const u = makeUnit({ morale: 22, effective: 354 })
    const c = computeCohesion(u, { adjacent: 0, nearby: 0, total: 0 })
    expect(c.total).toBeGreaterThan(0.2)
    expect(c.total).toBeLessThan(0.3)
    expect(c.state).toBe('shaken')
  })

  it('même unité + 1 allié adjacent → cohésion remonte (Ébranlée confortable)', () => {
    // support 1/3 × 0.2 = 0.0667 ajouté
    const u = makeUnit({ morale: 22, effective: 354 })
    const c = computeCohesion(u, { adjacent: 1, nearby: 0, total: 1 })
    expect(c.total).toBeGreaterThan(0.3)
    expect(c.state).toBe('shaken')
  })

  it('unité quasi-vide isolée moral bas → Brisée', () => {
    // moral 10 × 0.5 = 0.05
    // effective 100/800 × 0.3 = 0.0375
    // support 0
    // total ≈ 0.09 → broken
    const u = makeUnit({ morale: 10, effective: 100 })
    const c = computeCohesion(u, { adjacent: 0, nearby: 0, total: 0 })
    expect(c.total).toBeLessThan(0.2)
    expect(c.state).toBe('broken')
  })

  it('breakdown : composants stockés séparément pour UI', () => {
    const u = makeUnit({ morale: 50, effective: 400 })
    const c = computeCohesion(u, { adjacent: 2, nearby: 0, total: 2 })
    expect(c.morale).toBeCloseTo(0.25, 5) // 0.5 × 0.5
    expect(c.effective).toBeCloseTo(0.15, 5) // 0.5 × 0.3
    expect(c.support).toBeCloseTo(0.1333, 3) // 2/3 × 0.2
    expect(c.total).toBeCloseTo(c.morale + c.effective + c.support, 5)
  })

  it('protège contre moraleMax/effectiveMax = 0 (pas de division par 0)', () => {
    const u = makeUnit({ moraleMax: 0, effectiveMax: 0 })
    const c = computeCohesion(u, { adjacent: 0, nearby: 0, total: 0 })
    expect(c.total).toBe(0)
    expect(c.state).toBe('broken')
  })
})

describe('engine/cohesion — getCohesionState', () => {
  it('cohesion > 0.5 → nominal', () => {
    expect(getCohesionState(0.6)).toBe('nominal')
    expect(getCohesionState(1.0)).toBe('nominal')
  })

  it('frontière 0.5 : exactement 0.5 → shaken (frontière incluse dans état inférieur)', () => {
    expect(getCohesionState(0.5)).toBe('shaken')
  })

  it('frontière 0.2 : exactement 0.2 → broken', () => {
    expect(getCohesionState(0.2)).toBe('broken')
  })

  it('entre 0.2 et 0.5 → shaken', () => {
    expect(getCohesionState(0.3)).toBe('shaken')
    expect(getCohesionState(0.49)).toBe('shaken')
  })

  it('cohesion < 0.2 → broken', () => {
    expect(getCohesionState(0.1)).toBe('broken')
    expect(getCohesionState(0)).toBe('broken')
  })
})
