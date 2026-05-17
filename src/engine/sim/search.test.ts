// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : tests searchBestAction (minimax α-β + iterative deepening)
import { describe, it, expect } from 'vitest'
import { cube, cubeKey, spiral } from '../hex'
import { DEFAULT_COMBAT_CONFIG } from '../combat/v2/types'
import type { UnitState } from '../units/types'
import type { AIContext, AIProfile } from '../ai/types'
import { searchBestAction } from './search'
import type { SimContext, SimState } from './types'

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

function makeBaseCtx(units: UnitState[], visible: string[] = [], profile: AIProfile = 'hard'): AIContext {
  return {
    allUnits: units,
    visibleEnemyIds: new Set(visible),
    visibleTileKeys: new Set(spiral(cube(0, 0, 0), 8).map(cubeKey)),
    boardKeys: new Set(spiral(cube(0, 0, 0), 8).map(cubeKey)),
    terrainMap: new Map(),
    combatConfig: DEFAULT_COMBAT_CONFIG,
    profile,
    rng: () => 0.5,
    engagedUnitIds: new Set(),
  }
}

function makeSimCtx(units: UnitState[], visible: string[], deadlineMs = 2000, beam = 5): SimContext {
  return {
    baseCtx: makeBaseCtx(units, visible, 'hard'),
    botTeam: 'blue',
    beamWidth: beam,
    enemyBeamWidth: 3,
    deadline: Date.now() + deadlineMs,
  }
}

describe('engine/sim/search', () => {
  it('retourne toujours une action (fallback 1-ply même si deadline immédiate)', () => {
    const me = makeUnit({ id: 'm', kind: 'I' })
    const enemy = makeUnit({ id: 'e', team: 'red', position: cube(1, 0, -1) })
    const state: SimState = { units: [me, enemy], engagedUnitIds: new Set(), turn: 1 }
    const ctx = { ...makeSimCtx([me, enemy], ['e']), deadline: Date.now() - 1000 } // déjà expiré
    const action = searchBestAction(state, me, ctx, 3)
    expect(action).toBeDefined()
    expect(action.kind).toBeDefined()
  })

  it('cible visible adjacente faible → choisit l\'attaque', () => {
    const me = makeUnit({ id: 'm', kind: 'I', effective: 800 })
    const weakEnemy = makeUnit({
      id: 'e', team: 'red', kind: 'I',
      effective: 110, effectiveMin: 100,
      position: cube(1, 0, -1),
    })
    const state: SimState = { units: [me, weakEnemy], engagedUnitIds: new Set(), turn: 1 }
    const ctx = makeSimCtx([me, weakEnemy], ['e'])
    const action = searchBestAction(state, me, ctx, 2)
    expect(action.kind).toBe('attack_melee')
    if (action.kind === 'attack_melee') {
      expect(action.targetId).toBe('e')
    }
  })

  it('respecte la deadline (ne plante pas en récursion infinie)', () => {
    const me = makeUnit({ id: 'm', kind: 'I' })
    const enemy = makeUnit({ id: 'e', team: 'red', kind: 'I', position: cube(2, 0, -2) })
    const state: SimState = { units: [me, enemy], engagedUnitIds: new Set(), turn: 1 }
    const ctx = makeSimCtx([me, enemy], ['e'], 200) // 200ms max
    const before = Date.now()
    const action = searchBestAction(state, me, ctx, 3)
    const elapsed = Date.now() - before
    expect(action).toBeDefined()
    expect(elapsed).toBeLessThan(1500) // marge généreuse
  })

  it('routed unit → retourne hold (fallback)', () => {
    const me = makeUnit({ id: 'm', routed: true })
    const state: SimState = { units: [me], engagedUnitIds: new Set(), turn: 1 }
    const ctx = makeSimCtx([me], [])
    const action = searchBestAction(state, me, ctx, 2)
    expect(action.kind).toBe('hold')
  })

  it('depth 2 vs depth 3 sur même scénario : même type d\'action (ou fallback cohérent)', () => {
    const me = makeUnit({ id: 'm', kind: 'I', effective: 800 })
    const weak = makeUnit({ id: 'e', team: 'red', kind: 'I', effective: 110, effectiveMin: 100, position: cube(1, 0, -1) })
    const state: SimState = { units: [me, weak], engagedUnitIds: new Set(), turn: 1 }
    const ctx2 = makeSimCtx([me, weak], ['e'], 1000)
    const ctx3 = makeSimCtx([me, weak], ['e'], 1000)
    const a2 = searchBestAction(state, me, ctx2, 2)
    const a3 = searchBestAction(state, me, ctx3, 3)
    // Cible faible adjacente : attack dominant aux 2 profondeurs.
    expect(a2.kind).toBe('attack_melee')
    expect(a3.kind).toBe('attack_melee')
  })

  it('aucune cible visible → fallback move ou hold (jamais d\'attack invalide)', () => {
    const me = makeUnit({ id: 'm', kind: 'I' })
    const state: SimState = { units: [me], engagedUnitIds: new Set(), turn: 1 }
    const ctx = makeSimCtx([me], [], 1000)
    const action = searchBestAction(state, me, ctx, 2)
    expect(['move', 'hold']).toContain(action.kind)
  })
})
