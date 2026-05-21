// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : tests applyAction (move / attack / engagement / kill)
import { describe, it, expect } from 'vitest'
import { cube } from '../hex'
import { DEFAULT_COMBAT_CONFIG } from '../combat/v2/types'
import type { UnitState } from '../units/types'
import type { TerrainType } from '../terrain/types'
import { applyAction, resetTurnFlags, type ApplyActionContext } from './applyAction'
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

function makeCtx(rngVal = 0.5): ApplyActionContext {
  return {
    terrainMap: new Map<string, TerrainType>(),
    combatConfig: DEFAULT_COMBAT_CONFIG,
    rng: () => rngVal,
  }
}

function makeState(units: UnitState[], engaged: string[] = []): SimState {
  return {
    units,
    engagedUnitIds: new Set(engaged),
    turn: 1,
  }
}

describe('engine/sim/applyAction', () => {
  it('hold = no-op (état inchangé)', () => {
    const me = makeUnit({ id: 'm' })
    const state = makeState([me])
    const next = applyAction(state, me, { kind: 'hold' }, makeCtx())
    expect(next).toBe(state) // même référence
  })

  it('move met à jour position + hasMoved, autres unités intactes', () => {
    const me = makeUnit({ id: 'm', position: cube(0, 0, 0) })
    const other = makeUnit({ id: 'o', position: cube(3, 0, -3) })
    const state = makeState([me, other])
    const dest = cube(1, 0, -1)
    const next = applyAction(state, me, { kind: 'move', dest }, makeCtx())
    const meAfter = next.units.find(u => u.id === 'm')!
    const otherAfter = next.units.find(u => u.id === 'o')!
    expect(meAfter.position).toEqual(dest)
    expect(meAfter.hasMoved).toBe(true)
    expect(otherAfter).toBe(other) // référence préservée
  })

  it('attack_melee inflige des dégâts au défenseur (effective baisse)', () => {
    const me = makeUnit({ id: 'm', kind: 'I', effective: 800, position: cube(0, 0, 0) })
    const enemy = makeUnit({ id: 'e', team: 'red', kind: 'I', effective: 800, position: cube(1, 0, -1) })
    const state = makeState([me, enemy])
    const next = applyAction(state, me, { kind: 'attack_melee', targetId: 'e' }, makeCtx())
    const enemyAfter = next.units.find(u => u.id === 'e')!
    expect(enemyAfter.effective).toBeLessThan(800)
  })

  it('attack_melee crée une engagement bilatéral si non-mortelle', () => {
    const me = makeUnit({ id: 'm', kind: 'I', effective: 800, position: cube(0, 0, 0) })
    const enemy = makeUnit({ id: 'e', team: 'red', kind: 'I', effective: 800, position: cube(1, 0, -1) })
    const state = makeState([me, enemy])
    const next = applyAction(state, me, { kind: 'attack_melee', targetId: 'e' }, makeCtx())
    expect(next.engagedUnitIds.has('m')).toBe(true)
    expect(next.engagedUnitIds.has('e')).toBe(true)
  })

  it('attack_ranged ne crée PAS d\'engagement', () => {
    const me = makeUnit({ id: 'm', kind: 'A', subKind: 'archer', effective: 400, position: cube(0, 0, 0) })
    const enemy = makeUnit({ id: 'e', team: 'red', kind: 'I', effective: 800, position: cube(3, 0, -3) })
    const state = makeState([me, enemy])
    const next = applyAction(state, me, { kind: 'attack_ranged', targetId: 'e' }, makeCtx())
    expect(next.engagedUnitIds.size).toBe(0)
  })

  it('attack qui tue le défenseur le retire des units', () => {
    const me = makeUnit({ id: 'm', kind: 'I', effective: 800 })
    // effective 110, min 100 → 1 attaque tue (defenderEffectiveAfter <= effectiveMin)
    const enemy = makeUnit({ id: 'e', team: 'red', kind: 'I', effective: 110, effectiveMin: 100, position: cube(1, 0, -1) })
    const state = makeState([me, enemy])
    const next = applyAction(state, me, { kind: 'attack_melee', targetId: 'e' }, makeCtx(0.99))
    expect(next.units.find(u => u.id === 'e')).toBeUndefined()
  })

  it('attacker hasAttacked = true après attaque', () => {
    const me = makeUnit({ id: 'm', kind: 'I', effective: 800 })
    const enemy = makeUnit({ id: 'e', team: 'red', kind: 'I', effective: 800, position: cube(1, 0, -1) })
    const state = makeState([me, enemy])
    const next = applyAction(state, me, { kind: 'attack_melee', targetId: 'e' }, makeCtx())
    const meAfter = next.units.find(u => u.id === 'm')!
    expect(meAfter.hasAttacked).toBe(true)
  })

  it('attack avec cible inexistante = no-op', () => {
    const me = makeUnit({ id: 'm', kind: 'I' })
    const state = makeState([me])
    const next = applyAction(state, me, { kind: 'attack_melee', targetId: 'ghost' }, makeCtx())
    expect(next).toBe(state)
  })

  it('resetTurnFlags reset hasMoved + hasAttacked pour une équipe', () => {
    const me = makeUnit({ id: 'm', team: 'blue', hasMoved: true, hasAttacked: true })
    const other = makeUnit({ id: 'o', team: 'red', hasMoved: true, hasAttacked: true })
    const state = makeState([me, other])
    const next = resetTurnFlags(state, 'blue')
    const meAfter = next.units.find(u => u.id === 'm')!
    const otherAfter = next.units.find(u => u.id === 'o')!
    expect(meAfter.hasMoved).toBe(false)
    expect(meAfter.hasAttacked).toBe(false)
    expect(otherAfter.hasMoved).toBe(true) // pas touché
    expect(otherAfter.hasAttacked).toBe(true)
  })

  it('resetTurnFlags ignore unités routed', () => {
    const me = makeUnit({ id: 'm', team: 'blue', hasMoved: true, routed: true })
    const state = makeState([me])
    const next = resetTurnFlags(state, 'blue')
    const meAfter = next.units.find(u => u.id === 'm')!
    expect(meAfter.hasMoved).toBe(true) // routed → pas reset
  })

  it('immutabilité : state d\'origine n\'est jamais muté', () => {
    const me = makeUnit({ id: 'm', position: cube(0, 0, 0), hasMoved: false })
    const state = makeState([me])
    const before = JSON.stringify(state)
    applyAction(state, me, { kind: 'move', dest: cube(1, 0, -1) }, makeCtx())
    expect(JSON.stringify(state)).toBe(before)
  })
})
