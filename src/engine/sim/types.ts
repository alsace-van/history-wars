// v1.0 (17/05/2026) — Phase 4-bis Lot 2 : types simulation in-memory pour lookahead minimax
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.

import type { Team } from '../../types/game'
import type { UnitId, UnitState } from '../units/types'
import type { AIContext } from '../ai/types'

/**
 * État de jeu in-memory utilisé par la simulation lookahead.
 *
 * On NE clone PAS terrainMap / boardKeys / combatConfig (immutables passés via SimContext).
 * On NE simule PAS le fog : approximation = snapshot visibilité du début de tour bot, conservée
 * tout au long de la sim. Pour lookahead 2-3 ply, suffisant : l'IA estime le pire raisonnable.
 *
 * Toutes les propriétés readonly : sim fonctionnelle pure, on retourne toujours un nouveau SimState.
 */
export interface SimState {
  readonly units: ReadonlyArray<UnitState>
  readonly engagedUnitIds: ReadonlySet<UnitId>
  /** Numéro de tour relatif (incrémenté à chaque switch de side complet). Sert juste à borner. */
  readonly turn: number
}

/**
 * Contexte partagé par toute la sim (immuables passés au niveau du root). Construit une seule fois
 * à l'entrée de `searchBestAction`. Le `ctx.allUnits` original est remplacé par `state.units` à
 * chaque nœud — on fournit `derive(state)` pour rebuild un AIContext valide.
 */
export interface SimContext {
  /** AIContext de base, hors `allUnits` / `engagedUnitIds` qui dérivent du SimState courant. */
  readonly baseCtx: AIContext
  /** Équipe du bot (POV positif dans evalState). */
  readonly botTeam: Team
  /** Largeur du beam (top-N actions explorées par nœud). 3 pour medium, 5 pour hard. */
  readonly beamWidth: number
  /** Largeur du beam pour la réponse adverse (souvent plus étroite). */
  readonly enemyBeamWidth: number
  /** Date.now() limite. Au-delà, retour anticipé avec eval courante. */
  readonly deadline: number
}

/**
 * Résultat d'une exploration alphaBeta (utilitaire interne).
 */
export interface SearchResult {
  readonly action: import('../ai/types').AIAction | null
  readonly value: number
}
