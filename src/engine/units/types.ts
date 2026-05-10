// v2.0 (10/05/2026) — Phase 2 2A.1 : effective elastique + killed cumul + champs Phase 5/6 placeholders
// v1.1 (10/05/2026) — Phase 1.5 : ajout `wounded` (soldats blesses, soignables Phase 3)
// v1.0 (09/05/2026) — Phase 1 L1A.1 : types unite tactique
// Frontiere engine/ : zero React, zero Three, zero Supabase

import type { Cube } from '../hex'
import type { Team, UnitKind } from '../../types/game'

export type UnitId = string

/**
 * Stats de base d'un type d'unite. Constantes par UnitKind.
 * range = 1 → melee. range >= 2 → ranged.
 * v1 conservee 1 phase pour retrocompat. Combat v2 utilise UnitStatsV2 (stats.ts).
 */
export interface UnitStats {
  readonly hpMax: number
  readonly attack: number
  readonly defense: number
  readonly range: number
  readonly movement: number
  readonly moraleMax: number
}

/**
 * Sous-type d'une UnitKind. Affine le comportement combat v2 :
 *   archer    : range courte (4), pas de min_range, mousquet/arc.
 *   artillery : range longue (7), min_range 2 (pas de tir a bout portant).
 * Si non defini, defaut depuis UNIT_STATS_V2[kind] (artillery pour A).
 */
export type UnitSubKind = 'archer' | 'artillery'

/**
 * Etat vivant d'une unite sur le plateau.
 *
 * Phase 2 (v2) : effectif elastique en plus de hp legacy.
 *  - effective    : nombre d'hommes vivants et combattants ce tour
 *  - effectiveMax : capacite plein regiment (cf. UNIT_STATS_V2)
 *  - effectiveMin : seuil de disparition (sous ce seuil → fusion forcee Phase 5)
 *  - killed       : cumul des morts depuis le debut de la partie (stats fin de partie)
 *  - lastMovePath : trajectoire effective ce tour (pour detecter charge cav)
 *  - subKind      : differencie archer / artillery au sein de A
 *  - regimentId   : placeholder Phase 6 (regroupement de pions)
 *  - formation    : placeholder Phase 5 (ligne, colonne, carre, etc.)
 *
 * hp / hpMax / wounded : conserves 1 phase pour retrocompat (drop Phase 4).
 *
 * Toutes les proprietes readonly : engine fonctionnel pur.
 */
export interface UnitState {
  readonly id: UnitId
  readonly kind: UnitKind
  readonly team: Team
  readonly position: Cube
  /** Soldats actifs (combattent, recoivent les coups, projettent ZoC). Legacy v1. */
  readonly hp: number
  readonly hpMax: number
  /**
   * Soldats blesses : ne combattent pas, ne projettent pas de ZoC, mais sont
   * encore presents physiquement. Soignables par Infirmier (Phase 5).
   * Invariant : hp + wounded <= hpMax.
   */
  readonly wounded: number
  readonly morale: number
  readonly moraleMax: number
  readonly hasMoved: boolean
  readonly hasAttacked: boolean
  readonly routed: boolean
  // --- Phase 2 (v2) : effectif elastique ---
  /** Hommes vivants combattants. Source de verite Phase 2. */
  readonly effective: number
  /** Capacite plein regiment, cf. UNIT_STATS_V2[kind]. */
  readonly effectiveMax: number
  /** Seuil sous lequel le pion disparait / fusionne (BACKLOG-effectif-critique). */
  readonly effectiveMin: number
  /** Cumul des morts subis (pour stats fin de partie). */
  readonly killed: number
  /** Trajectoire effective ce tour (alimentee par EF move, lue par EF attack pour charge cav). */
  readonly lastMovePath?: ReadonlyArray<Cube>
  /** Differencie archer / artillery au sein de UnitKind 'A'. */
  readonly subKind?: UnitSubKind
  /** Placeholder Phase 6 (regroupement de pions sous un meme etendard). */
  readonly regimentId?: string
  /** Placeholder Phase 5 (ligne, colonne, carre, etc.). */
  readonly formation?: string
}
