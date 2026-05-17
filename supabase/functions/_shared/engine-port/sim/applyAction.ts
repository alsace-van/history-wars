// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : applyAction PUR pour lookahead minimax
// PORT FROM src/engine/sim/applyAction.ts — DO NOT EDIT MANUALLY.

import { cubeDistance, type Cube } from '../hex/index.ts'
import { cubeKey } from '../hex/key.ts'
import { resolveCombat } from '../combat/v2/index.ts'
import { DEFAULT_COMBAT_CONFIG } from '../combat/v2/types.ts'
import type { CombatConfig } from '../combat/v2/types.ts'
import { DEFAULT_TERRAIN, type TerrainType } from '../terrain/index.ts'
import type { AIAction } from '../ai/types.ts'
import type { UnitState } from '../units.ts'
import { removeUnit, replaceUnit } from './clone.ts'
import type { SimState } from './types.ts'

type UnitId = string

export interface ApplyActionContext {
  readonly terrainMap: ReadonlyMap<string, TerrainType>
  readonly combatConfig: CombatConfig
  readonly rng: () => number
}

function terrainAt(ctx: ApplyActionContext, hex: Cube): TerrainType {
  return ctx.terrainMap.get(cubeKey(hex)) ?? DEFAULT_TERRAIN
}

export function applyAction(
  state: SimState,
  unit: UnitState,
  action: AIAction,
  ctx: ApplyActionContext,
): SimState {
  switch (action.kind) {
    case 'hold':
      return state
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
  if (!defender) return state

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
  })

  const defenderKilled = combat.defenderKilled
  const defenderKilledStat = defender.killed + combat.killed

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

export function resetTurnFlags(state: SimState, team: 'blue' | 'red'): SimState {
  const next = state.units.map(u =>
    u.team === team && !u.routed
      ? { ...u, hasMoved: false, hasAttacked: false }
      : u,
  )
  return { units: next, engagedUnitIds: state.engagedUnitIds, turn: state.turn + 1 }
}
