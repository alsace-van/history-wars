// v1.1 (17/05/2026) — Phase 4-bis Lot 2 : ajout lookaheadDepth + deadlineMs (opt-in minimax)
// v1.0 (14/05/2026) — Phase 4 Lot A1 : types IA (action enum + context + profile)
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.

import type { Cube } from '../hex'
import type { TerrainType } from '../terrain/types'
import type { CombatConfig } from '../combat/v2/types'
import type { UnitId, UnitState } from '../units/types'

/**
 * Profil de difficulté IA. Différence MVP 1 ply :
 *  - `easy`   : random parmi top 3 actions scorées (introduit du bruit).
 *  - `medium` : pick top 1 strict (greedy).
 *  - `hard`   : pick top 1 + tiebreaker offensif (attaque > move > hold).
 */
export type AIProfile = 'easy' | 'medium' | 'hard'

/**
 * Action atomique évaluée et résolue par l'IA.
 * Mirror des kinds acceptés par `resolve_action` côté Edge Function.
 */
export type AIAction =
  | { readonly kind: 'move'; readonly dest: Cube }
  | { readonly kind: 'attack_melee'; readonly targetId: UnitId }
  | { readonly kind: 'attack_ranged'; readonly targetId: UnitId }
  | { readonly kind: 'hold' }

/**
 * Contexte d'évaluation. Le caller (EF run_bot_turn) construit le snapshot
 * en début de tour bot et le passe en immuable. Pas de mutation.
 */
export interface AIContext {
  /** Toutes les unités vivantes de la partie (snapshot début tour bot). */
  readonly allUnits: ReadonlyArray<UnitState>
  /** Set des unitId ennemis visibles par l'équipe du bot (LoS + range). */
  readonly visibleEnemyIds: ReadonlySet<UnitId>
  /** Set des cubeKey hex visibles par l'équipe du bot. */
  readonly visibleTileKeys: ReadonlySet<string>
  /** Set des cubeKey appartenant au plateau (limite mouvement / pathfinding). */
  readonly boardKeys: ReadonlySet<string>
  /** Map cubeKey → TerrainType. Default si absent : 'plaine_standard'. */
  readonly terrainMap: ReadonlyMap<string, TerrainType>
  /** Config combat (matchup matrix, attrition, variance) — partagée avec resolveCombat. */
  readonly combatConfig: CombatConfig
  /** Profil de difficulté. */
  readonly profile: AIProfile
  /** RNG seedé (déterminisme du choix random parmi top 3 en easy). */
  readonly rng: () => number
  /** Set des unitId engagés (mêlée persistante). Mouvement bloqué tant qu'engagé. */
  readonly engagedUnitIds: ReadonlySet<UnitId>
  /**
   * Phase 4-bis Lot 2 — profondeur du lookahead minimax.
   *  - undefined / 1 → greedy 1 ply (comportement Phase 4 Lot A, easy/medium MVP).
   *  - 2 → minimax 2 ply (beam étroit, medium par défaut).
   *  - 3 → minimax 3 ply (beam plus large, hard par défaut).
   * Si défini, `pickBestActionForUnit` délègue à `searchBestAction` (engine/sim).
   * Easy ignore ce flag (reste random parmi top 3 pour conserver son caractère).
   */
  readonly lookaheadDepth?: number
  /**
   * Phase 4-bis Lot 2 — deadline absolue (Date.now() ms). Utilisée par iterative deepening
   * pour borner le temps total de la recherche. Si undefined : 3500 ms par défaut.
   */
  readonly deadlineMs?: number
}

/** Score interne d'une action candidate (utilisé par picker). */
export interface ScoredAction {
  readonly action: AIAction
  readonly score: number
}
