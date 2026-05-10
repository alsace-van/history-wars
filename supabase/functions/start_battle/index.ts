// v2.0 (10/05/2026) — Phase 2 2B.5 : seed effective + terrain_tiles plaine_standard sur tout le board
// v1.0 (09/05/2026) — Phase 1 L1B.2 : EF start_battle
// Logique : host valide → spawn 6 units (effective Phase 2) + seed terrain → games.status='in_progress' + state.tactical.

import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { extractUserFromJWT } from '../_shared/auth.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { ERROR_CODES, type GameStateV1 } from '../_shared/types.ts'
import {
  isSupportedScenario,
  getScenarioPlacement,
  DEFAULT_BOARD_RADIUS,
} from '../_shared/scenarios.ts'
import { UNIT_STATS_BY_KIND } from '../_shared/engine-port/units.ts'
import type { UnitKind } from '../_shared/types.ts'

interface StartBattleBody {
  game_id?: string
}

// Phase 2 : mapping effectif elastique par UnitKind (mirror UNIT_STATS_V2 src/engine/units/stats.ts).
// Source de verite : src/engine/units/stats.ts. Toute modif → 2 fichiers a maintenir (piege #12).
const EFFECTIVE_BY_KIND: Record<UnitKind, { max: number; min: number }> = {
  I: { max: 800, min: 100 },
  C: { max: 180, min:  25 },
  A: { max: 120, min:  30 },
}

/**
 * Genere tous les hex d'un board de rayon `radius` (cube coords).
 * Convention identique a engine/hex/neighbors.ts spiral().
 */
function generateBoardHexes(radius: number): Array<{ q: number; r: number }> {
  const cells: Array<{ q: number; r: number }> = []
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r
      if (Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(s) <= radius) {
        cells.push({ q, r })
      }
    }
  }
  return cells
}

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
    const body = (await req.json().catch(() => null)) as StartBattleBody | null
    if (!body || typeof body.game_id !== 'string') {
      return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'game_id required (string)', 400)
    }
    const gameId = body.game_id

    const admin = getAdminClient()

    // 3. Charger game + verifier host + status lobby
    const { data: game, error: gameErr } = await admin
      .from('games')
      .select('id, status, scenario_id, created_by')
      .eq('id', gameId)
      .single()

    if (gameErr || !game) {
      return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'game not found', 404)
    }
    if (game.created_by !== user.userId) {
      return errorResponse(ERROR_CODES.NOT_HOST, 'only host can start battle', 403)
    }
    if (game.status !== 'lobby') {
      return errorResponse(ERROR_CODES.NOT_LOBBY, `status is ${game.status}`, 400)
    }
    if (!isSupportedScenario(game.scenario_id)) {
      return errorResponse(ERROR_CODES.INVALID_SCENARIO, `scenario ${game.scenario_id} not supported`, 400)
    }

    // 4. Players : au moins 2, au moins 1 par equipe
    const { data: players, error: playersErr } = await admin
      .from('game_players')
      .select('id, user_id, team')
      .eq('game_id', gameId)

    if (playersErr) {
      return errorResponse(ERROR_CODES.INTERNAL, 'players fetch failed', 500)
    }
    const occupiedSlots = (players ?? []).filter(p => p.user_id !== null)
    if (occupiedSlots.length < 2) {
      return errorResponse(ERROR_CODES.NOT_ENOUGH_PLAYERS, 'need at least 2 players', 400)
    }
    const blueCount = occupiedSlots.filter(p => p.team === 'blue').length
    const redCount = occupiedSlots.filter(p => p.team === 'red').length
    if (blueCount === 0 || redCount === 0) {
      return errorResponse(ERROR_CODES.NOT_ENOUGH_PLAYERS, 'each team needs at least 1 player', 400)
    }

    // 5. Placement deterministe + champs Phase 2 (effective elastique)
    const placements = getScenarioPlacement(game.scenario_id)
    const unitsToInsert = placements.map(p => {
      const stats = UNIT_STATS_BY_KIND[p.kind]
      const eff = EFFECTIVE_BY_KIND[p.kind]
      return {
        game_id: gameId,
        team: p.team,
        kind: p.kind,
        q: p.q,
        r: p.r,
        hp: stats.hpMax,
        hp_max: stats.hpMax,
        morale: stats.moraleMax,
        morale_max: stats.moraleMax,
        // Phase 2 : effectif elastique
        effective: eff.max,
        effective_max: eff.max,
        effective_min: eff.min,
        killed: 0,
        // sub_kind / regiment_id / formation : null par defaut (placeholders Phase 5/6)
      }
    })

    // 6a. Insert units
    const { error: insertErr } = await admin.from('units').insert(unitsToInsert)
    if (insertErr) {
      return errorResponse(ERROR_CODES.INTERNAL, `units insert failed: ${insertErr.message}`, 500)
    }

    // 6a-bis. Phase 2 : seed terrain_tiles (defaut plaine_standard pour tout le board)
    // MVP Phase 2 : terrain monotone. Diversification via scenario JSONB Phase 7.
    const boardHexes = generateBoardHexes(DEFAULT_BOARD_RADIUS)
    const terrainToInsert = boardHexes.map(h => ({
      game_id: gameId,
      q: h.q,
      r: h.r,
      type: 'plaine_standard' as const,
    }))
    const { error: terrainErr } = await admin.from('terrain_tiles').insert(terrainToInsert)
    if (terrainErr) {
      // rollback units si terrain echoue
      await admin.from('units').delete().eq('game_id', gameId)
      return errorResponse(ERROR_CODES.INTERNAL, `terrain insert failed: ${terrainErr.message}`, 500)
    }

    // 6b. Update games.status + state
    const newState: GameStateV1 = {
      version: 1,
      tactical: {
        phase: 'orders',
        boardRadius: DEFAULT_BOARD_RADIUS,
        currentTurn: 1,
        activeTeam: 'blue',
        scenarioId: game.scenario_id,
      },
    }
    const { error: updateErr } = await admin
      .from('games')
      .update({
        status: 'in_progress',
        state: newState,
        turn_number: 1,
        last_action_at: new Date().toISOString(),
      })
      .eq('id', gameId)

    if (updateErr) {
      // rollback units + terrain
      await admin.from('units').delete().eq('game_id', gameId)
      await admin.from('terrain_tiles').delete().eq('game_id', gameId)
      return errorResponse(ERROR_CODES.INTERNAL, `game update failed: ${updateErr.message}`, 500)
    }

    // 6c. Insert game_actions log
    const { error: actionErr } = await admin.from('game_actions').insert({
      game_id: gameId,
      turn: 0,
      actor_user_id: user.userId,
      action_type: 'start_battle',
      payload: { scenarioId: game.scenario_id },
      result: {
        units_count: unitsToInsert.length,
        board_radius: DEFAULT_BOARD_RADIUS,
        terrain_count: terrainToInsert.length,
      },
      seed: Date.now(),
    })
    if (actionErr) {
      console.warn('[start_battle v2.0] game_actions log failed:', actionErr.message)
      // non-bloquant : la partie est lancee, le log est best-effort
    }

    return jsonResponse({
      ok: true,
      units_count: unitsToInsert.length,
      terrain_count: terrainToInsert.length,
      state: newState,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error('[start_battle v2.0] uncaught:', message)
    return errorResponse(ERROR_CODES.INTERNAL, message, 500)
  }
})
