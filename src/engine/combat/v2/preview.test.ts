// v1.0 (10/05/2026) — Phase 2 2A.10 : tests preview combat v2
// Cible : 8 tests (PLAN-PHASE-2-COMBAT-V2.md § 2A.11)

import { describe, it, expect } from 'vitest'
import { cube } from '../../hex'
import type { UnitState } from '../../units/types'
import { previewCombatV2 } from './preview'

function makeUnit(overrides: Partial<UnitState>): UnitState {
  return {
    id: 'u',
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
    effective: 800,
    effectiveMax: 800,
    effectiveMin: 100,
    killed: 0,
    ...overrides,
  }
}

describe('engine/combat/v2/preview', () => {
  it('bornes coherentes : damageMin <= damageMax', () => {
    const att = makeUnit({ kind: 'I', effective: 800 })
    const def = makeUnit({ kind: 'A', team: 'red', effective: 120, effectiveMax: 120, effectiveMin: 30, position: cube(1, 0, -1) })
    const p = previewCombatV2({
      attacker: att,
      defender: def,
      phase: 'melee',
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      chargeMult: 1.0,
    })
    expect(p.estimatedDamageMin).toBeLessThanOrEqual(p.estimatedDamageMax)
    expect(p.estimatedKilledMin).toBeLessThanOrEqual(p.estimatedKilledMax)
    expect(p.estimatedWoundedMin).toBeLessThanOrEqual(p.estimatedWoundedMax)
  })

  it('breakdown contient ATK base + matchup + DEF base au minimum', () => {
    const att = makeUnit({ kind: 'I', effective: 800 })
    const def = makeUnit({ kind: 'I', team: 'red', effective: 800, position: cube(1, 0, -1) })
    const p = previewCombatV2({
      attacker: att,
      defender: def,
      phase: 'melee',
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      chargeMult: 1.0,
    })
    expect(p.bonusBreakdown.some(b => b.label === 'ATK base')).toBe(true)
    expect(p.bonusBreakdown.some(b => b.label === 'DEF base')).toBe(true)
    expect(p.bonusBreakdown.some(b => b.label.startsWith('Type'))).toBe(true)
  })

  it('preview ranged inclut TIR base, pas ATK base', () => {
    const att = makeUnit({ kind: 'A', subKind: 'artillery', effective: 120, effectiveMax: 120, effectiveMin: 30 })
    const def = makeUnit({ kind: 'I', team: 'red', effective: 800, position: cube(4, 0, -4) })
    const p = previewCombatV2({
      attacker: att,
      defender: def,
      phase: 'ranged',
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 4,
      chargeMult: 1.0,
    })
    expect(p.bonusBreakdown.some(b => b.label === 'TIR base')).toBe(true)
    expect(p.bonusBreakdown.some(b => b.label === 'ATK base')).toBe(false)
  })

  it('charge mult ajoute une ligne Charge cav dans le breakdown', () => {
    const att = makeUnit({ kind: 'C', effective: 180, effectiveMax: 180, effectiveMin: 25 })
    const def = makeUnit({ kind: 'I', team: 'red', effective: 800, position: cube(1, 0, -1) })
    const p = previewCombatV2({
      attacker: att,
      defender: def,
      phase: 'charge',
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      chargeMult: 1.5,
    })
    const charge = p.bonusBreakdown.find(b => b.label === 'Charge cav')
    expect(charge).toBeDefined()
    expect(charge?.multiplier).toBe(1.5)
  })

  it('foret defenseur ajoute une ligne Terrain defense dans le breakdown', () => {
    const att = makeUnit({ kind: 'I', effective: 800 })
    const def = makeUnit({ kind: 'A', team: 'red', effective: 120, effectiveMax: 120, effectiveMin: 30, position: cube(1, 0, -1) })
    const p = previewCombatV2({
      attacker: att,
      defender: def,
      phase: 'melee',
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'foret',
      distance: 1,
      chargeMult: 1.0,
    })
    const terrain = p.bonusBreakdown.find(b => b.label.startsWith('Terrain defense'))
    expect(terrain).toBeDefined()
    expect(terrain?.multiplier).toBe(1.5)
  })

  it('contactCap = min des 2 caps terrain', () => {
    const att = makeUnit({ effective: 800 })
    const def = makeUnit({ team: 'red', effective: 800, position: cube(1, 0, -1) })
    const p = previewCombatV2({
      attacker: att,
      defender: def,
      phase: 'melee',
      attackerTerrain: 'plaine_ouverte',  // 300
      defenderTerrain: 'pont',              // 80
      distance: 1,
      chargeMult: 1.0,
    })
    expect(p.contactCap).toBe(80)
  })

  it('artillerie sous min_range : damageMin = 0 (impossible)', () => {
    const att = makeUnit({ kind: 'A', subKind: 'artillery', effective: 120, effectiveMax: 120, effectiveMin: 30 })
    const def = makeUnit({ kind: 'I', team: 'red', effective: 800, position: cube(1, 0, -1) })
    const p = previewCombatV2({
      attacker: att,
      defender: def,
      phase: 'ranged',
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,  // sous min_range = 2
      chargeMult: 1.0,
    })
    expect(p.estimatedDamageMin).toBe(0)
    expect(p.estimatedDamageMax).toBe(0)
  })

  it('killedMin + woundedMin <= damageMin (split casualties coherent)', () => {
    const att = makeUnit({ kind: 'C', effective: 180, effectiveMax: 180, effectiveMin: 25 })
    const def = makeUnit({ kind: 'A', team: 'red', effective: 120, effectiveMax: 120, effectiveMin: 30, position: cube(1, 0, -1) })
    const p = previewCombatV2({
      attacker: att,
      defender: def,
      phase: 'charge',
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      chargeMult: 1.5,
    })
    expect(p.estimatedKilledMin + p.estimatedWoundedMin).toBeLessThanOrEqual(p.estimatedDamageMin)
    expect(p.estimatedKilledMax + p.estimatedWoundedMax).toBeLessThanOrEqual(p.estimatedDamageMax)
  })
})
