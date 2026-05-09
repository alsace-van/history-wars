// v1.0 (09/05/2026) — Phase 1 L1A.1 : stats de base par UnitKind
// Source : PLAN-PHASE-1.md § 2.2

import type { UnitKind } from '../../types/game'
import type { UnitStats } from './types'

/**
 * Stats de base par type d'unite.
 *   I (Infanterie) : tank de ligne, melee, mobilite moyenne.
 *   C (Cavalerie)  : punch + mobilite, defense faible.
 *   A (Artillerie) : range 4, faible HP, faible mobilite.
 * Object.freeze : verrou runtime contre les mutations accidentelles.
 */
export const UNIT_STATS_BY_KIND: Readonly<Record<UnitKind, UnitStats>> = Object.freeze({
  I: Object.freeze({ hpMax: 100, attack: 25, defense: 30, range: 1, movement: 3, moraleMax: 100 }),
  C: Object.freeze({ hpMax:  80, attack: 35, defense: 20, range: 1, movement: 6, moraleMax: 100 }),
  A: Object.freeze({ hpMax:  60, attack: 40, defense: 15, range: 4, movement: 2, moraleMax: 100 }),
})

export function getUnitStats(kind: UnitKind): UnitStats {
  return UNIT_STATS_BY_KIND[kind]
}
