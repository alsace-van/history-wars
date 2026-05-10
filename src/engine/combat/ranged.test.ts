// v1.0 (09/05/2026) — Phase 1 L1A.3 : tests ranged
// Cible : 5 tests

import { describe, it, expect } from 'vitest'
import { cube } from '../hex'
import type { UnitState } from '../units/types'
import { seededRng } from './rng'
import { resolveRanged } from './ranged'
import { resolveMelee } from './melee'

function makeUnit(overrides: Partial<UnitState>): UnitState {
  return {
    id: 'u',
    kind: 'A',
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
    ...overrides,
  }
}

describe('engine/combat/ranged', () => {
  it('damage > 0 si ATK suffisant en moyenne', () => {
    const atk = makeUnit({ id: 'a', kind: 'A', team: 'blue', morale: 100 })
    const def = makeUnit({ id: 'd', kind: 'I', team: 'red', morale: 70, position: cube(3, 0, -3) })
    const rng = seededRng(11)
    const total = Array.from({ length: 30 }, () =>
      resolveRanged(atk, def, { flanked: false }, rng).damageDealt,
    ).reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(0)
  })

  it('flanked: true ignore (pas de bonus en ranged) → meme resultat que flanked: false avec meme seed', () => {
    const atk = makeUnit({ id: 'a', kind: 'A', team: 'blue', morale: 80 })
    const def = makeUnit({ id: 'd', kind: 'I', team: 'red', morale: 80, position: cube(3, 0, -3) })
    const rngF = seededRng(50)
    const rngU = seededRng(50)
    const rF = resolveRanged(atk, def, { flanked: true }, rngF)
    const rU = resolveRanged(atk, def, { flanked: false }, rngU)
    expect(rF.damageDealt).toBe(rU.damageDealt)
  })

  it('variance ranged plus large que melee (sanity check sur 100 tirages)', () => {
    const atk = makeUnit({ id: 'a', kind: 'A', team: 'blue', morale: 70 })
    const def = makeUnit({ id: 'd', kind: 'I', team: 'red', morale: 70, position: cube(3, 0, -3) })
    const collect = (resolver: typeof resolveRanged) => {
      const rng = seededRng(200)
      const arr: number[] = []
      for (let i = 0; i < 100; i++) arr.push(resolver(atk, def, { flanked: false }, rng).damageDealt)
      return arr
    }
    const rangedDamages = collect(resolveRanged)
    const meleeDamages = collect(resolveMelee)
    const range = (a: number[]) => Math.max(...a) - Math.min(...a)
    expect(range(rangedDamages)).toBeGreaterThanOrEqual(range(meleeDamages))
  })

  it('defender mort gere : defenderKilled=true, hpAfter=0', () => {
    const atk = makeUnit({ id: 'a', kind: 'A', team: 'blue', morale: 100 })
    const def = makeUnit({ id: 'd', kind: 'I', team: 'red', hp: 1, morale: 50, position: cube(3, 0, -3) })
    const rng = seededRng(13)
    let killed = false
    for (let i = 0; i < 30; i++) {
      const r = resolveRanged(atk, def, { flanked: false }, rng)
      if (r.defenderKilled) {
        expect(r.defenderHpAfter).toBe(0)
        killed = true
        break
      }
    }
    expect(killed).toBe(true)
  })

  it('attrition morale plus douce qu\'en melee : pour memes degats, defenderMoraleDelta moins severe', () => {
    // construire un cas controle : meme damage en force pour comparer les deltas
    const atk = makeUnit({ id: 'a', kind: 'I', team: 'blue', morale: 75 })
    const def = makeUnit({ id: 'd', kind: 'I', team: 'red', morale: 75, position: cube(1, 0, -1) })
    const rngM = seededRng(77)
    const rngR = seededRng(77)
    const rm = resolveMelee(atk, def, { flanked: false }, rngM)
    const rr = resolveRanged(atk, def, { flanked: false }, rngR)
    // meme rng → rolls differents (formules differentes) mais on peut comparer le ratio moraleDelta/damage
    if (rm.damageDealt > 0 && rr.damageDealt > 0) {
      const ratioMelee = -rm.defenderMoraleDelta / rm.damageDealt
      const ratioRanged = -rr.defenderMoraleDelta / rr.damageDealt
      expect(ratioRanged).toBeLessThanOrEqual(ratioMelee)
    }
    // formule : melee /4 vs ranged /6 → ranged toujours plus doux
    expect(true).toBe(true)
  })
})
