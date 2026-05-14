// v1.1 (14/05/2026) — Phase 3.3-bis : ajout 'camp' (action passive regen) + 'always' (trigger)
// v1.0 (13/05/2026) — Phase 3.2 Vague A : types ordres conditionnels (pré-postures)
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.

import type { Cube } from '../hex'
import type { UnitId, UnitState } from '../units/types'

/**
 * Kind d'un déclencheur (trigger) d'ordre conditionnel.
 *  - `on_attacked`     : unité actuellement engagée en mêlée (au moins 1 engagement actif).
 *  - `enemy_in_range`  : au moins 1 ennemi visible à distance ≤ `params.range` hex.
 *  - `cohesion_broken` : la cohésion de l'unité est `broken`.
 *  - `enemy_los`       : au moins 1 ennemi à portée de vision ET LoS dégagée.
 *  - `always`          : Phase 3.3-bis — toujours vrai. Utilisé comme fallback passif
 *                        (ex: priority=2 `always → camp` quand priority=1 ne fire pas).
 */
export type OrderTriggerKind = 'on_attacked' | 'enemy_in_range' | 'cohesion_broken' | 'enemy_los' | 'always'

/**
 * Kind d'action déclenchée. Mappe vers les actions du moteur de combat existant.
 *  - `charge`  : se déplacer au contact de l'ennemi prioritaire + attaque mêlée (Phase 3.3-bis : combat réel).
 *  - `fire`    : tir distance sur l'ennemi prioritaire visible (archer/artillerie).
 *  - `retreat` : se déplacer vers l'hex le plus éloigné de tous les ennemis visibles (ou destHex utilisateur).
 *  - `hold`    : tenir la position. Bonus défensif +15% + terrain ×2.
 *  - `camp`    : Phase 3.3-bis — mode campement. La troupe se relâche : regen morale +5,
 *                soin auto wounded 10%/tour. Pas de bonus défensif (trade-off de hold).
 *                Sortie automatique via priorités : on_attacked → retreat reprend la main.
 */
export type OrderActionKind = 'charge' | 'fire' | 'retreat' | 'hold' | 'camp'

/** Trigger avec paramètres optionnels. Range applicable pour `enemy_in_range`. */
export interface OrderTrigger {
  readonly kind: OrderTriggerKind
  readonly params?: { readonly range?: number }
}

/** Action avec paramètres optionnels (réservé Phase 3.3). */
export interface OrderAction {
  readonly kind: OrderActionKind
  readonly params?: Readonly<Record<string, unknown>>
}

/**
 * État persistant d'une posture pour une unité.
 * Source de vérité : table `unit_orders` (migration 019 Vague B).
 *
 * Invariants :
 *  - 1 ≤ priority ≤ 3 (unicité (unitId, priority) imposée par BDD)
 *  - active = true → posture évaluée chaque tour
 */
export interface Posture {
  readonly id: string
  readonly unitId: UnitId
  readonly priority: number
  readonly trigger: OrderTrigger
  readonly action: OrderAction
  readonly active: boolean
}

/**
 * Raison pour laquelle une posture déclenchée n'a pas pu être exécutée.
 *  - `broken`        : unité Brisée + action offensive (charge/fire) → bloqué (cohérent piège #28).
 *  - `has_moved`     : action nécessite mouvement mais l'unité a déjà bougé ce tour.
 *  - `has_attacked`  : action nécessite attaque mais l'unité a déjà attaqué ce tour.
 *  - `no_target`     : aucune cible/destination valide trouvée.
 *  - `routed`        : unité en déroute (ne peut plus exécuter d'ordre).
 */
export type OrderSkipReason = 'broken' | 'has_moved' | 'has_attacked' | 'no_target' | 'routed'

/**
 * Résultat de l'évaluation d'une posture. Si une posture déclenche,
 * `evaluateOrders` retourne l'évaluation correspondante (avec ou sans skip).
 *
 * Si `skipped` est défini, la posture s'est déclenchée mais l'action n'est pas
 * exécutable maintenant (cf. raisons OrderSkipReason). Le caller (EF) peut
 * passer à la posture suivante en priorité.
 */
export interface OrderEvaluation {
  readonly posture: Posture
  /** Action concrète à appliquer (= posture.action.kind). */
  readonly resolvedAction: OrderActionKind
  /** Cible désignée pour charge/fire (null pour retreat/hold). */
  readonly targetUnitId?: UnitId | null
  /** Destination hex pour charge/retreat (null pour fire/hold). */
  readonly destHex?: Cube | null
  /** Raison de skip si l'action ne peut être appliquée maintenant. */
  readonly skipped?: OrderSkipReason
}

/**
 * Contexte d'évaluation. Le caller (EF resolve_turn) capture un snapshot au début
 * du tour entrant et le passe ici. Pur, pas de mutation.
 */
export interface EvaluateOrdersContext {
  /** Toutes les unités de la partie (snapshot début tour). */
  readonly allUnits: ReadonlyArray<UnitState>
  /** Set des unitId actuellement engagées (au moins 1 engagement actif). */
  readonly engagedUnitIds: ReadonlySet<UnitId>
  /** Map<unitId, niveau visibilité> côté observateur (team de l'unité). */
  readonly visibleEnemyIds: ReadonlySet<UnitId>
  /** Set des cubeKey hex visibles par l'équipe de l'unité. */
  readonly visibleTileKeys: ReadonlySet<string>
  /** Map<unitId, cohesion state> (calculé par `computeCohesion` côté caller). */
  readonly cohesionByUnit: ReadonlyMap<UnitId, 'nominal' | 'shaken' | 'broken'>
}

/** Phase 3.2 — Limite stricte d'ordres par unité (cf. plan, justifié IA Phase 4). */
export const MAX_ORDERS_PER_UNIT = 3
