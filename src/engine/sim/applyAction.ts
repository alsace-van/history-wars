// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : applyAction PUR pour lookahead minimax
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.
//
// Cette fonction reproduit fidèlement les mutations DB de `applyBotAction` côté EF
// (supabase/functions/run_bot_turn/index.ts l.205-365) mais SANS toucher la DB.
// Indispensable pour explorer un arbre minimax in-memory.
//
// Divergences assumées vs EF prod (MVP Lot 2) :
//  - support tactique (computeSupport) PAS pris en compte. Sim < temps réel pour rester rapide.
//  - charge cav avec path : approximée — on synthétise un path direct seulement si distance>=2 ;
//    en sim la plupart des charges seront comptées comme melee simple. Acceptable pour évaluation.

import { cubeDistance, type Cube } from '../hex'
import { resolveCombat, DEFAULT_COMBAT_CONFIG } from '../combat/v2'
import type { CombatConfig } from '../combat/v2/types'
import { DEFAULT_TERRAIN, type TerrainType } from '../terrain/types'
import type { AIAction } from '../ai/types'
import type { UnitId, UnitState } from '../units/types'
import { cubeKey } from '../hex/key'
import { removeUnit, replaceUnit } from './clone'
import type { SimState } from './types'

export interface ApplyActionContext {
  readonly terrainMap: ReadonlyMap<string, TerrainType>
  readonly combatConfig: CombatConfig
  readonly rng: () => number
}

function terrainAt(ctx: ApplyActionContext, hex: Cube): TerrainType {
  return ctx.terrainMap.get(cubeKey(hex)) ?? DEFAULT_TERRAIN
}

/**
 * Applique une AIAction à un SimState, renvoie un nouveau SimState.
 * Pas de mutation : units = nouveau tableau, engagedUnitIds = nouveau Set si modifié.
 */
export function applyAction(
  state: SimState,
  unit: UnitState,
  action: AIAction,
  ctx: ApplyActionContext,
): SimState {
  switch (action.kind) {
    case 'hold':
      return state  // no-op (cf. EF l.208-215 : juste log game_actions, pas de mutation)
    case 'move':
      return applyMove(state, unit, action.dest)
    case 'attack_melee':
    case 'attack_ranged':
      return applyAttack(state, unit, action.targetId, ctx)
  }
}

function applyMove(state: SimState, unit: UnitState, dest: Cube): SimState {
  const next: UnitState = { ...unit, position: dest, hasMoved: true }
  return {
    units: replaceUnit(state.units, next),
    engagedUnitIds: state.engagedUnitIds,
    turn: state.turn,
  }
}

function applyAttack(
  state: SimState,
  attacker: UnitState,
  targetId: UnitId,
  ctx: ApplyActionContext,
): SimState {
  const defender = state.units.find(u => u.id === targetId)
  if (!defender) return state  // cible disparue entre score et apply (rare en sim)

  const distance = cubeDistance(attacker.position, defender.position)
  const config = ctx.combatConfig ?? DEFAULT_COMBAT_CONFIG

  const { result: combat, ripost } = resolveCombat({
    attacker,
    defender,
    attackerTerrain: terrainAt(ctx, attacker.position),
    defenderTerrain: terrainAt(ctx, defender.position),
    distance,
    rng: ctx.rng,
    config,
    // Pas de support / hold posture en sim MVP : approximation rapide.
  })

  // État défenseur post-impact
  const defenderKilled = combat.defenderKilled
  const defenderKilledStat = defender.killed + combat.killed

  // État attaquant post-ripost (si ripost === null, attaquant inchangé hormis morale combat)
  let attackerHpAfter = attacker.hp
  let attackerWoundedAfter = attacker.wounded
  let attackerEffectiveAfter = attacker.effective
  let attackerKilledStat = attacker.killed
  let attackerMoraleAfter = combat.attackerMoraleAfter
  let attackerRoutedAfter = combat.attackerRouted
  let attackerKilled = false
  let defenderMoraleAfter = combat.defenderMoraleAfter
  let defenderRoutedAfter = combat.defenderRouted

  if (ripost) {
    attackerHpAfter = ripost.defenderHpAfter
    attackerWoundedAfter = ripost.defenderWoundedAfter
    attackerEffectiveAfter = ripost.defenderEffectiveAfter
    attackerKilledStat = attacker.killed + ripost.killed
    attackerMoraleAfter = ripost.defenderMoraleAfter
    attackerRoutedAfter = ripost.defenderRouted
    attackerKilled = ripost.defenderKilled
    defenderMoraleAfter = ripost.attackerMoraleAfter
    defenderRoutedAfter = ripost.attackerRouted
  }

  // Construit les nouveaux UnitState (ou retire si killed)
  let nextUnits = state.units

  if (defenderKilled) {
    nextUnits = removeUnit(nextUnits, defender.id)
  } else {
    const defenderNext: UnitState = {
      ...defender,
      hp: combat.defenderHpAfter,
      wounded: combat.defenderWoundedAfter,
      effective: combat.defenderEffectiveAfter,
      killed: defenderKilledStat,
      morale: defenderMoraleAfter,
      routed: defenderRoutedAfter,
    }
    nextUnits = replaceUnit(nextUnits, defenderNext)
  }

  if (attackerKilled) {
    nextUnits = removeUnit(nextUnits, attacker.id)
  } else {
    const attackerNext: UnitState = {
      ...attacker,
      hp: attackerHpAfter,
      wounded: attackerWoundedAfter,
      effective: attackerEffectiveAfter,
      killed: attackerKilledStat,
      morale: attackerMoraleAfter,
      routed: attackerRoutedAfter,
      hasAttacked: true,
    }
    nextUnits = replaceUnit(nextUnits, attackerNext)
  }

  // Engagement Phase 2.6 : si melee non-mortelle bilatérale, on engage les 2 unités.
  let engagedNext: ReadonlySet<string> = state.engagedUnitIds
  if (combat.attackPhase === 'melee' && !defenderKilled && !attackerKilled) {
    if (!engagedNext.has(attacker.id) || !engagedNext.has(defender.id)) {
      const updated = new Set(engagedNext)
      updated.add(attacker.id)
      updated.add(defender.id)
      engagedNext = updated
    }
  }

  return { units: nextUnits, engagedUnitIds: engagedNext, turn: state.turn }
}

/**
 * Reset des flags hasMoved / hasAttacked pour les unités d'une équipe (fin de tour).
 * Utilisé par le rollout multi-ply quand on simule le changement de tour.
 * Note : on ne touche pas au morale tick (resolve_turn EF s'en charge en prod), ni aux engagements
 * (persistants tant qu'unités adjacentes — approximation : conservés tels quels).
 */
export function resetTurnFlags(state: SimState, team: 'blue' | 'red'): SimState {
  const next = state.units.map(u =>
    u.team === team && !u.routed
      ? { ...u, hasMoved: false, hasAttacked: false }
      : u,
  )
  return { units: next, engagedUnitIds: state.engagedUnitIds, turn: state.turn + 1 }
}
