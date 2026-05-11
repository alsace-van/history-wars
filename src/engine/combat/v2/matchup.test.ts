// v1.0 (10/05/2026) — Phase 2 2A.5 : tests matrices matchup
// Cible : 6 tests (PLAN-PHASE-2-COMBAT-V2.md § 2A.11)

import { describe, it, expect } from 'vitest'
import { getMatchupCoef, describeMatchup } from './matchup'
import { DEFAULT_COMBAT_CONFIG } from './types'
import type { AttackPhase } from './types'
import type { UnitKind } from '../../../types/game'

describe('engine/combat/v2/matchup', () => {
  it('valeurs alignees sur le brainstorm en melee', () => {
    expect(getMatchupCoef('I', 'I', 'melee')).toBe(1.0)
    expect(getMatchupCoef('I', 'C', 'melee')).toBe(1.1)  // leger avantage inf vs cav (carre)
    expect(getMatchupCoef('I', 'A', 'melee')).toBe(1.5)  // gros avantage inf vs art
    expect(getMatchupCoef('C', 'I', 'melee')).toBe(0.9)  // leger desav cav (sans charge) vs inf
    expect(getMatchupCoef('C', 'A', 'melee')).toBe(1.5)
    expect(getMatchupCoef('A', 'I', 'melee')).toBe(0.5)  // gros desavantage art au contact
  })

  it('valeurs alignees sur le brainstorm en charge', () => {
    // Phase 2.5 balance (11/05/2026) : C→I 1.5→1.2, C→C 1.1→0.9 (nerf cav charges).
    expect(getMatchupCoef('C', 'I', 'charge')).toBe(1.2)
    expect(getMatchupCoef('C', 'C', 'charge')).toBe(0.9)
    expect(getMatchupCoef('C', 'A', 'charge')).toBe(1.5)
    // I et A en charge : neutre (placeholder, ils ne chargent pas en realite)
    expect(getMatchupCoef('I', 'I', 'charge')).toBe(1.0)
    expect(getMatchupCoef('A', 'A', 'charge')).toBe(1.0)
  })

  it('valeurs alignees sur le brainstorm en ranged', () => {
    expect(getMatchupCoef('A', 'I', 'ranged')).toBe(1.0)  // art classique anti-inf
    expect(getMatchupCoef('A', 'A', 'ranged')).toBe(1.5)  // contre-batterie efficace
    expect(getMatchupCoef('A', 'C', 'ranged')).toBe(0.7)  // art moins efficace contre cav mobile
    expect(getMatchupCoef('I', 'I', 'ranged')).toBe(0.8)
    expect(getMatchupCoef('C', 'I', 'ranged')).toBe(0.5)  // cav tire mal
  })

  it('toutes les valeurs sont entre 0.5 et 2.0 (calibrage prudent)', () => {
    const phases: AttackPhase[] = ['melee', 'ranged', 'charge']
    const kinds: UnitKind[] = ['I', 'C', 'A']
    for (const phase of phases) {
      for (const att of kinds) {
        for (const def of kinds) {
          const coef = getMatchupCoef(att, def, phase)
          expect(coef).toBeGreaterThanOrEqual(0.5)
          expect(coef).toBeLessThanOrEqual(2.0)
        }
      }
    }
  })

  it('cav qui charge est meilleure que cav statique vs inf', () => {
    expect(getMatchupCoef('C', 'I', 'charge')).toBeGreaterThan(getMatchupCoef('C', 'I', 'melee'))
  })

  it('describeMatchup produit un libelle UI lisible', () => {
    expect(describeMatchup('C', 'I')).toBe('Type (Cav vs Inf)')
    expect(describeMatchup('A', 'A')).toBe('Type (Art vs Art)')
    expect(describeMatchup('I', 'C')).toBe('Type (Inf vs Cav)')
  })

  it('DEFAULT_COMBAT_CONFIG est frozen runtime', () => {
    expect(Object.isFrozen(DEFAULT_COMBAT_CONFIG)).toBe(true)
    expect(Object.isFrozen(DEFAULT_COMBAT_CONFIG.matchupMatrix)).toBe(true)
    expect(Object.isFrozen(DEFAULT_COMBAT_CONFIG.matchupMatrix.melee)).toBe(true)
  })
})
