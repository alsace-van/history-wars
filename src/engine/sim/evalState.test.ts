// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : tests evalState
import { describe, it, expect } from 'vitest'
import { cube } from '../hex'
import type { UnitState } from '../units/types'
import { evalState } from './evalState'
import type { SimState } from './types'

function makeUnit(over: Partial<UnitState> & { id: string }): UnitState {
  return {
    kind: 'I',
    team: 'blue',
    position: cube(0, 0, 0),
    hp: 100,
    hpMax: 100,
    wounded: 0,
    morale: 75,
    moraleMax: 100,
    hasMoved: false,
    hasAttacked: false,
    routed: false,
    effective: 400,
    effectiveMax: 800,
    effectiveMin: 100,
    killed: 0,
    ...over,
  }
}

function makeState(units: UnitState[]): SimState {
  return { units, engagedUnitIds: new Set(), turn: 1 }
}

describe('engine/sim/evalState', () => {
  it('égalité forces → eval ~= 0', () => {
    const me = makeUnit({ id: 'm', team: 'blue', effective: 400, morale: 75 })
    const enemy = makeUnit({ id: 'e', team: 'red', effective: 400, morale: 75 })
    const v = evalState(makeState([me, enemy]), 'blue')
    expect(v).toBe(0)
  })

  it('bot supérieur (plus d\'effective) → eval > 0', () => {
    const me = makeUnit({ id: 'm', team: 'blue', effective: 800 })
    const enemy = makeUnit({ id: 'e', team: 'red', effective: 200 })
    const v = evalState(makeState([me, enemy]), 'blue')
    expect(v).toBeGreaterThan(0)
  })

  it('bot inférieur → eval < 0', () => {
    const me = makeUnit({ id: 'm', team: 'blue', effective: 200 })
    const enemy = makeUnit({ id: 'e', team: 'red', effective: 800 })
    const v = evalState(makeState([me, enemy]), 'blue')
    expect(v).toBeLessThan(0)
  })

  it('ennemi routed pénalise fortement l\'adversaire (bonus bot)', () => {
    const me = makeUnit({ id: 'm', team: 'blue', effective: 400, morale: 75 })
    const enemyOk = makeUnit({ id: 'eOk', team: 'red', effective: 400, morale: 75 })
    const enemyRouted = makeUnit({ id: 'eR', team: 'red', effective: 400, morale: 75, routed: true })
    const vOk = evalState(makeState([me, enemyOk]), 'blue')
    const vRouted = evalState(makeState([me, enemyRouted]), 'blue')
    expect(vRouted).toBeGreaterThan(vOk)
    expect(vRouted - vOk).toBeCloseTo(100, 0) // ROUTED_PENALTY = 100
  })

  it('allié routed pénalise le bot', () => {
    const meOk = makeUnit({ id: 'mOk', team: 'blue', effective: 400, morale: 75 })
    const meRouted = makeUnit({ id: 'mR', team: 'blue', effective: 400, morale: 75, routed: true })
    const vOk = evalState(makeState([meOk]), 'blue')
    const vRouted = evalState(makeState([meRouted]), 'blue')
    expect(vRouted).toBeLessThan(vOk)
  })

  it('symétrie : eval(state, blue) === -eval(state, red)', () => {
    const me = makeUnit({ id: 'm', team: 'blue', effective: 600, morale: 80 })
    const enemy = makeUnit({ id: 'e', team: 'red', effective: 300, morale: 50 })
    const vBlue = evalState(makeState([me, enemy]), 'blue')
    const vRed = evalState(makeState([me, enemy]), 'red')
    expect(vBlue).toBe(-vRed)
  })
})
