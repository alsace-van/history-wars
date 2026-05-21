// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : test winrate dormant hard vs medium
//
// DESACTIVE PAR DEFAUT (`describe.skip`). À LANCER MANUELLEMENT pour valider qu'un bot hard
// (lookahead 3 ply) gagne nettement plus de parties qu'un bot medium (lookahead 2 ply) sur
// un scénario fixe. Sert de baseline de force IA — à relancer après tout tweak du scorer/sim.
//
// Pour lancer :
//   npm run test -- --run --grep winrate
//   (ou retirer le `.skip` ci-dessous puis npm run test)
//
// Coût attendu : 50 parties × ~15 tours × 10 unités × deadline 500ms ≈ 3-5 minutes.

import { describe, it, expect } from 'vitest'
import { cube, cubeKey, spiral } from '../hex'
import { DEFAULT_COMBAT_CONFIG } from '../combat/v2/types'
import { seededRng } from '../combat/rng'
import type { UnitState } from '../units/types'
import type { AIContext, AIProfile } from '../ai/types'
import { pickBestActionForUnit } from '../ai/picker'
import { applyAction, resetTurnFlags } from './applyAction'
import { evalState } from './evalState'
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

/**
 * Scénario fixe MVP : 5 vs 5 sur board radius 5. Forces équilibrées (3 I, 1 C, 1 A par camp).
 * Positions départ : ligne front à r=-3 (blue) vs r=+3 (red).
 */
function makeScenario(): UnitState[] {
  const blueRow = -3
  const redRow = 3
  const units: UnitState[] = []
  // Blue
  units.push(makeUnit({ id: 'b1I', kind: 'I', team: 'blue', position: cube(-2, blueRow, 5 - blueRow) }))
  units.push(makeUnit({ id: 'b2I', kind: 'I', team: 'blue', position: cube(-1, blueRow, 4 - blueRow) }))
  units.push(makeUnit({ id: 'b3I', kind: 'I', team: 'blue', position: cube(0, blueRow, 3 - blueRow) }))
  units.push(makeUnit({ id: 'b4C', kind: 'C', team: 'blue', position: cube(1, blueRow, 2 - blueRow), effective: 200, effectiveMax: 400, effectiveMin: 50 }))
  units.push(makeUnit({ id: 'b5A', kind: 'A', subKind: 'archer', team: 'blue', position: cube(2, blueRow, 1 - blueRow), effective: 200, effectiveMax: 400, effectiveMin: 50 }))
  // Red (mirror)
  units.push(makeUnit({ id: 'r1I', kind: 'I', team: 'red', position: cube(2, redRow, -5 - redRow) }))
  units.push(makeUnit({ id: 'r2I', kind: 'I', team: 'red', position: cube(1, redRow, -4 - redRow) }))
  units.push(makeUnit({ id: 'r3I', kind: 'I', team: 'red', position: cube(0, redRow, -3 - redRow) }))
  units.push(makeUnit({ id: 'r4C', kind: 'C', team: 'red', position: cube(-1, redRow, -2 - redRow), effective: 200, effectiveMax: 400, effectiveMin: 50 }))
  units.push(makeUnit({ id: 'r5A', kind: 'A', subKind: 'archer', team: 'red', position: cube(-2, redRow, -1 - redRow), effective: 200, effectiveMax: 400, effectiveMin: 50 }))
  return units
}

function makeCtx(state: SimState, profile: AIProfile, lookaheadDepth: number, rng: () => number, deadlineMs: number): AIContext {
  // Pour les besoins du test : visibility = tous ennemis visibles (pas de fog dans la sim).
  const allIds = new Set(state.units.map(u => u.id))
  return {
    allUnits: state.units,
    visibleEnemyIds: allIds,
    visibleTileKeys: new Set(spiral(cube(0, 0, 0), 5).map(cubeKey)),
    boardKeys: new Set(spiral(cube(0, 0, 0), 5).map(cubeKey)),
    terrainMap: new Map(),
    combatConfig: DEFAULT_COMBAT_CONFIG,
    profile,
    rng,
    engagedUnitIds: state.engagedUnitIds,
    lookaheadDepth,
    deadlineMs,
  }
}

/**
 * Joue 1 partie complète entre 2 bots. Retourne le vainqueur ou null si match nul après cap tours.
 */
function playGame(
  blueProfile: AIProfile, blueLookahead: number,
  redProfile: AIProfile, redLookahead: number,
  rngSeed: number,
  maxTurns = 15,
): 'blue' | 'red' | null {
  const rng = seededRng(rngSeed)
  let state: SimState = { units: makeScenario(), engagedUnitIds: new Set(), turn: 1 }

  for (let turn = 0; turn < maxTurns; turn++) {
    for (const side of ['blue', 'red'] as const) {
      const profile = side === 'blue' ? blueProfile : redProfile
      const depth = side === 'blue' ? blueLookahead : redLookahead
      // Per-action deadline tight pour rester rapide (test long sinon).
      const ctx = makeCtx(state, profile, depth, rng, Date.now() + 300)
      const actors = state.units.filter(u => u.team === side && !u.routed).sort((a, b) => a.id.localeCompare(b.id))
      for (const actor of actors) {
        const fresh = state.units.find(u => u.id === actor.id)
        if (!fresh || fresh.routed) continue
        const action = pickBestActionForUnit(fresh, {
          ...ctx,
          allUnits: state.units,
          engagedUnitIds: state.engagedUnitIds,
        })
        if (!action) continue
        state = applyAction(state, fresh, action, {
          terrainMap: ctx.terrainMap,
          combatConfig: ctx.combatConfig,
          rng,
        })
      }
      state = resetTurnFlags(state, side)
      // Check victoire : adversaire entièrement routed ou éliminé
      const enemySide = side === 'blue' ? 'red' : 'blue'
      const enemyAlive = state.units.filter(u => u.team === enemySide && !u.routed)
      if (enemyAlive.length === 0) return side
    }
  }
  // Match nul : décider par eval favorable
  const blueAdvantage = evalState(state, 'blue')
  if (blueAdvantage > 50) return 'blue'
  if (blueAdvantage < -50) return 'red'
  return null
}

// ATTENTION : test long (~3-5 min). DESACTIVE PAR DEFAUT. Retirer .skip pour lancer.
describe.skip('engine/sim/winrate — hard vs medium baseline', () => {
  it('hard (depth 3) gagne ≥ 64% des parties vs medium (depth 2) sur 50 parties', () => {
    const games = 50
    let hardWins = 0
    let mediumWins = 0
    let draws = 0
    for (let i = 0; i < games; i++) {
      // Alterner les camps pour éviter biais position
      const hardOnBlue = i % 2 === 0
      const winner = hardOnBlue
        ? playGame('hard', 3, 'medium', 2, 42 + i)
        : playGame('medium', 2, 'hard', 3, 42 + i)
      if (winner === null) draws++
      else if ((hardOnBlue && winner === 'blue') || (!hardOnBlue && winner === 'red')) hardWins++
      else mediumWins++
    }
    // eslint-disable-next-line no-console
    console.log(`[winrate] hard=${hardWins} medium=${mediumWins} draws=${draws} on ${games} games`)
    expect(hardWins).toBeGreaterThanOrEqual(Math.floor(games * 0.64))
  }, 600_000)
})
