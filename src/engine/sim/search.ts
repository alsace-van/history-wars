// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : recherche minimax α-β + iterative deepening
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.
//
// Modèle de recherche (cf. plan cached-nibbling-wadler.md) :
//   - Au root, on explore les actions du beam (top-N par scoreAction) pour l'unité courante.
//   - Pour chaque candidate, on rollout greedy le RESTE du tour bot (unités id > current),
//     puis on simule la réponse adverse (beam sur la 1re unité adverse), puis rollout greedy du
//     reste du tour adverse.
//   - À depth >= 3, on rollout greedy le tour bot suivant avant d'évaluer.
//   - À chaque nœud : check deadline (Date.now() >= ctx.deadline) → coupe et eval immédiat.
//   - Fallback toujours garanti : si aucune itération ne termine, on retourne la 1re action du beam.

import type { AIAction } from '../ai/types'
import { enumerateActions } from '../ai/picker'
import { scoreAction } from '../ai/scorer'
import type { Team } from '../../types/game'
import type { UnitState } from '../units/types'
import { applyAction, resetTurnFlags, type ApplyActionContext } from './applyAction'
import { ctxFromState } from './clone'
import { evalState } from './evalState'
import type { SimContext, SimState } from './types'

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

/**
 * Énumère + score les actions d'une unité dans un SimState, renvoie le top-beam.
 * Réutilise `enumerateActions` + `scoreAction` du module ai (ctx rebuild depuis state).
 */
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

/**
 * Choisit l'action greedy 1-ply (top 1) pour une unité. Utilisée dans les rollouts.
 */
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

/**
 * Rollout greedy du RESTE du tour d'une équipe : pour chaque unité non encore agie (id > afterId,
 * ou toutes si afterId === null), pick top-1 et applique. Retourne le SimState final.
 */
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
    // Re-fetch unit dans state courant (peut avoir été mutée par action précédente)
    const fresh = next.units.find(u => u.id === actor.id)
    if (!fresh || fresh.routed) continue
    const action = pickGreedy(next, fresh, simCtx)
    if (!action) continue
    next = applyAction(next, fresh, action, applyContext)
  }
  return next
}

/**
 * Rollout greedy du TOUR ENTIER d'une équipe (reset flags + rollout all units).
 */
function rolloutWholeTurn(state: SimState, team: Team, simCtx: SimContext): SimState {
  const reset = resetTurnFlags(state, team)
  return rolloutRest(reset, team, null, simCtx)
}

/**
 * Réponse adverse : explore le beam sur la 1re unité ennemie, rollout greedy le reste.
 * Si depth >= 3, on rollout aussi le tour bot suivant pour évaluer "à long terme".
 * Retourne la valeur eval MINIMALE pour le bot (l'ennemi joue contre nous).
 */
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

  // Reset des flags pour l'ennemi (nouveau tour adverse simulé)
  const resetState = resetTurnFlags(state, enemyTeam)

  const enemies = resetState.units
    .filter(u => u.team === enemyTeam && !u.routed)
    .sort((a, b) => a.id.localeCompare(b.id))

  if (enemies.length === 0) {
    return evalState(resetState, botTeam)
  }

  // Beam sur la 1re unité ennemie
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
    // Rollout reste du tour ennemi (greedy)
    next = rolloutRest(next, enemyTeam, firstEnemy.id, simCtx)
    // Si depth >= 3 : on simule un tour bot supplémentaire (greedy) avant d'évaluer
    if (depth >= 3) {
      next = rolloutWholeTurn(next, botTeam, simCtx)
    }
    const val = evalState(next, botTeam)
    if (val < worstForBot) worstForBot = val
    localBeta = Math.min(localBeta, val)
    if (localBeta <= alpha) break  // α cutoff
  }

  return worstForBot === +Infinity ? evalState(resetState, botTeam) : worstForBot
}

/**
 * Recherche minimax pour l'unité courante à une profondeur fixe.
 * Retourne l'action recommandée (jamais null : fallback sur 1re action du beam).
 */
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
    // Rollout reste du tour bot
    next = rolloutRest(next, simCtx.botTeam, unit.id, simCtx)
    // Réponse adverse (avec beam + éventuel rollout bot tour+1 si depth>=3)
    const val = enemyResponseValue(next, enemyTeam, simCtx.botTeam, depth, alpha, beta, simCtx)
    if (val > bestVal) {
      bestVal = val
      bestAction = action
    }
    if (val > alpha) alpha = val
    // Pas de cutoff possible côté root (beta = +Infinity) sauf si quelqu'un nous bat.
  }
  return { action: bestAction, value: bestVal }
}

/**
 * Entrée publique : iterative deepening avec deadline.
 *
 * Sémantique deadline :
 *  - À chaque itération de profondeur, on tente une recherche complète.
 *  - Si Date.now() >= deadline pendant la recherche → on coupe les nœuds restants et on
 *    accepte le résultat partiel (qui reste meilleur que la profondeur précédente, sauf bug).
 *  - On garantit toujours de retourner la meilleure action du beam 1-ply en fallback ultime.
 *
 * Paramètre `maxDepth` :
 *  - 2 pour medium (beam plus étroit)
 *  - 3 pour hard (beam plus large)
 */
export function searchBestAction(
  state: SimState,
  unit: UnitState,
  simCtx: SimContext,
  maxDepth: number,
): AIAction {
  // Fallback 1-ply garanti
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
