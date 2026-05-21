// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : eval d'état pour minimax
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.

import type { Team } from '../../types/game'
import type { SimState } from './types'

const MORALE_WEIGHT = 0.3
const ROUTED_PENALTY = 100

/**
 * Évalue un SimState du POV `teamPov` (positif = favorable au bot).
 *
 * Formule :
 *   eval = Σ alliés (effective + 0.3 × morale)
 *        − Σ ennemis (effective + 0.3 × morale)
 *        + 100 × (ennemis routed)
 *        − 100 × (alliés routed)
 *
 * Routed = unité qui a fui (computeRouted). Cela représente une perte stratégique forte :
 * elle ne combat plus et bloque parfois sa propre équipe. On lui met un gros bonus/malus.
 *
 * NB : on ne pondère pas par kind (cav/inf/arty) ni par valeur historique — c'est une
 * heuristique grossière mais SUFFISANTE pour faire émerger des choix non-suicidaires.
 */
export function evalState(state: SimState, teamPov: Team): number {
  let score = 0
  for (const u of state.units) {
    const value = u.effective + u.morale * MORALE_WEIGHT
    const routedDelta = u.routed ? ROUTED_PENALTY : 0
    if (u.team === teamPov) {
      score += value
      score -= routedDelta
    } else {
      score -= value
      score += routedDelta
    }
  }
  return score
}
