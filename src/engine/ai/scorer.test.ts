// v1.0 (14/05/2026) — Phase 4 Lot A1 : tests scoreAction (attack/move/hold)
import { describe, it, expect } from 'vitest'
import { cube, cubeKey, spiral } from '../hex'
import { DEFAULT_COMBAT_CONFIG } from '../combat/v2/types'
import type { UnitState } from '../units/types'
import { scoreAction, expectedRiskAt } from './scorer'
import type { AIAction, AIContext } from './types'

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

function makeCtx(units: UnitState[], visible: string[] = []): AIContext {
  return {
    allUnits: units,
    visibleEnemyIds: new Set(visible),
    visibleTileKeys: new Set(spiral(cube(0, 0, 0), 8).map(cubeKey)),
    boardKeys: new Set(spiral(cube(0, 0, 0), 8).map(cubeKey)),
    terrainMap: new Map(),
    combatConfig: DEFAULT_COMBAT_CONFIG,
    profile: 'medium',
    rng: () => 0.5,
    engagedUnitIds: new Set(),
  }
}

describe('engine/ai/scorer', () => {
  it('attack melee score > 0 quand attaquant écrase défenseur (I full vs A faible)', () => {
    const attacker = makeUnit({ id: 'a', kind: 'I', effective: 800, position: cube(0, 0, 0) })
    const defender = makeUnit({ id: 'd', kind: 'A', team: 'red', effective: 60, effectiveMax: 120, effectiveMin: 30, position: cube(1, 0, -1) })
    const ctx = makeCtx([attacker, defender], ['d'])
    const action: AIAction = { kind: 'attack_melee', targetId: 'd' }
    expect(scoreAction(attacker, action, ctx)).toBeGreaterThan(0)
  })

  it('attack score = -Infinity si cible hors range', () => {
    const attacker = makeUnit({ id: 'a', kind: 'I', position: cube(0, 0, 0) })
    const defender = makeUnit({ id: 'd', team: 'red', position: cube(5, 0, -5) })
    const ctx = makeCtx([attacker, defender], ['d'])
    const action: AIAction = { kind: 'attack_melee', targetId: 'd' }
    expect(scoreAction(attacker, action, ctx)).toBe(-Infinity)
  })

  it('move score augmente quand on rapproche d\'un ennemi visible faible', () => {
    const me = makeUnit({ id: 'm', position: cube(0, 0, 0) })
    const weakEnemy = makeUnit({ id: 'e', team: 'red', effective: 50, position: cube(3, 0, -3) })
    const ctx = makeCtx([me, weakEnemy], ['e'])
    const moveAway: AIAction = { kind: 'move', dest: cube(-1, 0, 1) }
    const moveCloser: AIAction = { kind: 'move', dest: cube(1, 0, -1) }
    expect(scoreAction(me, moveCloser, ctx)).toBeGreaterThan(scoreAction(me, moveAway, ctx))
  })

  it('hold score = 0 pour unité full morale non engagée', () => {
    const me = makeUnit({ id: 'm', morale: 90 })
    const ctx = makeCtx([me])
    expect(scoreAction(me, { kind: 'hold' }, ctx)).toBe(0)
  })

  it('hold score > 0 si morale basse + non engagé (stabilisation attendue)', () => {
    const me = makeUnit({ id: 'm', morale: 30 })
    const ctx = makeCtx([me])
    expect(scoreAction(me, { kind: 'hold' }, ctx)).toBeGreaterThan(0)
  })

  it('expectedRiskAt > 0 si ennemi adjacent visible peut attaquer', () => {
    const me = makeUnit({ id: 'm', position: cube(0, 0, 0) })
    const enemy = makeUnit({ id: 'e', team: 'red', kind: 'C', effective: 180, effectiveMax: 180, position: cube(1, 0, -1) })
    const ctx = makeCtx([me, enemy], ['e'])
    expect(expectedRiskAt(me, cube(0, 0, 0), ctx)).toBeGreaterThan(0)
  })
})
