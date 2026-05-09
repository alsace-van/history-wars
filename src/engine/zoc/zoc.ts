// v1.0 (09/05/2026) — Phase 1 L1A.2 : zones de controle (ZdC)
// Source : PLAN-PHASE-1.md § 2.2 (engine/zoc/zoc.ts)
// Contrat : ZdC ennemie = 6 voisins de chaque unite ennemie non-routed.
//           La case de l'ennemi lui-meme n'est PAS en ZdC (elle est occupee → blocker).
//           Une unite routed ne projette pas de ZdC (panique, plus de discipline).

import { neighbors, cubeKey } from '../hex'
import type { Team } from '../../types/game'
import type { UnitState } from '../units/types'

/**
 * Calcule l'ensemble des hex (cubeKey) en ZdC ennemie pour un joueur de team `myTeam`.
 * Utilise par le BFS / A* (entree OK, sortie +∞ = pas d'expansion depuis cet hex).
 */
export function computeEnemyZoc(
  units: ReadonlyArray<UnitState>,
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
