// v1.2 (14/05/2026) — Phase 3.3-bis : enum +'camp' (action) +'always' (trigger)
// v1.1 (14/05/2026) — Phase 3.3 Lot C : validation action.params.destHex pour retreat dirigé
// v1.0 (13/05/2026) — Phase 3.2 Vague B2 : CRUD batch des ordres conditionnels par unité
// Source : plan on-demarre-la-phase-silly-reddy.md Vague B2.
//
// Sécurité :
//  - JWT obligatoire (auth.uid()).
//  - Vérifie que user est dans game_players de la partie.
//  - Vérifie que unit appartient à un joueur du team du user (sinon UNIT_NOT_OWNED).
//  - Validation structurelle stricte (trigger.kind ∈ enum, action.kind ∈ enum, priority ∈ [1..3]).
//  - Après application des ops, vérifie ≤ 3 ordres pour cette unité et unicité priority.
//  - RLS owner-only sur unit_orders supplément (les UPDATE/DELETE supabase-js admin bypassent
//    RLS, mais on filtre explicitement par owner_user_id dans nos requêtes — defense en profondeur).

import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { extractUserFromJWT } from '../_shared/auth.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import {
  ERROR_CODES,
  type OrderActionDTO,
  type OrderTriggerDTO,
  type SubmitOrdersBody,
  type UnitOrderRow,
} from '../_shared/types.ts'

const TAG = '[submit_orders v1.1]'
const BOARD_RADIUS = 7  // garde-fou bornes destHex (rayon plateau MVP)

const TRIGGER_KINDS = new Set(['on_attacked', 'enemy_in_range', 'cohesion_broken', 'enemy_los', 'always'])
const ACTION_KINDS = new Set(['charge', 'fire', 'retreat', 'hold', 'camp'])
const MAX_ORDERS = 3

function validateTrigger(t: unknown): t is OrderTriggerDTO {
  if (!t || typeof t !== 'object') return false
  const tr = t as Record<string, unknown>
  if (typeof tr.kind !== 'string' || !TRIGGER_KINDS.has(tr.kind)) return false
  if (tr.params !== undefined) {
    if (!tr.params || typeof tr.params !== 'object') return false
    const p = tr.params as Record<string, unknown>
    if (p.range !== undefined && (typeof p.range !== 'number' || p.range < 1 || p.range > 10)) return false
  }
  return true
}

function validateAction(a: unknown): a is OrderActionDTO {
  if (!a || typeof a !== 'object') return false
  const ac = a as Record<string, unknown>
  if (typeof ac.kind !== 'string' || !ACTION_KINDS.has(ac.kind)) return false
  // Phase 3.3 Lot C — retreat directionnel : valider action.params.destHex si fourni.
  if (ac.params !== undefined && ac.params !== null) {
    if (typeof ac.params !== 'object') return false
    const p = ac.params as Record<string, unknown>
    if (p.destHex !== undefined && p.destHex !== null) {
      if (typeof p.destHex !== 'object') return false
      const h = p.destHex as Record<string, unknown>
      if (typeof h.q !== 'number' || typeof h.r !== 'number' || typeof h.s !== 'number') return false
      if (!Number.isInteger(h.q) || !Number.isInteger(h.r) || !Number.isInteger(h.s)) return false
      if (h.q + h.r + h.s !== 0) return false
      if (Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.s)) > BOARD_RADIUS) return false
      // destHex toléré uniquement pour kind='retreat' (sinon ignoré côté engine de toute façon).
      if (ac.kind !== 'retreat') return false
    }
  }
  return true
}

