// v1.1 (21/05/2026) — Phase 5 Lot 5.6 : ZdC sommée sur tous les hex de chaque unité (multi-hex)
// v1.0 (09/05/2026) — Phase 1 L1A.2 : zones de controle (ZdC)
// Source : PLAN-PHASE-1.md § 2.2 (engine/zoc/zoc.ts), PLAN-PHASE-5.md TASK 5.6.3
// Contrat : ZdC ennemie = union des 6 voisins de CHAQUE hex de CHAQUE unite ennemie
//           non-routed. Les hex occupes par l'unite elle-meme ne sont PAS en ZdC
//           (ils sont blockers BFS — convention historique 1-hex étendue multi-hex).
//           Une unite routed ne projette pas de ZdC (panique, plus de discipline).

import { neighbors, cubeKey } from '../hex'
import type { Team } from '../../types/game'
import type { UnitState } from '../units/types'
import { allCubes } from '../units/positions'

/**
 * Calcule l'ensemble des hex (cubeKey) en ZdC ennemie pour un joueur de team `myTeam`.
 * Utilise par le BFS / A* (entree OK, sortie +∞ = pas d'expansion depuis cet hex).
 *
 * Phase 5 Lot 5.6 — pour chaque unite ennemie, on itere sur tous ses hex (multi-hex),
 * et on ajoute les voisins de chacun. Les hex de l'unite elle-meme sont exclus de SA
 * propre ZdC (pas d'auto-ZdC). Compat 1-hex : `allCubes(u)` retourne `[position]` si
 * `positions` absent.
 *
 * Exemple : une unite 3-hex en ligne projette ZdC sur ~10 hex (5 voisins externes de
 * l'hex extrême gauche + 2 voisins externes uniques du milieu + 3 voisins externes du
 * droit, déduplication faite).
 */
export function computeEnemyZoc(
  units: ReadonlyArray<UnitState>,
  myTeam: Team,
): Set<string> {
  const zoc = new Set<string>()
  for (const u of units) {
    if (u.team === myTeam) continue
    if (u.routed) continue
    const ownCubes = allCubes(u)
    // Pré-calcul des clés propres à l'unité pour exclusion auto-ZdC.
    const ownKeys = new Set<string>()
    for (const c of ownCubes) ownKeys.add(cubeKey(c))
    for (const c of ownCubes) {
      for (const n of neighbors(c)) {
        const k = cubeKey(n)
        if (ownKeys.has(k)) continue
        zoc.add(k)
      }
    }
  }
  return zoc
}
