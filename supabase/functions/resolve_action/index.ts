// v2.1 (11/05/2026) — Phase 2.5 B : dispatcher retreat / surrender / suicide_attack
// v2.0 (10/05/2026) — Phase 2 2C.2 : refacto en handlers (move, attack v2, split, merge) — dispatcher seul
// v1.2a (10/05/2026) — Phase 1.5 fix : SELECT incluait pas wounded → blessés écrasés à chaque round
// v1.2 (10/05/2026) — Phase 1.5 : split casualties killed/woundedAdd, UPDATE units.wounded

import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { extractUserFromJWT } from '../_shared/auth.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import {
  ERROR_CODES,
  type Team,
  type GameStateV1,
  type ResolveActionBody,
  type MovePayload,
  type AttackPayload,
  type SplitPayload,
  type MergePayload,
  type RetreatPayload,
  type SurrenderPayload,
  type SuicidePayload,
} from '../_shared/types.ts'
import { handleMove } from './_handlers/handleMove.ts'
import { handleAttack } from './_handlers/handleAttack.ts'
import { handleSplit } from './_handlers/handleSplit.ts'
import { handleMerge } from './_handlers/handleMerge.ts'
import { handleRetreat } from './_handlers/handleRetreat.ts'
import { handleSurrender } from './_handlers/handleSurrender.ts'
import { handleSuicide } from './_handlers/handleSuicide.ts'
import {
  loadCombatConfig,
  loadTerrainMap,
  UNIT_SELECT_COLUMNS,
  type UnitRow,
} from './_handlers/_common.ts'

const TAG = '[resolve_action v2.1]'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'POST only', 405)
  }

  try {
    // 1. Auth
    const user = await extractUserFromJWT(req)
    if (!user) return errorResponse(ERROR_CODES.UNAUTHENTICATED, 'JWT invalid or missing', 401)

    // 2. Body
    const body = (await req.json().catch(() => null)) as ResolveActionBody | null
    if (!body || typeof body.game_id !== 'string' || !body.action || typeof body.action.type !== 'string') {
      return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { game_id, client_action_id, action: { type, payload } }', 400)
    }
    const gameId = body.game_id
    const clientActionId = typeof body.client_action_id === 'string' ? body.client_action_id : null
    const actionType = body.action.type

    const admin = getAdminClient()

    // 3. Idempotence D12 — avant toute autre validation
    if (clientActionId) {
      const { data: cached } = await admin
        .from('game_actions')
        .select('result, action_type')
        .eq('game_id', gameId)
        .eq('client_action_id', clientActionId)
        .maybeSingle()
      if (cached) {
        return jsonResponse({ ok: true, idempotent: true, result: cached.result })
      }
    }

    // 4. Charger game + check status + state
    const { data: game, error: gameErr } = await admin
      .from('games')
      .select('id, status, state, turn_number')
      .eq('id', gameId)
      .single()

    if (gameErr || !game) {
      return errorResponse(ERROR_CODES.GAME_NOT_FOUND, 'game not found', 404)
    }
    if (game.status !== 'in_progress') {
      return errorResponse(ERROR_CODES.NOT_IN_PROGRESS, `status is ${game.status}`, 400)
    }

    const state = game.state as Partial<GameStateV1> | null
    const tactical = state?.tactical
    if (!tactical) {
      return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'state.tactical missing', 500)
    }
    const phase = tactical.phase ?? 'orders'
    const activeTeam = tactical.activeTeam ?? 'blue'
    const boardRadius = tactical.boardRadius ?? 5

    if (phase !== 'orders') {
      return errorResponse(ERROR_CODES.NOT_ORDERS_PHASE, `phase is ${phase}`, 400)
    }

    // 5. User team
    const { data: playerRow, error: playerErr } = await admin
      .from('game_players')
      .select('team')
      .eq('game_id', gameId)
      .eq('user_id', user.userId)
      .maybeSingle()

    if (playerErr || !playerRow || !playerRow.team) {
      return errorResponse(ERROR_CODES.NOT_IN_GAME, 'user is not a player of this game', 403)
    }
    const userTeam = playerRow.team as Team

    if (activeTeam !== userTeam) {
      return errorResponse(ERROR_CODES.NOT_YOUR_TURN, `active team is ${activeTeam}`, 403)
    }

    // 6. Charger units (SELECT explicite Phase 2)
    const { data: unitsRaw, error: unitsErr } = await admin
      .from('units')
      .select(UNIT_SELECT_COLUMNS)
      .eq('game_id', gameId)

    if (unitsErr || !unitsRaw) {
      return errorResponse(ERROR_CODES.INTERNAL, 'units fetch failed', 500)
    }
    const units = unitsRaw as UnitRow[]

    const currentTurn = tactical.currentTurn ?? 1

    // 7. Dispatcher
    if (actionType === 'move') {
      return await handleMove({
        admin, gameId, userId: user.userId, userTeam, currentTurn, boardRadius,
        units, clientActionId,
        payload: body.action.payload as Partial<MovePayload> | null,
      })
    }

    if (actionType === 'attack_ranged' || actionType === 'attack_melee') {
      // Charger en parallele : terrain + combat config
      const [terrainMap, combatConfig] = await Promise.all([
        loadTerrainMap(admin, gameId),
        loadCombatConfig(admin),
      ])
      return await handleAttack({
        admin, gameId, userId: user.userId, userTeam, currentTurn,
        units, terrainMap, combatConfig, clientActionId,
        kindRequested: actionType === 'attack_melee' ? 'melee' : 'ranged',
        payload: body.action.payload as Partial<AttackPayload> | null,
      })
    }

    if (actionType === 'split_unit') {
      return await handleSplit({
        admin, gameId, userId: user.userId, userTeam, currentTurn, boardRadius,
        units, clientActionId,
        payload: body.action.payload as Partial<SplitPayload> | null,
      })
    }

    if (actionType === 'merge_unit') {
      return await handleMerge({
        admin, gameId, userId: user.userId, userTeam, currentTurn,
        units, clientActionId,
        payload: body.action.payload as Partial<MergePayload> | null,
      })
    }

    // Phase 2.5 — actions critiques unité Brisée (cohésion ≤ 0.2)
    if (actionType === 'retreat') {
      return await handleRetreat({
        admin, gameId, userId: user.userId, userTeam, currentTurn, boardRadius,
        units, clientActionId,
        payload: body.action.payload as Partial<RetreatPayload> | null,
      })
    }

    if (actionType === 'surrender') {
      return await handleSurrender({
        admin, gameId, userId: user.userId, userTeam, currentTurn,
        units, clientActionId,
        payload: body.action.payload as Partial<SurrenderPayload> | null,
      })
    }

    if (actionType === 'suicide_attack') {
      const [terrainMap, combatConfig] = await Promise.all([
        loadTerrainMap(admin, gameId),
        loadCombatConfig(admin),
      ])
      return await handleSuicide({
        admin, gameId, userId: user.userId, userTeam, currentTurn, boardRadius,
        units, terrainMap, combatConfig, clientActionId,
        payload: body.action.payload as Partial<SuicidePayload> | null,
      })
    }

    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, `unknown action type: ${actionType}`, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error(`${TAG} uncaught:`, message)
    return errorResponse(ERROR_CODES.INTERNAL, message, 500)
  }
})
