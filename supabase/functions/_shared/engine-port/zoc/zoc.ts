// v1.0 (09/05/2026) — Phase 1 L1B.3 : port zoc pour Deno EF
// Source de verite : src/engine/zoc/zoc.ts. Duplication controlee (piege #12).
// Contrat : ZdC = 6 voisins de chaque ennemi non-routed. Case ennemie = blocker, pas ZdC.

import { neighbors, cubeKey } from '../hex/index.ts'
import type { Cube } from '../hex/index.ts'
import type { Team } from '../../types.ts'

export interface UnitForZoc {
  readonly team: Team
  readonly position: Cube
  readonly routed: boolean
}

export function computeEnemyZoc(
  units: ReadonlyArray<UnitForZoc>,
  myTeam: Team,
): Set<string> {
  const zoc = new Set<string>()
  for (const u of units) {
    if (u.team === myTeam) continue
    if (u.routed) continue
    for (const n of neighbors(u.position)) {
      zoc.add(cubeKey(n))
    }
  }
  return zoc
}
