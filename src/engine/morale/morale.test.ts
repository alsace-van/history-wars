// v1.0 (09/05/2026) — Phase 1 L1A.1 : tests moral
// Cible : 4 tests (PLAN-PHASE-1.md § 2.2)

import { describe, it, expect } from 'vitest'
import { cube } from '../hex'
import type { UnitState } from '../units/types'
import {
  MORALE_ROUT_THRESHOLD,
  MORALE_RECOVER_PER_TURN,
  applyMoraleDelta,
  isRouted,
  moraleCombatBonus,
  recoverMoraleEndTurn,
} from './morale'

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
    ...overrides,
  }
}

describe('engine/morale', () => {
  it('delta negatif : baisse mais ne descend pas sous 0', () => {
    const u = makeUnit({ morale: 10 })
    const r = applyMoraleDelta(u, -50)
    expect(r.morale).toBe(0)
    expect(r.routed).toBe(true)
  })

  it('delta positif : monte mais ne depasse pas moraleMax', () => {
    const u = makeUnit({ morale: 90, moraleMax: 100 })
    const r = applyMoraleDelta(u, 50)
    expect(r.morale).toBe(100)
    expect(r.routed).toBe(false)
  })

  it('sous le seuil → routed:true ; au seuil exact → routed:false', () => {
    const sub = applyMoraleDelta(makeUnit({ morale: 50 }), -(50 - MORALE_ROUT_THRESHOLD + 1))
    expect(sub.morale).toBe(MORALE_ROUT_THRESHOLD - 1)
    expect(sub.routed).toBe(true)
    expect(isRouted(sub)).toBe(true)

    const onThreshold = applyMoraleDelta(makeUnit({ morale: 50 }), -(50 - MORALE_ROUT_THRESHOLD))
    expect(onThreshold.morale).toBe(MORALE_ROUT_THRESHOLD)
    expect(onThreshold.routed).toBe(false)
  })

  it('recover end-turn : ignore si combat ou ZdC ennemie, applique sinon', () => {
    const u = makeUnit({ morale: 60 })
    expect(recoverMoraleEndTurn(u, false, false).morale).toBe(60 + MORALE_RECOVER_PER_TURN)
    expect(recoverMoraleEndTurn(u, true,  false).morale).toBe(60)
    expect(recoverMoraleEndTurn(u, false, true ).morale).toBe(60)
    expect(recoverMoraleEndTurn(u, true,  true ).morale).toBe(60)

    // bonus combat coherent avec le seuil
    expect(moraleCombatBonus(makeUnit({ morale: 40 }))).toBe(-15)
    expect(moraleCombatBonus(makeUnit({ morale: 60 }))).toBe(0)
    expect(moraleCombatBonus(makeUnit({ morale: 90 }))).toBe(5)
  })
})
