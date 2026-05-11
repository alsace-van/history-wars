// v1.0 (11/05/2026) — Phase 2.6 Vague A : barrel engine/engagement + helpers start / break / lookup
// Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 1, 3, 6
// Frontière engine/ : zéro React, zéro Three, zéro Supabase

import { splitCasualties } from '../combat/types'
import type { UnitId, UnitState } from '../units/types'
import {
  BREAK_COMBAT_COST_RATIO,
  type BreakCombatResult,
  type EngagementId,
  type EngagementState,
} from './types'

// -------------------- Re-exports vague A -------------------------

export type {
  BreakCombatResult,
  EngagementDissolutionReason,
  EngagementId,
  EngagementSideResult,
  EngagementState,
  EngagementTickInput,
  EngagementTickResult,
} from './types'
export {
  BREAK_COMBAT_COST_RATIO,
  ENGAGEMENT_MORALE_DELTA_PER_TURN,
  ENGAGEMENT_VARIANCE_LOW,
  ENGAGEMENT_VARIANCE_RANGE,
  RESERVE_RELIEF_RATE,
} from './types'
export { resolveEngagementTick } from './tick'

// -------------------- Helpers métier -------------------------

/**
 * Factory pour créer un nouvel EngagementState juste avant insertion BDD.
 *
 * Vague A : on ne génère PAS d'id (`''` placeholder). Le caller (EF handleEngage)
 * fait l'INSERT et récupère l'id généré par Postgres. On peut aussi passer un
 * `id` explicite pour les tests Vitest.
 *
 * Invariants vérifiés (caller responsable au-delà) :
 *  - unitA.id !== unitB.id
 *  - unitA.team !== unitB.team
 *
 * Pas de vérification d'adjacence ici : c'est le rôle du caller (EF + hook UI)
 * de garantir distance hex == 1 au moment de la création (cf. plan § 1.2).
 */
export function startEngagement(
  unitA: UnitState,
  unitB: UnitState,
  currentTurn: number,
  gameId: string,
  options?: { id?: EngagementId },
): EngagementState {
  if (unitA.id === unitB.id) {
    throw new Error('startEngagement: cannot engage a unit with itself')
  }
  if (unitA.team === unitB.team) {
    throw new Error('startEngagement: units must be on opposing teams')
  }
  return {
    id: options?.id ?? '',
    gameId,
    unitAId: unitA.id,
    unitBId: unitB.id,
    startedTurn: currentTurn,
  }
}

/**
 * Action volontaire "Rompre le combat" (cf. plan § 3, décision 11.3).
 *
 * Coût : 10 % effective au moment du clic, plancher à 1 perte minimum.
 * Plafond : on ne descend jamais sous effectiveMin (sinon le pion disparaîtrait
 * en rompant — trop punitif, l'idée est juste de payer un prix pour fuir).
 *
 * Application morale : pas de delta moral spécifique (la rupture est volontaire,
 * pas un échec). Le moral peut continuer à descendre via les pertes effective
 * via la formule cohésion classique.
 *
 * Le caller (EF handleBreakCombat vague B) est responsable de :
 *  - vérifier que l'unité est bien dans au moins un engagement
 *  - supprimer tous les engagements de cette unité (rupture totale)
 *  - consommer hasMoved + hasAttacked pour le tour
 *
 * Retourne un UnitState modifié + détail des pertes pour log UI.
 */
export function breakCombat(unit: UnitState): BreakCombatResult {
  const rawLoss = Math.round(unit.effective * BREAK_COMBAT_COST_RATIO)
  // Plancher à 1 pour ne jamais avoir une rupture gratuite (sauf si effective déjà 0).
  const minLoss = unit.effective > 0 ? Math.max(1, rawLoss) : 0
  // Plafond pour ne pas descendre sous effectiveMin (le pion ne disparaît pas en rompant).
  const maxLoss = Math.max(0, unit.effective - unit.effectiveMin)
  const finalLoss = Math.min(minLoss, maxLoss)

  const split = splitCasualties(finalLoss, unit.effective)
  const effectiveAfter = unit.effective - split.actualDamage
  const woundedAfter = unit.wounded + split.woundedAdd

  // Mapping legacy hp pour rétrocompat consommateurs (cf. contact.ts).
  const ratioAfter = unit.effectiveMax > 0 ? effectiveAfter / unit.effectiveMax : 0
  const hpAfter = Math.max(0, Math.round(ratioAfter * unit.hpMax))

  return {
    unitAfter: {
      ...unit,
      effective: effectiveAfter,
      wounded: woundedAfter,
      hp: hpAfter,
      killed: unit.killed + split.killed,
      hasMoved: true,
      hasAttacked: true,
    },
    actualDamage: split.actualDamage,
    killed: split.killed,
    woundedAdd: split.woundedAdd,
  }
}

/**
 * Récupère tous les engagements dans lesquels une unité est impliquée.
 *
 * Multi-engagement supporté : une unité au milieu de 3 ennemis peut être dans
 * 3 engagements simultanément (cf. plan § 6, encerclement). À chaque tick, le
 * caller appelle `resolveEngagementTick` N fois, une par paire.
 *
 * O(n) sur la liste d'engagements. Caller responsable de batch s'il a besoin
 * d'un index par unité.
 */
export function isEngagedWith(
  unitId: UnitId,
  engagements: ReadonlyArray<EngagementState>,
): ReadonlyArray<EngagementState> {
  return engagements.filter(e => e.unitAId === unitId || e.unitBId === unitId)
}

/**
 * Retourne l'id de l'unité ennemie dans un engagement, selon le côté demandé.
 * Helper UI pour afficher "Engagé avec : Infanterie Rouges" dans UnitInspector.
 */
export function getEngagementOpponent(
  engagement: EngagementState,
  selfId: UnitId,
): UnitId | null {
  if (engagement.unitAId === selfId) return engagement.unitBId
  if (engagement.unitBId === selfId) return engagement.unitAId
  return null
}
