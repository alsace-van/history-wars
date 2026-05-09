// v1.0 (09/05/2026) — Phase 1 L1A.3 : tests preview
// Cible : 3 tests

import { describe, it, expect } from 'vitest'
import { cube } from '../hex'
import type { UnitState } from '../units/types'
import { previewMelee, previewRanged } from './preview'

function makeUnit(overrides: Partial<UnitState>): UnitState {
  return {
    id: 'u',
    kind: 'I',
    team: 'blue',
    position: cube(0, 0, 0),
    hp: 100,
    hpMax: 100,
    morale: 100,
    moraleMax: 100,
    hasMoved: false,
    hasAttacked: false,
    routed: false,
    ...overrides,
  }
}

describe('engine/combat/preview', () => {
  it('bornes coherentes : damageMin <= damageMax pour melee et ranged', () => {
    const atk = makeUnit({ id: 'a', kind: 'C', morale: 80 })
    const def = makeUnit({ id: 'd', kind: 'I', morale: 70, position: cube(1, 0, -1) })
    const m = previewMelee(atk, def, { flanked: false })
    const r = previewRanged(atk, def, { flanked: false })
    expect(m.damageMin).toBeLessThanOrEqual(m.damageMax)
    expect(r.damageMin).toBeLessThanOrEqual(r.damageMax)
    expect(m.damageMin).toBeGreaterThanOrEqual(0)
    expect(r.damageMin).toBeGreaterThanOrEqual(0)
  })

  it('killProbability = 1 si damageMin >= defender.hp', () => {
    // C vs A faible HP avec flanc : ATK 35 + 10 flanc + 5 morale = 50, DEF 15 - 15 morale = 0
    // roll min -10 → damage min = 40 >= hp 5
    const atk = makeUnit({ id: 'a', kind: 'C', morale: 90 })
    const def = makeUnit({ id: 'd', kind: 'A', morale: 30, hp: 5, position: cube(1, 0, -1) })
    const p = previewMelee(atk, def, { flanked: true })
    expect(p.killProbability).toBe(1)
  })

  it('killProbability = 0 si damageMax < defender.hp', () => {
    // attacker tres faible vs defender plein hp : damageMax bien sous hp 100
    const atk = makeUnit({ id: 'a', kind: 'A', morale: 30 })
    const def = makeUnit({ id: 'd', kind: 'I', morale: 90, hp: 100, position: cube(1, 0, -1) })
    const p = previewMelee(atk, def, { flanked: false })
    expect(p.damageMax).toBeLessThan(def.hp)
    expect(p.killProbability).toBe(0)
  })
})
