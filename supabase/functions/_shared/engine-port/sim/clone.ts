// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : helpers clone shallow
// PORT FROM src/engine/sim/clone.ts — DO NOT EDIT MANUALLY.

import type { UnitState } from '../units.ts'
import type { SimState } from './types.ts'
import type { AIContext } from '../ai/types.ts'

type UnitId = string

export function cloneUnits(units: ReadonlyArray<UnitState>): UnitState[] {
  return units.map(u => ({ ...u }))
}

export function withUnits(state: SimState, nextUnits: ReadonlyArray<UnitState>): SimState {
  return { units: nextUnits, engagedUnitIds: state.engagedUnitIds, turn: state.turn }
}

export function replaceUnit(units: ReadonlyArray<UnitState>, next: UnitState): UnitState[] {
  const idx = units.findIndex(u => u.id === next.id)
  if (idx === -1) return [...units, next]
  const out = units.slice()
  out[idx] = next
  return out
}

export function removeUnit(units: ReadonlyArray<UnitState>, id: UnitId): UnitState[] {
  return units.filter(u => u.id !== id)
}

export function ctxFromState(baseCtx: AIContext, state: SimState): AIContext {
  return {
    ...baseCtx,
    allUnits: state.units,
    engagedUnitIds: state.engagedUnitIds,
  }
}
