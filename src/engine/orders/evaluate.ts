// v1.0 (13/05/2026) — Phase 3.2 Vague A : moteur d'évaluation des ordres conditionnels
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.
//
// Contrat snapshot-then-resolve :
//   1. Le caller (EF resolve_turn) capture les unités en début de tour entrant.
//   2. Pour chaque unité de toTeam, `evaluateOrders` est appelé une fois.
//   3. Les postures de chaque unité sont évaluées par priorité ASC (1 → 2 → 3).
//   4. Première posture dont le trigger se déclenche → tentative d'exécution.
//   5. Si l'action est skippable (broken/has_moved/has_attacked/no_target), on
//      tente la posture suivante (cohérent : "tiens position SAUF SI X possible").
//   6. Aucune cascade de re-déclenchement (les mutations s'appliquent après).
//
// Filtres globaux :
//  - unité `routed` : aucun ordre évalué (retourne null d'office).
//  - unité `cohesion_state = broken` : seules `retreat`/`hold` autorisées (offensifs skipped).

import type { UnitState } from '../units/types'
import { resolveActionTarget } from './actions'
import { evaluateTrigger } from './triggers'
import type {
  EvaluateOrdersContext,
  OrderActionKind,
  OrderEvaluation,
  OrderSkipReason,
  Posture,
} from './types'

const OFFENSIVE_ACTIONS: ReadonlySet<OrderActionKind> = new Set(['charge', 'fire'])

/**
 * Vérifie si l'unité peut exécuter l'action `kind` ce tour, compte tenu des
 * flags et de sa cohésion. Retourne `null` si OK, sinon une raison de skip.
 */
function checkExecutability(
  unit: UnitState,
  kind: OrderActionKind,
  isBroken: boolean,
): OrderSkipReason | null {
  if (unit.routed) return 'routed'
  if (isBroken && OFFENSIVE_ACTIONS.has(kind)) return 'broken'
  // charge → mouvement + attaque ; fire → attaque ; retreat → mouvement ; hold → rien.
  if ((kind === 'charge' || kind === 'retreat') && unit.hasMoved) return 'has_moved'
  if ((kind === 'charge' || kind === 'fire') && unit.hasAttacked) return 'has_attacked'
  return null
}

/**
 * Évalue les postures actives d'une unité dans l'ordre de priorité. Retourne la
 * première posture déclenchée + son résultat (skipped ou résolution).
 *
 *  - Si la posture déclenche et est exécutable → renvoie l'évaluation complète.
 *  - Si la posture déclenche mais skippable → consigne la raison ET continue à
 *    la posture suivante (priorité descendante = liste UI haut-en-bas).
 *  - Si aucune posture ne déclenche → null.
 *
 * Tri : priorité ASC, puis id ASC (déterminisme replay si priorités égales par
 * accident, mais la BDD impose unicité (unit_id, priority) en réalité).
 */
export function evaluateOrders(
  unit: UnitState,
  postures: ReadonlyArray<Posture>,
  ctx: EvaluateOrdersContext,
): OrderEvaluation | null {
  if (unit.routed) return null
  const isBroken = ctx.cohesionByUnit.get(unit.id) === 'broken'

  const sorted = [...postures]
    .filter(p => p.active && p.unitId === unit.id)
    .sort((a, b) => (a.priority - b.priority) || a.id.localeCompare(b.id))

  let firstSkipped: OrderEvaluation | null = null
  for (const posture of sorted) {
    if (!evaluateTrigger(unit, posture.trigger, ctx)) continue

    const executability = checkExecutability(unit, posture.action.kind, isBroken)
    if (executability) {
      const skipEval: OrderEvaluation = {
        posture,
        resolvedAction: posture.action.kind,
        targetUnitId: null,
        destHex: null,
        skipped: executability,
      }
      if (!firstSkipped) firstSkipped = skipEval
      continue
    }

    const target = resolveActionTarget(unit, posture.action.kind, ctx)
    if (!target.targetUnitId && !target.destHex && posture.action.kind !== 'hold') {
      const skipEval: OrderEvaluation = {
        posture,
        resolvedAction: posture.action.kind,
        targetUnitId: null,
        destHex: null,
        skipped: 'no_target',
      }
      if (!firstSkipped) firstSkipped = skipEval
      continue
    }
    return {
      posture,
      resolvedAction: posture.action.kind,
      targetUnitId: target.targetUnitId ?? null,
      destHex: target.destHex ?? null,
    }
  }
  return firstSkipped
}
