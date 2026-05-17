// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : recherche minimax α-β + iterative deepening
// PORT FROM src/engine/sim/search.ts — DO NOT EDIT MANUALLY.

import type { AIAction } from '../ai/types.ts'
import { enumerateActions } from '../ai/picker.ts'
import { scoreAction } from '../ai/scorer.ts'
import type { Team } from '../../types.ts'
import type { UnitState } from '../units.ts'
import { applyAction, resetTurnFlags, type ApplyActionContext } from './applyAction.ts'
import { ctxFromState } from './clone.ts'
import { evalState } from './evalState.ts'
import type { SimContext, SimState } from './types.ts'

function otherTeam(t: Team): Team {
  return t === 'blue' ? 'red' : 'blue'
}

function applyCtx(simCtx: SimContext): ApplyActionContext {
  return {
    terrainMap: simCtx.baseCtx.terrainMap,
    combatConfig: simCtx.baseCtx.combatConfig,
    rng: simCtx.baseCtx.rng,
  }
}

function topActions(
  state: SimState,
  unit: UnitState,
  simCtx: SimContext,
  beamWidth: number,
): AIAction[] {
  const ctx = ctxFromState(simCtx.baseCtx, state)
  const actions = enumerateActions(unit, ctx)
  if (actions.length === 0) return []
  const scored = actions
    .map(a => ({ action: a, score: scoreAction(unit, a, ctx) }))
    .filter(s => s.score > -Infinity)
  if (scored.length === 0) return [{ kind: 'hold' }]
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, Math.max(1, beamWidth)).map(s => s.action)
}

function pickGreedy(state: SimState, unit: UnitState, simCtx: SimContext): AIAction | null {
  const ctx = ctxFromState(simCtx.baseCtx, state)
  const actions = enumerateActions(unit, ctx)
  if (actions.length === 0) return null
  let bestAction: AIAction | null = null
  let bestScore = -Infinity
  for (const a of actions) {
    const s = scoreAction(unit, a, ctx)
    if (s > bestScore) {
      bestScore = s
      bestAction = a
    }
  }
  return bestAction ?? { kind: 'hold' }
}

function rolloutRest(
  state: SimState,
  team: Team,
  afterId: string | null,
  simCtx: SimContext,
): SimState {
  let next = state
  const actors = next.units
    .filter(u =>
      u.team === team &&
      !u.routed &&
      !u.hasMoved &&
      !u.hasAttacked &&
      (afterId === null || u.id > afterId),
    )
    .sort((a, b) => a.id.localeCompare(b.id))

  const applyContext = applyCtx(simCtx)
  for (const actor of actors) {
    if (Date.now() >= simCtx.deadline) return next
    const fresh = next.units.find(u => u.id === actor.id)
    if (!fresh || fresh.routed) continue
    const action = pickGreedy(next, fresh, simCtx)
    if (!action) continue
    next = applyAction(next, fresh, action, applyContext)
  }
  return next
}

function rolloutWholeTurn(state: SimState, team: Team, simCtx: SimContext): SimState {
  const reset = resetTurnFlags(state, team)
  return rolloutRest(reset, team, null, simCtx)
}

function enemyResponseValue(
  state: SimState,
  enemyTeam: Team,
  botTeam: Team,
  depth: number,
  alpha: number,
  beta: number,
  simCtx: SimContext,
): number {
  if (Date.now() >= simCtx.deadline) {
    return evalState(state, botTeam)
  }

  const resetState = resetTurnFlags(state, enemyTeam)

  const enemies = resetState.units
    .filter(u => u.team === enemyTeam && !u.routed)
    .sort((a, b) => a.id.localeCompare(b.id))

  if (enemies.length === 0) {
    return evalState(resetState, botTeam)
  }

  const firstEnemy = enemies[0]
  const beam = topActions(resetState, firstEnemy, simCtx, simCtx.enemyBeamWidth)
  if (beam.length === 0) {
    return evalState(resetState, botTeam)
  }

  const applyContext = applyCtx(simCtx)
  let worstForBot = +Infinity
  let localBeta = beta

  for (const action of beam) {
    if (Date.now() >= simCtx.deadline) break
    let next = applyAction(resetState, firstEnemy, action, applyContext)
    next = rolloutRest(next, enemyTeam, firstEnemy.id, simCtx)
    if (depth >= 3) {
      next = rolloutWholeTurn(next, botTeam, simCtx)
    }
    const val = evalState(next, botTeam)
    if (val < worstForBot) worstForBot = val
    localBeta = Math.min(localBeta, val)
    if (localBeta <= alpha) break
  }

  return worstForBot === +Infinity ? evalState(resetState, botTeam) : worstForBot
}

function searchAtDepth(
  state: SimState,
  unit: UnitState,
  simCtx: SimContext,
  depth: number,
): { action: AIAction; value: number } | null {
  const beam = topActions(state, unit, simCtx, simCtx.beamWidth)
  if (beam.length === 0) return null

  const applyContext = applyCtx(simCtx)
  const enemyTeam = otherTeam(simCtx.botTeam)
  let bestAction: AIAction = beam[0]
  let bestVal = -Infinity
  let alpha = -Infinity
  const beta = +Infinity

  for (const action of beam) {
    if (Date.now() >= simCtx.deadline) break
    let next = applyAction(state, unit, action, applyContext)
    next = rolloutRest(next, simCtx.botTeam, unit.id, simCtx)
    const val = enemyResponseValue(next, enemyTeam, simCtx.botTeam, depth, alpha, beta, simCtx)
    if (val > bestVal) {
      bestVal = val
      bestAction = action
    }
    if (val > alpha) alpha = val
  }
  return { action: bestAction, value: bestVal }
}

export function searchBestAction(
  state: SimState,
  unit: UnitState,
  simCtx: SimContext,
  maxDepth: number,
): AIAction {
  const fallback = pickGreedy(state, unit, simCtx) ?? { kind: 'hold' }

  let best: AIAction = fallback
  for (let depth = 2; depth <= maxDepth; depth++) {
    if (Date.now() >= simCtx.deadline) break
    const result = searchAtDepth(state, unit, simCtx, depth)
    if (result && Date.now() < simCtx.deadline) {
      best = result.action
    }
  }
  return best
}