function validatePriority(p: unknown): p is number {
  return typeof p === 'number' && Number.isInteger(p) && p >= 1 && p <= MAX_ORDERS
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'POST only', 405)

  try {
    // 1. Auth
    const user = await extractUserFromJWT(req)
    if (!user) return errorResponse(ERROR_CODES.UNAUTHENTICATED, 'JWT invalid or missing', 401)

    // 2. Body
    const body = (await req.json().catch(() => null)) as SubmitOrdersBody | null
    if (!body || typeof body.game_id !== 'string' || typeof body.unit_id !== 'string' || !Array.isArray(body.operations)) {
      return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { game_id, unit_id, operations[] }', 400)
    }
    if (body.operations.length === 0) {
      return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'operations[] cannot be empty', 400)
    }
    if (body.operations.length > 10) {
      return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'operations[] max 10 per request', 400)
    }

    const admin = getAdminClient()

    // 3. Vérifier que user est dans la partie
    const { data: player, error: playerErr } = await admin
      .from('game_players')
      .select('user_id, team')
      .eq('game_id', body.game_id)
      .eq('user_id', user.userId)
      .maybeSingle()
    if (playerErr) {
      console.error(TAG, 'game_players lookup failed', playerErr)
      return errorResponse(ERROR_CODES.INTERNAL, 'game_players lookup failed', 500)
    }
    if (!player) return errorResponse(ERROR_CODES.NOT_IN_GAME, 'user not in this game', 403)

    // 4. Vérifier que l'unité appartient au team du user
    const { data: unit, error: unitErr } = await admin
      .from('units')
      .select('id, game_id, team')
      .eq('id', body.unit_id)
      .eq('game_id', body.game_id)
      .maybeSingle()
    if (unitErr) {
      console.error(TAG, 'units lookup failed', unitErr)
      return errorResponse(ERROR_CODES.INTERNAL, 'units lookup failed', 500)
    }
    if (!unit) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, 'unit not found in this game', 404)
    if (unit.team !== player.team) {
      return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'unit belongs to opposing team', 403)
    }

    // 5. Charger ordres existants pour calcul cible
    const { data: existing, error: existingErr } = await admin
      .from('unit_orders')
      .select('*')
      .eq('unit_id', body.unit_id)
      .order('priority', { ascending: true })
    if (existingErr) {
      console.error(TAG, 'unit_orders lookup failed', existingErr)
      return errorResponse(ERROR_CODES.INTERNAL, 'unit_orders lookup failed', 500)
    }
    const existingRows = (existing ?? []) as UnitOrderRow[]
    // Map id → row pour update/delete + tracking des suppressions.
    const byId = new Map<string, UnitOrderRow>()
    for (const r of existingRows) byId.set(r.id, r)

    // 6. Valider toutes les opérations en amont avant de toucher la BDD (transaction-safe).
    interface PendingState {
      id: string
      priority: number
      trigger: OrderTriggerDTO
      action: OrderActionDTO
      active: boolean
      isNew: boolean
      isDeleted: boolean
      original?: UnitOrderRow
    }
    const pending = new Map<string, PendingState>()
    for (const r of existingRows) {
      pending.set(r.id, {
        id: r.id, priority: r.priority, trigger: r.trigger, action: r.action, active: r.active,
        isNew: false, isDeleted: false, original: r,
      })
    }
    let newIdCounter = 0
    for (const op of body.operations) {
      if (op.op === 'create') {
        if (!validatePriority(op.priority)) return errorResponse(ERROR_CODES.INVALID_PRIORITY, 'priority must be 1..3', 400)
        if (!validateTrigger(op.trigger)) return errorResponse(ERROR_CODES.INVALID_TRIGGER, 'invalid trigger', 400)
        if (!validateAction(op.action)) return errorResponse(ERROR_CODES.INVALID_ACTION, 'invalid action', 400)
        const tmpId = `__new_${newIdCounter++}`
        pending.set(tmpId, {
          id: tmpId, priority: op.priority, trigger: op.trigger, action: op.action,
          active: op.active ?? true, isNew: true, isDeleted: false,
        })
      } else if (op.op === 'update') {
        const cur = pending.get(op.order_id)
        if (!cur || cur.isDeleted) return errorResponse(ERROR_CODES.ORDER_NOT_FOUND, 'order to update not found', 404)
        if (op.priority !== undefined) {
          if (!validatePriority(op.priority)) return errorResponse(ERROR_CODES.INVALID_PRIORITY, 'priority must be 1..3', 400)
          cur.priority = op.priority
        }
        if (op.trigger !== undefined) {
          if (!validateTrigger(op.trigger)) return errorResponse(ERROR_CODES.INVALID_TRIGGER, 'invalid trigger', 400)
          cur.trigger = op.trigger
        }
        if (op.action !== undefined) {
          if (!validateAction(op.action)) return errorResponse(ERROR_CODES.INVALID_ACTION, 'invalid action', 400)
          cur.action = op.action
        }
        if (op.active !== undefined) cur.active = op.active
      } else if (op.op === 'delete') {
        const cur = pending.get(op.order_id)
        if (!cur || cur.isDeleted) return errorResponse(ERROR_CODES.ORDER_NOT_FOUND, 'order to delete not found', 404)
        cur.isDeleted = true
      } else {
        return errorResponse(ERROR_CODES.INVALID_PAYLOAD, `unknown op: ${(op as { op: string }).op}`, 400)
      }
    }

    // 7. Validation post-application : limite + unicité priority.
    const alive: PendingState[] = []
    for (const p of pending.values()) {
      if (!p.isDeleted) alive.push(p)
    }
    if (alive.length > MAX_ORDERS) {
      return errorResponse(ERROR_CODES.ORDERS_LIMIT_EXCEEDED, `max ${MAX_ORDERS} orders per unit (got ${alive.length})`, 400)
    }
    const prioritiesSeen = new Set<number>()
    for (const p of alive) {
      if (prioritiesSeen.has(p.priority)) {
        return errorResponse(ERROR_CODES.PRIORITY_CONFLICT, `priority ${p.priority} used twice`, 400)
      }
      prioritiesSeen.add(p.priority)
    }

    // 8. Application BDD : DELETE puis UPDATE puis INSERT (ordre safe vs unique(unit_id, priority)).
    //    Pour éviter conflits temporaires de priority lors d'un swap (ex : 1↔2), on fait :
    //    a. DELETE rows supprimés
    //    b. UPDATE rows existants : on shift d'abord toutes les priorities à >100 puis on remet les bonnes
    //    c. INSERT nouvelles rows
    const toDelete = [...pending.values()].filter(p => p.isDeleted && p.original).map(p => p.id)
    const toUpdate = [...pending.values()].filter(p => !p.isDeleted && !p.isNew && p.original)
    const toInsert = [...pending.values()].filter(p => !p.isDeleted && p.isNew)

    if (toDelete.length > 0) {
      const { error } = await admin
        .from('unit_orders')
        .delete()
        .in('id', toDelete)
        .eq('owner_user_id', user.userId)
      if (error) {
        console.error(TAG, 'delete failed', error)
        return errorResponse(ERROR_CODES.INTERNAL, 'delete failed', 500)
      }
    }

    if (toUpdate.length > 0) {
      // Step 1 : pousser temporairement les priorities à +100 pour éviter collision unique.
      for (const p of toUpdate) {
        const { error } = await admin
          .from('unit_orders')
          .update({ priority: 100 + p.priority })
          .eq('id', p.id)
          .eq('owner_user_id', user.userId)
        if (error) {
          console.error(TAG, 'temp shift failed', error)
          return errorResponse(ERROR_CODES.INTERNAL, 'temp shift failed', 500)
        }
      }
      // Step 2 : appliquer toutes les valeurs finales.
      for (const p of toUpdate) {
        const { error } = await admin
          .from('unit_orders')
          .update({
            priority: p.priority,
            trigger: p.trigger,
            action: p.action,
            active: p.active,
          })
          .eq('id', p.id)
          .eq('owner_user_id', user.userId)
        if (error) {
          console.error(TAG, 'update failed', error)
          return errorResponse(ERROR_CODES.INTERNAL, 'update failed', 500)
        }
      }
    }

    if (toInsert.length > 0) {
      const { error } = await admin
        .from('unit_orders')
        .insert(toInsert.map(p => ({
          game_id: body.game_id,
          unit_id: body.unit_id,
          owner_user_id: user.userId,
          priority: p.priority,
          trigger: p.trigger,
          action: p.action,
          active: p.active,
        })))
      if (error) {
        console.error(TAG, 'insert failed', error)
        return errorResponse(ERROR_CODES.INTERNAL, 'insert failed', 500)
      }
    }

    // 9. Refetch liste finale pour réponse cohérente.
    const { data: final, error: finalErr } = await admin
      .from('unit_orders')
      .select('*')
      .eq('unit_id', body.unit_id)
      .eq('owner_user_id', user.userId)
      .order('priority', { ascending: true })
    if (finalErr) {
      console.error(TAG, 'refetch failed', finalErr)
      return errorResponse(ERROR_CODES.INTERNAL, 'refetch failed', 500)
    }

    return jsonResponse({ ok: true, orders: (final ?? []) as UnitOrderRow[] })
  } catch (e) {
    console.error(TAG, 'unexpected', e)
    return errorResponse(ERROR_CODES.INTERNAL, 'unexpected', 500)
  }
})
