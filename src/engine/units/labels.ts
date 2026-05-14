// v1.1 (14/05/2026) — Phase 3.3 : AO/AC pour artillery_light/heavy (obusier/canon)
// v1.0 (13/05/2026) — Phase 3.2-bis : helper ordinal labels (I.1, C.1, A.1 par team)
// Frontière engine/ : zéro React/Three/Supabase. Utilisable côté UI + render.
//
// Ordre = ordre du tableau d'entrée (= ordre `created_at` côté useBattleUnits).
// Si un pion meurt, les suivants se décalent (acceptable MVP, stabilisation plus tard
// via persistance d'un `ordinal_index` BDD).

import type { Team, UnitKind } from '../../types/game'
import type { UnitSubKind } from './types'

interface MinimalUnit {
  readonly id: string
  readonly kind: UnitKind
  readonly team: Team
  readonly subKind?: UnitSubKind
}

/** Étiquette compacte tenant compte du subKind (AO = obusier, AC = canon). */
export function getKindCode(kind: UnitKind, subKind?: UnitSubKind): string {
  if (kind !== 'A') return kind
  if (subKind === 'artillery_light') return 'AO'
  if (subKind === 'artillery_heavy') return 'AC'
  return 'A'
}

/**
 * Retourne une Map `unitId → "K.N"` où K = code (I, C, A, AO, AC) et N = ordinal
 * (1-indexé) du pion dans son couple (team, code). Stable pour un même tableau d'entrée.
 */
export function computeOrdinalLabels(units: ReadonlyArray<MinimalUnit>): Map<string, string> {
  const counters = new Map<string, number>()  // key = "team|code"
  const out = new Map<string, string>()
  for (const u of units) {
    const code = getKindCode(u.kind, u.subKind)
    const key = `${u.team}|${code}`
    const next = (counters.get(key) ?? 0) + 1
    counters.set(key, next)
    out.set(u.id, `${code}.${next}`)
  }
  return out
}
