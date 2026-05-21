// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : helpers clone shallow pour sim lookahead
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.

import type { UnitId, UnitState } from '../units/types'
import type { SimState } from './types'
import type { AIContext } from '../ai/types'

/**
 * Clone l'array units (shallow). UnitState = scalars + Cube plat + lastMovePath (skip car
 * jamais lu pendant la sim, et même s'il l'était : ReadonlyArray). Coût O(n) avec n≤~30.
 */
export function cloneUnits(units: ReadonlyArray<UnitState>): UnitState[] {
  return units.map(u => ({ ...u }))
}

/**
 * Construit un nouvel SimState avec un sous-ensemble modifié d'units.
 * Les units non concernées sont conservées par référence (immutabilité préservée).
 */
export function withUnits(state: SimState, nextUnits: ReadonlyArray<UnitState>): SimState {
  return { units: nextUnits, engagedUnitIds: state.engagedUnitIds, turn: state.turn }
}

/**
 * Remplace une unité par id. Si pas trouvée, ajoute. Renvoie un nouveau tableau.
 */
export function replaceUnit(units: ReadonlyArray<UnitState>, next: UnitState): UnitState[] {
  const idx = units.findIndex(u => u.id === next.id)
  if (idx === -1) return [...units, next]
  const out = units.slice()
  out[idx] = next
  return out
}

/**
 * Retire une unité par id (kill).
 */
export function removeUnit(units: ReadonlyArray<UnitState>, id: UnitId): UnitState[] {
  return units.filter(u => u.id !== id)
}

/**
 * Rebuild un AIContext valide pour un SimState donné (allUnits + engagedUnitIds remplacés,
 * reste inchangé : terrain, board, config, profile, rng, visible*).
 *
 * Note visibilité : on garde le snapshot de visibilité du début de tour bot. C'est conservateur :
 * on ne simule pas les nouveaux ennemis qui sortiraient du fog en cours de tour. Suffisant pour
 * 2-3 ply.
 */
export function ctxFromState(baseCtx: AIContext, state: SimState): AIContext {
  return {
    ...baseCtx,
    allUnits: state.units,
    engagedUnitIds: state.engagedUnitIds,
  }
}
