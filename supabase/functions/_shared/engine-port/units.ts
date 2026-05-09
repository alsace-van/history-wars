// v1.0 (09/05/2026) — Phase 1 L1B.2 : port engine/units pour Deno EF
// Source de verite : src/engine/units/stats.ts. Duplication controlee (piege #12).
// Si ce fichier diverge du client, les stats ne matcheront plus → tester la parite.

import type { UnitKind } from '../types.ts'

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
