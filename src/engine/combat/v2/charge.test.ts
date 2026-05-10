// v1.0 (10/05/2026) — Phase 2 2A.7 : tests detection + multiplicateur charge cav
// Cible : 8+ tests (PLAN-PHASE-2-COMBAT-V2.md § 2A.11)

import { describe, it, expect } from 'vitest'
import { cube } from '../../hex'
import type { UnitState } from '../../units/types'
import {
  isPathStraight,
  chargedDistance,
  chargeMultiplier,
  isChargeApplicable,
} from './charge'

function makeUnit(overrides: Partial<UnitState>): UnitState {
  return {
    id: 'u',
    kind: 'C',
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
    effective: 180,
    effectiveMax: 180,
    effectiveMin: 25,
    killed: 0,
    ...overrides,
  }
}

describe('engine/combat/v2/charge — isPathStraight', () => {
  it('chemin vide ou court (< 3 elements) considere droit', () => {
    expect(isPathStraight([])).toBe(true)
    expect(isPathStraight([cube(0, 0, 0)])).toBe(true)
    expect(isPathStraight([cube(0, 0, 0), cube(1, 0, -1)])).toBe(true)
  })

  it('chemin droit dans la direction E (q+1) sur 4 hex → true', () => {
    const path = [cube(0, 0, 0), cube(1, 0, -1), cube(2, 0, -2), cube(3, 0, -3)]
    expect(isPathStraight(path)).toBe(true)
  })

  it('chemin courbe (E puis NE) → false', () => {
    const path = [cube(0, 0, 0), cube(1, 0, -1), cube(2, -1, -1)]
    expect(isPathStraight(path)).toBe(false)
  })
})

describe('engine/combat/v2/charge — chargedDistance', () => {
  it('chemin vide → 0', () => {
    expect(chargedDistance([])).toBe(0)
  })

  it('chemin de 1 hex → 0', () => {
    expect(chargedDistance([cube(0, 0, 0)])).toBe(0)
  })

  it('chemin de N hex → N-1', () => {
    expect(chargedDistance([cube(0, 0, 0), cube(1, 0, -1)])).toBe(1)
    expect(chargedDistance([cube(0, 0, 0), cube(1, 0, -1), cube(2, 0, -2), cube(3, 0, -3)])).toBe(3)
  })
})

describe('engine/combat/v2/charge — chargeMultiplier', () => {
  it('< 2 hex parcourus → 1.0', () => {
    expect(chargeMultiplier(0)).toBe(1.0)
    expect(chargeMultiplier(1)).toBe(1.0)
  })

  it('2 / 3 / 4+ hex → 1.3 / 1.4 / 1.5', () => {
    expect(chargeMultiplier(2)).toBe(1.3)
    expect(chargeMultiplier(3)).toBe(1.4)
    expect(chargeMultiplier(4)).toBe(1.5)
    expect(chargeMultiplier(10)).toBe(1.5)
  })
})

describe('engine/combat/v2/charge — isChargeApplicable', () => {
  it('cav ayant parcouru 3 hex en ligne droite plaine, defender adjacent → applicable', () => {
    const attacker = makeUnit({ kind: 'C', position: cube(3, 0, -3) })
    const defender = makeUnit({ kind: 'I', team: 'red', position: cube(4, 0, -4) })
    const path = [cube(0, 0, 0), cube(1, 0, -1), cube(2, 0, -2), cube(3, 0, -3)]
    const pathTerrain = ['plaine_standard', 'plaine_standard', 'plaine_standard', 'plaine_standard'] as const
    expect(isChargeApplicable({ attacker, defender, path, pathTerrain: [...pathTerrain] })).toBe(true)
  })

  it('infanterie ne charge jamais (kind !== C)', () => {
    const attacker = makeUnit({ kind: 'I', position: cube(3, 0, -3) })
    const defender = makeUnit({ kind: 'I', team: 'red', position: cube(4, 0, -4) })
    const path = [cube(0, 0, 0), cube(1, 0, -1), cube(2, 0, -2), cube(3, 0, -3)]
    const pathTerrain = Array(4).fill('plaine_standard') as ['plaine_standard']
    expect(isChargeApplicable({ attacker, defender, path, pathTerrain: [...pathTerrain] })).toBe(false)
  })

  it('cav 1 hex parcouru → distance < 2, pas de charge', () => {
    const attacker = makeUnit({ kind: 'C', position: cube(1, 0, -1) })
    const defender = makeUnit({ kind: 'I', team: 'red', position: cube(2, 0, -2) })
    const path = [cube(0, 0, 0), cube(1, 0, -1)]
    expect(
      isChargeApplicable({ attacker, defender, path, pathTerrain: ['plaine_standard', 'plaine_standard'] }),
    ).toBe(false)
  })

  it('cav 2 hex courbe → pas de charge', () => {
    const attacker = makeUnit({ kind: 'C', position: cube(2, -1, -1) })
    const defender = makeUnit({ kind: 'I', team: 'red', position: cube(3, -1, -2) })
    const path = [cube(0, 0, 0), cube(1, 0, -1), cube(2, -1, -1)]
    expect(
      isChargeApplicable({
        attacker,
        defender,
        path,
        pathTerrain: ['plaine_standard', 'plaine_standard', 'plaine_standard'],
      }),
    ).toBe(false)
  })

  it('cav 2 hex avec foret sur le path → pas de charge (chargeAllowed=false)', () => {
    const attacker = makeUnit({ kind: 'C', position: cube(2, 0, -2) })
    const defender = makeUnit({ kind: 'I', team: 'red', position: cube(3, 0, -3) })
    const path = [cube(0, 0, 0), cube(1, 0, -1), cube(2, 0, -2)]
    expect(
      isChargeApplicable({
        attacker,
        defender,
        path,
        pathTerrain: ['plaine_standard', 'foret', 'plaine_standard'],
      }),
    ).toBe(false)
  })

  it('cav 3 hex droite mais defender non adjacent → pas de charge', () => {
    const attacker = makeUnit({ kind: 'C', position: cube(3, 0, -3) })
    const defender = makeUnit({ kind: 'I', team: 'red', position: cube(6, 0, -6) }) // distance 3 (pas adjacent)
    const path = [cube(0, 0, 0), cube(1, 0, -1), cube(2, 0, -2), cube(3, 0, -3)]
    expect(
      isChargeApplicable({
        attacker,
        defender,
        path,
        pathTerrain: ['plaine_standard', 'plaine_standard', 'plaine_standard', 'plaine_standard'],
      }),
    ).toBe(false)
  })
})
