// v1.1 (09/05/2026) — Phase 1 L1B.4a : ajout UnitState (necessaire morale + combat)
// v1.0 (09/05/2026) — Phase 1 L1B.2 : port engine/units pour Deno EF
// Source de verite : src/engine/units/{stats.ts,types.ts}. Duplication controlee (piege #12).

import type { UnitKind, Team } from '../types.ts'
import type { Cube } from './hex/index.ts'

export interface UnitStats {
  hpMax: number
  attack: number
  defense: number
  range: number
  movement: number
  moraleMax: number
}

export const UNIT_STATS_BY_KIND: Record<UnitKind, UnitStats> = Object.freeze({
  I: Object.freeze({ hpMax: 100, attack: 25, defense: 30, range: 1, movement: 3, moraleMax: 100 }),
  C: Object.freeze({ hpMax:  80, attack: 35, defense: 20, range: 1, movement: 6, moraleMax: 100 }),
  A: Object.freeze({ hpMax:  60, attack: 40, defense: 15, range: 4, movement: 2, moraleMax: 100 }),
}) as Record<UnitKind, UnitStats>

export function getUnitStats(kind: UnitKind): UnitStats {
  return UNIT_STATS_BY_KIND[kind]
}

/**
 * Etat d'une unite consomme par les fonctions engine pures (morale, combat).
 * Bati a la volee dans les EF depuis UnitRow.
 * Source : src/engine/units/types.ts (UnitState).
 */
export interface UnitState {
  readonly id: string
  readonly kind: UnitKind
  readonly team: Team
  readonly position: Cube
  readonly hp: number
  readonly hpMax: number
  readonly morale: number
  readonly moraleMax: number
  readonly hasMoved: boolean
  readonly hasAttacked: boolean
  readonly routed: boolean
}
