// v1.2 (13/05/2026) — Phase 3.2-bis : routed désormais basé sur effectif (<20%), pas moral
// v1.1 (11/05/2026) — Phase 2.5 : tests recoverMoraleEndTurnV2 + moraleCombatLossMultiplier
// v1.0 (09/05/2026) — Phase 1 L1A.1 : tests moral

import { describe, it, expect } from 'vitest'
import type { SupportCount } from '../cohesion/types'
import { cube } from '../hex'
import type { UnitState } from '../units/types'
import {
  MORALE_COMBAT_LOSS_MULT_FLOOR,
  MORALE_RECOVER_PER_TURN,
  ROUT_EFFECTIVE_RATIO,
  applyMoraleDelta,
  computeRouted,
  isRouted,
  moraleCombatBonus,
  moraleCombatLossMultiplier,
  recoverMoraleEndTurn,
  recoverMoraleEndTurnV2,
} from './morale'

const NO_SUPPORT: SupportCount = { adjacent: 0, nearby: 0, total: 0 }

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
    // Phase 2 (v2) defaults
    effective: 100,
    effectiveMax: 100,
    effectiveMin: 10,
    killed: 0,
    ...overrides,
  }
}

describe('engine/morale', () => {
  it('delta negatif : baisse mais ne descend pas sous 0 ; routed ne dépend plus du moral (Phase 3.2-bis)', () => {
    const u = makeUnit({ morale: 10 })
    const r = applyMoraleDelta(u, -50)
    expect(r.morale).toBe(0)
    // Phase 3.2-bis : effectif plein (100/100) → pas routed même si moral=0.
    expect(r.routed).toBe(false)
  })

  it('delta positif : monte mais ne depasse pas moraleMax', () => {
    const u = makeUnit({ morale: 90, moraleMax: 100 })
    const r = applyMoraleDelta(u, 50)
    expect(r.morale).toBe(100)
    expect(r.routed).toBe(false)
  })

  it('routed dépend de l\'effectif : <20% effectiveMax → routed, ≥20% → non', () => {
    // Effectif 15/100 = 15% → routed
    const lowEff = makeUnit({ effective: 15, effectiveMax: 100, morale: 100 })
    expect(computeRouted(15, 100)).toBe(true)
    expect(isRouted(lowEff)).toBe(true)
    // Effectif 20/100 = 20% pile → seuil strict, non routed (< 0.20, pas ≤)
    const onThreshold = makeUnit({ effective: 20, effectiveMax: 100, morale: 0 })
    expect(computeRouted(20, 100)).toBe(false)
    expect(isRouted(onThreshold)).toBe(false)
    // Effectif 19/100 = 19% → routed
    expect(computeRouted(19, 100)).toBe(true)
    // applyMoraleDelta propage cette règle
    const result = applyMoraleDelta(lowEff, +50)
    expect(result.routed).toBe(true)
  })

  it('ROUT_EFFECTIVE_RATIO = 0.20 (= 20% effectiveMax)', () => {
    expect(ROUT_EFFECTIVE_RATIO).toBe(0.20)
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

describe('engine/morale — Phase 2.5 support modulators', () => {
  it('recoverMoraleEndTurnV2 sans soutien ≡ recoverMoraleEndTurn (régression)', () => {
    const u = makeUnit({ morale: 60 })
    expect(recoverMoraleEndTurnV2(u, false, false, NO_SUPPORT).morale).toBe(60 + MORALE_RECOVER_PER_TURN)
    expect(recoverMoraleEndTurnV2(u, true,  false, NO_SUPPORT).morale).toBe(60)
    expect(recoverMoraleEndTurnV2(u, false, true,  NO_SUPPORT).morale).toBe(60)
  })

  it('recoverMoraleEndTurnV2 +1 par allié adjacent (max 3)', () => {
    const u = makeUnit({ morale: 60 })
    const r1: SupportCount = { adjacent: 1, nearby: 0, total: 1 }
    const r3: SupportCount = { adjacent: 3, nearby: 0, total: 3 }
    expect(recoverMoraleEndTurnV2(u, false, false, r1).morale).toBe(60 + MORALE_RECOVER_PER_TURN + 1)
    expect(recoverMoraleEndTurnV2(u, false, false, r3).morale).toBe(60 + MORALE_RECOVER_PER_TURN + 3)
  })

  it('recoverMoraleEndTurnV2 +0.5 par allié rayon 2 (arrondi)', () => {
    const u = makeUnit({ morale: 60 })
    // 2 nearby → +1, total delta = 5+1 = 6
    const r: SupportCount = { adjacent: 0, nearby: 2, total: 1 }
    expect(recoverMoraleEndTurnV2(u, false, false, r).morale).toBe(60 + 6)
  })

  it('recoverMoraleEndTurnV2 bloquée si en ZdC ennemie même avec soutien', () => {
    const u = makeUnit({ morale: 20 })
    const r: SupportCount = { adjacent: 3, nearby: 0, total: 3 }
    expect(recoverMoraleEndTurnV2(u, false, true, r).morale).toBe(20) // bloqué
  })

  it('moraleCombatLossMultiplier : 0 allié → 1.0', () => {
    expect(moraleCombatLossMultiplier(NO_SUPPORT)).toBe(1.0)
  })

  it('moraleCombatLossMultiplier : 1 allié → 0.9', () => {
    const s: SupportCount = { adjacent: 1, nearby: 0, total: 1 }
    expect(moraleCombatLossMultiplier(s)).toBeCloseTo(0.9, 5)
  })

  it('moraleCombatLossMultiplier : 2 alliés → 0.81', () => {
    const s: SupportCount = { adjacent: 2, nearby: 0, total: 2 }
    expect(moraleCombatLossMultiplier(s)).toBeCloseTo(0.81, 5)
  })

  it('moraleCombatLossMultiplier : 3 alliés → 0.729', () => {
    const s: SupportCount = { adjacent: 3, nearby: 0, total: 3 }
    expect(moraleCombatLossMultiplier(s)).toBeCloseTo(0.729, 5)
  })

  it('moraleCombatLossMultiplier : 5+ alliés cap floor', () => {
    const s: SupportCount = { adjacent: 5, nearby: 0, total: 3 }
    // sans floor : 0.9^5 = 0.59 → clamp à MORALE_COMBAT_LOSS_MULT_FLOOR (0.7)
    // Mais notre formule clampe adjacent à 3 → 0.729, donc supérieur au floor
    expect(moraleCombatLossMultiplier(s)).toBeCloseTo(0.729, 5)
    expect(moraleCombatLossMultiplier(s)).toBeGreaterThanOrEqual(MORALE_COMBAT_LOSS_MULT_FLOOR)
  })
})
