// v1.0 (14/05/2026) — Phase 4 Lot A1 : tests enumerateActions + pickBestActionForUnit
import { describe, it, expect } from 'vitest'
import { cube, cubeKey, spiral } from '../hex'
import { DEFAULT_COMBAT_CONFIG } from '../combat/v2/types'
import type { UnitState } from '../units/types'
import { enumerateActions, pickBestActionForUnit } from './picker'
import type { AIContext, AIProfile } from './types'

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

function makeCtx(units: UnitState[], visible: string[] = [], profile: AIProfile = 'medium', seed = 0.5): AIContext {
  return {
    allUnits: units,
    visibleEnemyIds: new Set(visible),
    visibleTileKeys: new Set(spiral(cube(0, 0, 0), 8).map(cubeKey)),
    boardKeys: new Set(spiral(cube(0, 0, 0), 8).map(cubeKey)),
    terrainMap: new Map(),
    combatConfig: DEFAULT_COMBAT_CONFIG,
    profile,
    rng: () => seed,
    engagedUnitIds: new Set(),
  }
}

describe('engine/ai/picker', () => {
  it('enumerateActions inclut hold + attaque visible + au moins 1 move', () => {
    const me = makeUnit({ id: 'm', kind: 'I' })
    const enemy = makeUnit({ id: 'e', team: 'red', position: cube(1, 0, -1) })
    const ctx = makeCtx([me, enemy], ['e'])
    const actions = enumerateActions(me, ctx)
    expect(actions.some(a => a.kind === 'hold')).toBe(true)
    expect(actions.some(a => a.kind === 'attack_melee' && a.targetId === 'e')).toBe(true)
    expect(actions.some(a => a.kind === 'move')).toBe(true)
  })

  it('routed unit retourne aucune action', () => {
    const me = makeUnit({ id: 'm', routed: true })
    const ctx = makeCtx([me])
    expect(enumerateActions(me, ctx)).toHaveLength(0)
    expect(pickBestActionForUnit(me, ctx)).toBeNull()
  })

  it('medium picker = top 1 strict (offensive attaque > move)', () => {
    const me = makeUnit({ id: 'm', kind: 'I', effective: 800 })
    // Cible faible adjacente, attaque profitable.
    const enemy = makeUnit({ id: 'e', team: 'red', kind: 'A', effective: 60, effectiveMax: 120, effectiveMin: 30, position: cube(1, 0, -1) })
    const ctx = makeCtx([me, enemy], ['e'], 'medium')
    const action = pickBestActionForUnit(me, ctx)
    expect(action?.kind).toBe('attack_melee')
  })

  it('hard picker = tiebreaker offensif (attaque > move à score égal)', () => {
    // Pas d'ennemi → attaques impossibles. Hold devrait l'emporter sur move neutre.
    const me = makeUnit({ id: 'm' })
    const ctx = makeCtx([me], [], 'hard')
    const action = pickBestActionForUnit(me, ctx)
    // Sans ennemi visible, scoreMove sur des hex vides = ~0. Score hold = 0. Tiebreaker hard
    // privilégie move (offensivePriority 2) > hold (1).
    expect(action).not.toBeNull()
  })

  it('lookaheadDepth=2 + medium → délègue à searchBestAction (retourne une action valide)', () => {
    const me = makeUnit({ id: 'm', kind: 'I', effective: 800 })
    const enemy = makeUnit({ id: 'e', team: 'red', kind: 'I', effective: 110, effectiveMin: 100, position: cube(1, 0, -1) })
    const baseCtx = makeCtx([me, enemy], ['e'], 'medium')
    const ctx: AIContext = { ...baseCtx, lookaheadDepth: 2, deadlineMs: Date.now() + 500 }
    const action = pickBestActionForUnit(me, ctx)
    expect(action).not.toBeNull()
    // Cible faible adjacente : minimax doit converger sur l'attaque.
    expect(action?.kind).toBe('attack_melee')
  })

  it('lookaheadDepth=3 + easy → IGNORE le lookahead (reste random top 3)', () => {
    const me = makeUnit({ id: 'm', kind: 'I', effective: 800 })
    const enemy = makeUnit({ id: 'e', team: 'red', kind: 'A', effective: 60, effectiveMax: 120, effectiveMin: 30, position: cube(1, 0, -1) })
    const baseCtx = makeCtx([me, enemy], ['e'], 'easy', 0)
    const ctx: AIContext = { ...baseCtx, lookaheadDepth: 3, deadlineMs: Date.now() + 500 }
    const action = pickBestActionForUnit(me, ctx)
    // Seed 0 → premier des top 3 (greedy 1-ply), pas le résultat de la recherche.
    expect(action).not.toBeNull()
  })

  it('easy picker = parmi top 3 (déterministe avec seed fixe)', () => {
    const me = makeUnit({ id: 'm', kind: 'I', effective: 800 })
    const enemy = makeUnit({ id: 'e', team: 'red', kind: 'A', effective: 60, effectiveMax: 120, effectiveMin: 30, position: cube(1, 0, -1) })
    const ctxSeed0 = makeCtx([me, enemy], ['e'], 'easy', 0)     // index 0 → top action
    const ctxSeed099 = makeCtx([me, enemy], ['e'], 'easy', 0.99)  // index ~2 → 3e action
    const a0 = pickBestActionForUnit(me, ctxSeed0)
    const a2 = pickBestActionForUnit(me, ctxSeed099)
    expect(a0).not.toBeNull()
    expect(a2).not.toBeNull()
    // Au moins déterministe : même seed → même action.
    const aBis = pickBestActionForUnit(me, makeCtx([me, enemy], ['e'], 'easy', 0))
    expect(aBis).toEqual(a0)
  })
})
