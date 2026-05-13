// v1.0 (13/05/2026) — Phase 3.2-bis : helper ordinal labels (I.1, C.1, A.1 par team)
// Frontière engine/ : zéro React/Three/Supabase. Utilisable côté UI + render.
//
// Ordre = ordre du tableau d'entrée (= ordre `created_at` côté useBattleUnits).
// Si un pion meurt, les suivants se décalent (acceptable MVP, stabilisation plus tard
// via persistance d'un `ordinal_index` BDD).

import type { Team, UnitKind } from '../../types/game'

interface MinimalUnit {
  readonly id: string
  readonly kind: UnitKind
  readonly team: Team
}

/**
 * Retourne une Map `unitId → "K.N"` où K = kind, N = ordinal (1-indexé) du pion
 * dans son couple (team, kind). Stable pour un même tableau d'entrée.
 */
export function computeOrdinalLabels(units: ReadonlyArray<MinimalUnit>): Map<string, string> {
  const counters = new Map<string, number>()  // key = "team|kind"
  const out = new Map<string, string>()
  for (const u of units) {
    const key = `${u.team}|${u.kind}`
    const next = (counters.get(key) ?? 0) + 1
    counters.set(key, next)
    out.set(u.id, `${u.kind}.${next}`)
  }
  return out
}
