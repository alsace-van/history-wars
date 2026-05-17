// v1.0 (11/05/2026) — Phase 2.6 Vague B : helper INSERT engagement après attaque mêlée
// Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 1.2 (création volontaire)
//
// Utilisé par handleAttack v1.2 : appelé après une mêlée réussie où ni attaquant
// ni défenseur n'a été dissout, et l'attaquant n'est pas Brisé (cohésion broken
// déjà bloquée upstream). Idempotent : utilise upsert sur la contrainte UNIQUE
// (game_id, unit_a_id, unit_b_id) de la migration 017 — pas d'erreur si une
// paire engagée se ré-attaque le tour suivant.

import { normalizePair } from '../../_shared/engine-port/engagement/index.ts'
import type { EngagementSnapshot } from '../../_shared/types.ts'

const TAG = '[handleEngage v1.0]'

export interface CreateEngagementArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  attackerId: string
  defenderId: string
  currentTurn: number
  /**
   * Phase 2.6 UX : si true, marque l'engagement comme issu de charge_stay
   * (active malus défense×0.8 + attrition×1.3 côté cavalerie dans tick.ts).
   * Default false = engagement standard issu d'une mêlée non-mortelle.
   */
  fromCharge?: boolean
}

/**
 * INSERT (idempotent) un engagement entre 2 unités après une mêlée.
 *
 * Retourne :
 *  - le snapshot de l'engagement (id BDD, started_turn d'origine si déjà présent)
 *  - `null` en cas d'échec non-fatal (log warning, n'interrompt pas l'attaque)
 *
 * Conventions :
 *  - La paire est normalisée (unit_a_id < unit_b_id stringwise) pour respecter
 *    la contrainte CHECK engagements_pair_order de la migration 017.
 *  - Si une ligne existe déjà (re-attaque le tour suivant), on récupère
 *    l'engagement existant via SELECT — son `started_turn` reste celui d'origine
 *    (badge "Engagé T2" stable).
 */
export async function createEngagementAfterMelee(
  args: CreateEngagementArgs,
): Promise<EngagementSnapshot | null> {
  const { admin, gameId, attackerId, defenderId, currentTurn, fromCharge = false } = args
  const { unitAId, unitBId } = normalizePair(attackerId, defenderId)

  // Tentative INSERT. Si conflit UNIQUE (engagement existant), on récupère.
  const { data, error } = await admin
    .from('engagements')
    .insert({
      game_id: gameId,
      unit_a_id: unitAId,
      unit_b_id: unitBId,
      started_turn: currentTurn,
      from_charge: fromCharge,
    })
    .select('id, game_id, unit_a_id, unit_b_id, started_turn, from_charge')
    .maybeSingle()

  if (!error && data) {
    return data as EngagementSnapshot
  }

  // 23505 = unique_violation Postgres. Engagement déjà créé → fetch existant.
  if (error?.code === '23505') {
    const { data: existing, error: selectErr } = await admin
      .from('engagements')
      .select('id, game_id, unit_a_id, unit_b_id, started_turn')
      .eq('game_id', gameId)
      .eq('unit_a_id', unitAId)
      .eq('unit_b_id', unitBId)
      .maybeSingle()
    if (selectErr || !existing) {
      console.warn(`${TAG} duplicate but fetch failed:`, selectErr?.message)
      return null
    }
    return existing as EngagementSnapshot
  }

  // Toute autre erreur : log + null (ne bloque pas l'attaque mêlée).
  console.warn(`${TAG} insert failed (non-fatal):`, error?.message)
  return null
}
