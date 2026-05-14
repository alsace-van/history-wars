// v1.0 (14/05/2026) — Régression bug session 23 : picker pickait `hold` 5×.
// Cause racine : cubeKey="q,r" 2 composantes, picker.split(',') donnait s=NaN dans dest,
// cubeDistance(dest,enemy) → NaN → bestApproach reste 0 → tous les moves score=0 = hold.
import { describe, it, expect } from 'vitest'
import { cube, cubeKey, spiral } from '../hex'
import { DEFAULT_COMBAT_CONFIG } from '../combat/v2/types'
import type { UnitState } from '../units/types'
import { enumerateActions, pickBestActionForUnit } from './picker'
import type { AIContext } from './types'

function mkUnit(o: Partial<UnitState> & { id: string; team: 'red'|'blue'; kind: 'I'|'C'|'A'; q: number; r: number }): UnitState {
  const baseStats: Record<string, { hp: number; eff: number; effMax: number; effMin: number }> = {
    I: { hp: 100, eff: 800, effMax: 800, effMin: 100 },
    C: { hp: 80, eff: 180, effMax: 180, effMin: 25 },
    A: { hp: 60, eff: 120, effMax: 120, effMin: 30 },
  }
  const s = baseStats[o.kind]
  return {
    id: o.id, kind: o.kind, team: o.team,
    position: cube(o.q, o.r),
    hp: s.hp, hpMax: s.hp, wounded: 0,
    morale: 100, moraleMax: 100,
    hasMoved: false, hasAttacked: false, routed: false,
    effective: s.eff, effectiveMax: s.effMax, effectiveMin: s.effMin,
    killed: 0,
  }
}

describe('picker régression bug session 23 : dest.s NaN cassait scoreMove', () => {
  // Snapshot exact game fb8ee6d5 mvp-plaine après tour 1 humain.
  const units: UnitState[] = [
    // Bot rouge (position initiale, doit jouer)
    mkUnit({ id: '2804', team: 'red', kind: 'A', q: 6, r: -6 }),
    mkUnit({ id: '4cee', team: 'red', kind: 'I', q: 6, r: -3 }),
    mkUnit({ id: '8d8b', team: 'red', kind: 'C', q: 6, r: -4 }),
    mkUnit({ id: '995c', team: 'red', kind: 'A', q: 6, r: -5 }),
    mkUnit({ id: 'f3f0', team: 'red', kind: 'I', q: 6, r: -2 }),
    // Blue humain (déjà bougé, distance ~8-12 hors vision)
    mkUnit({ id: '1203', team: 'blue', kind: 'I', q: -3, r: 1, hasMoved: true }),
    mkUnit({ id: 'b586', team: 'blue', kind: 'I', q: -3, r: -1, hasMoved: true }),
    mkUnit({ id: '08cf', team: 'blue', kind: 'A', q: -4, r: 3, hasMoved: true }),
    mkUnit({ id: 'e21c', team: 'blue', kind: 'A', q: -4, r: 5, hasMoved: true }),
    mkUnit({ id: 'c6f5', team: 'blue', kind: 'C', q: -2, r: 2, hasMoved: true }),
  ]
  const boardKeys = new Set(spiral(cube(0, 0, 0), 7).map(cubeKey))
  const ctx: AIContext = {
    allUnits: units,
    visibleEnemyIds: new Set(),  // distance > vision pour tous
    visibleTileKeys: boardKeys,
    boardKeys,
    terrainMap: new Map(),
    combatConfig: DEFAULT_COMBAT_CONFIG,
    profile: 'medium',
    rng: () => 0.5,
    engagedUnitIds: new Set(),
  }

  it('chaque bot pick un move (pas hold) quand il peut s\'approcher de l\'ennemi', () => {
    for (const bot of units.filter(u => u.team === 'red')) {
      const pick = pickBestActionForUnit(bot, ctx)
      expect(pick).not.toBeNull()
      expect(pick!.kind, `bot ${bot.id} ${bot.kind}`).toBe('move')
    }
  })

  it('dest.s est un nombre valide (pas NaN) dans tous les moves enumerés', () => {
    const bot = units.find(u => u.id === '4cee')!
    const moves = enumerateActions(bot, ctx).filter(a => a.kind === 'move')
    for (const m of moves) {
      const dest = (m as { kind: 'move'; dest: { q: number; r: number; s: number } }).dest
      expect(Number.isFinite(dest.s)).toBe(true)
      expect(dest.q + dest.r + dest.s).toBe(0)  // invariant cube
    }
  })
})

describe('picker régression : bot engagé doit attaquer, pas hold passif', () => {
  // Scénario : bot I (2,-3) entouré de 3 blue I adjacents + engagement actif.
  // Sans le fix scoreHold=-50, le bot pickait hold (subir 3 attaques sans riposter).
  const bot = mkUnit({ id: 'bot', team: 'red', kind: 'I', q: 2, r: -3, hp: 74, effective: 588, morale: 51 })
  const adj1 = mkUnit({ id: 'adj1', team: 'blue', kind: 'I', q: 1, r: -2 })
  const adj2 = mkUnit({ id: 'adj2', team: 'blue', kind: 'I', q: 2, r: -2 })
  const adj3 = mkUnit({ id: 'adj3', team: 'blue', kind: 'I', q: 1, r: -3 })
  Object.assign(adj1, { effective: 313, hp: 39 })
  Object.assign(adj2, { effective: 363, hp: 45 })
  Object.assign(adj3, { effective: 374, hp: 47 })
  const allUnits = [bot, adj1, adj2, adj3]
  const boardKeys = new Set(spiral(cube(0, 0, 0), 7).map(cubeKey))
  const ctx: AIContext = {
    allUnits,
    visibleEnemyIds: new Set(['adj1', 'adj2', 'adj3']),
    visibleTileKeys: boardKeys,
    boardKeys,
    terrainMap: new Map(),
    combatConfig: DEFAULT_COMBAT_CONFIG,
    profile: 'medium',
    rng: () => 0.5,
    engagedUnitIds: new Set(['bot']),  // bot engagé
  }

  it('bot engagé pick une attaque (pas hold)', () => {
    const pick = pickBestActionForUnit(bot, ctx)
    expect(pick).not.toBeNull()
    expect(pick!.kind).toMatch(/^attack_/)
  })
})
