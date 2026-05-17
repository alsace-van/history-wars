// v8 (17/05/2026) — Phase 4-bis Lot 2 : lookaheadDepth=2 (medium) / 3 (hard), deadline 3.5s
// v7 (14/05/2026) — Phase 4 polish session 23 (5 fixes : bot bouge, tour bascule, engagé attaque, journal, log clair)
// v6 (14/05/2026) — Phase 4 polish session 23 (intermediate)
// v1.0 (14/05/2026) — Phase 4 Lot A3 : EF orchestrator IA solo (1 ply server-side)
//
// Pipeline :
//  1. Auth JWT + body { game_id }
//  2. Charger game state + units + engagements + terrain + combat_config
//  3. Identifier bots du team actif
//  4. Pour chaque unité bot (id ASC) : pickBestActionForUnit → applyBotAction
//  5. Retourner résumé { actions_applied, bot_actions }
//
// Le client est responsable de :
//  - appeler resolve_turn après ce retour (bascule activeTeam, récup moral, tick)
//  - afficher les toasts depuis les game_actions inserted par cette EF (Realtime)

import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { extractUserFromJWT } from '../_shared/auth.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import {
  ERROR_CODES,
  type AttackResultV2,
  type CombatResultSnapshotV2,
  type Team,
} from '../_shared/types.ts'
import { cube, cubeDistance, cubeKey, cubeLineDraw, spiral } from '../_shared/engine-port/hex/index.ts'
import { resolveCombat } from '../_shared/engine-port/combat/v2/index.ts'
import { seededRng } from '../_shared/engine-port/combat/index.ts'
import { computeSupport } from '../_shared/engine-port/cohesion/index.ts'
import {
  visibleEnemiesFromTeam,
  visibleHexesFromTeam,
} from '../_shared/engine-port/vision/index.ts'
import { pickBestActionForUnit, type AIAction, type AIContext, type AIProfile } from '../_shared/engine-port/ai/index.ts'
import {
  buildAllUnitStates,
  terrainAt,
  type UnitRow,
} from '../resolve_action/_handlers/_common.ts'
import type { CombatConfig } from '../_shared/engine-port/combat/v2/types.ts'
import type { TerrainType } from '../_shared/engine-port/terrain/index.ts'
import { DEFAULT_COMBAT_CONFIG } from '../_shared/engine-port/combat/v2/index.ts'
import { DEFAULT_TERRAIN } from '../_shared/engine-port/terrain/index.ts'
import type { UnitState } from '../_shared/engine-port/units.ts'

const TAG = '[run_bot_turn v8]'

// Phase 4-bis Lot 2 : deadline absolue pour le lookahead minimax côté EF.
// 3500 ms laisse 1.5 s pour les writes DB + retour client sous timeout EF 6 s par défaut.
const LOOKAHEAD_DEADLINE_MS = 3500

interface RunBotTurnBody {
  game_id: string
}

interface BotActionSummary {
  unit_id: string
  action_kind: AIAction['kind']
  target_id?: string
  dest_q?: number
  dest_r?: number
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse(ERROR_CODES.METHOD_NOT_ALLOWED, 'POST only', 405)

  try {
    // 1. Auth + body
    const user = await extractUserFromJWT(req)
    if (!user) return errorResponse(ERROR_CODES.UNAUTHENTICATED, 'JWT invalid or missing', 401)
    const body = (await req.json().catch(() => null)) as RunBotTurnBody | null
    if (!body || typeof body.game_id !== 'string') {
      return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { game_id }', 400)
    }
    const gameId = body.game_id
    const admin = getAdminClient()

    // 2. Game + active team
    const { data: game, error: gameErr } = await admin
      .from('games')
      .select('id, status, turn_number, state, scenario_id')
      .eq('id', gameId)
      .maybeSingle()
    if (gameErr || !game) return errorResponse(ERROR_CODES.GAME_NOT_FOUND, 'game not found', 404)
    if (game.status !== 'in_progress') return errorResponse(ERROR_CODES.NOT_IN_PROGRESS, 'game not in progress', 409)
    // Phase 4 — clé camelCase `activeTeam` (cf. resolve_turn/index.ts l538 + client Game.tsx l183).
    const activeTeam: Team = (game.state as { tactical?: { activeTeam?: Team } })?.tactical?.activeTeam ?? 'blue'
    const turnBefore = game.turn_number ?? 1

    // 3. Vérifier que user appartient à la partie
    const { data: caller } = await admin
      .from('game_players')
      .select('user_id')
      .eq('game_id', gameId)
      .eq('user_id', user.userId)
      .maybeSingle()
    if (!caller) return errorResponse(ERROR_CODES.NOT_IN_GAME, 'user not in game', 403)

    // 4. Identifier bots du team actif
    const { data: botPlayers } = await admin
      .from('game_players')
      .select('id, team, is_bot, bot_difficulty')
      .eq('game_id', gameId)
      .eq('team', activeTeam)
      .eq('is_bot', true)
    const bots = (botPlayers ?? []) as Array<{ id: string; team: Team; is_bot: boolean; bot_difficulty: AIProfile }>
    if (bots.length === 0) {
      return errorResponse(ERROR_CODES.NO_BOT_ON_ACTIVE_TEAM, `no bot on active team ${activeTeam}`, 400)
    }
    const profile: AIProfile = bots[0].bot_difficulty ?? 'medium'

    // 5. Charger units + engagements + terrain + combat_config
    const { data: unitsRaw } = await admin
      .from('units')
      .select('*')
      .eq('game_id', gameId)
    const units = (unitsRaw ?? []) as UnitRow[]

    const [terrainResp, configResp, engResp] = await Promise.all([
      admin.from('terrain_tiles').select('q, r, type').eq('game_id', gameId),
      admin.from('combat_config').select('config').eq('scale', 'tactical').order('version', { ascending: false }).limit(1).maybeSingle(),
      admin.from('engagements').select('unit_a_id, unit_b_id').eq('game_id', gameId),
    ])
    const terrainMap = new Map<string, TerrainType>()
    for (const row of (terrainResp.data ?? []) as Array<{ q: number; r: number; type: string }>) {
      terrainMap.set(cubeKey(cube(row.q, row.r)), row.type as TerrainType)
    }
    const combatConfig: CombatConfig = (configResp.data?.config as CombatConfig | undefined) ?? DEFAULT_COMBAT_CONFIG
    const engagedUnitIds = new Set<string>()
    for (const e of (engResp.data ?? []) as Array<{ unit_a_id: string; unit_b_id: string }>) {
      engagedUnitIds.add(e.unit_a_id)
      engagedUnitIds.add(e.unit_b_id)
    }

    // boardKeys depuis state.tactical.boardRadius (fallback 7 = DEFAULT_BOARD_RADIUS EF start_battle).
    const tacticalState = (game.state as { tactical?: { boardRadius?: number; board_radius?: number } })?.tactical
    const boardRadius = tacticalState?.boardRadius ?? tacticalState?.board_radius ?? 7
    const boardKeys = new Set(spiral(cube(0, 0), boardRadius).map(cubeKey))

    // 6. Snapshot UnitState in-memory (sera muté au fil des actions)
    let allUnits: UnitState[] = buildAllUnitStates(units)

    // Phase 4-bis Lot 2 — Profondeur lookahead par profil :
    //   easy   : 1 ply (random top 3, comportement Phase 4 Lot A)
    //   medium : 2 ply (beam N=3, ~ 1-2 s par action)
    //   hard   : 3 ply (beam N=5, deadline 3.5 s)
    const lookaheadDepth = profile === 'easy' ? 1 : profile === 'medium' ? 2 : 3

    // 7. Construire AIContext (sera reconstruit à chaque action si nécessaire)
    function buildCtx(): AIContext {
      const visibleEnemies = visibleEnemiesFromTeam(activeTeam, allUnits, boardKeys)
      const visibleTiles = visibleHexesFromTeam(activeTeam, allUnits, boardKeys)
      return {
        allUnits,
        visibleEnemyIds: new Set(visibleEnemies.keys()),
        visibleTileKeys: visibleTiles,
        boardKeys,
        terrainMap,
        combatConfig,
        profile,
        rng: seededRng(Date.now()),
        engagedUnitIds,
        lookaheadDepth,
        deadlineMs: Date.now() + LOOKAHEAD_DEADLINE_MS,
      }
    }

    // 8. Itérer sur unités bot (id ASC)
    const botUnits = allUnits.filter(u => u.team === activeTeam).sort((a, b) => a.id.localeCompare(b.id))
    const actionsApplied: BotActionSummary[] = []

    for (const botUnit of botUnits) {
      // Re-fetch unit à jour depuis allUnits (en cas de mutations précédentes)
      const unitNow = allUnits.find(u => u.id === botUnit.id)
      if (!unitNow || unitNow.routed) continue

      const ctx = buildCtx()
      const action = pickBestActionForUnit(unitNow, ctx)
      // DEBUG : log l'action choisie + nombre d'ennemis visibles + 1er hex reachable
      console.log(`[run_bot_turn] unit=${unitNow.id.slice(0, 8)} kind=${unitNow.kind} pos=(${unitNow.position.q},${unitNow.position.r}) visibleEnemies=${ctx.visibleEnemyIds.size} action=${action ? JSON.stringify(action) : 'null'}`)
      if (!action) continue

      const summary = await applyBotAction({
        admin, gameId, unit: unitNow, action, turn: turnBefore,
        allUnits, terrainMap, combatConfig, engagedUnitIds,
      })
      if (summary) {
        actionsApplied.push(summary)
        // Re-charger snapshot après chaque action mutante
        const { data: refresh } = await admin.from('units').select('*').eq('game_id', gameId)
        allUnits = buildAllUnitStates((refresh ?? []) as UnitRow[])
      }
    }

    return jsonResponse({ ok: true, actions_applied: actionsApplied.length, bot_actions: actionsApplied })
  } catch (e) {
    console.error(TAG, 'unexpected', e)
    return errorResponse(ERROR_CODES.INTERNAL, 'unexpected', 500)
  }
})

// ----------------------------------------------------------------------------
// Helper : applique une AIAction (move / attack_melee / attack_ranged / hold).
// ----------------------------------------------------------------------------

interface ApplyParams {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  unit: UnitState
  action: AIAction
  turn: number
  allUnits: ReadonlyArray<UnitState>
  terrainMap: Map<string, TerrainType>
  combatConfig: CombatConfig
  engagedUnitIds: Set<string>
}

async function applyBotAction(p: ApplyParams): Promise<BotActionSummary | null> {
  const { admin, gameId, unit, action, turn } = p
  switch (action.kind) {
    case 'hold': {
      // No-op (le bot tient sa position). On log juste pour traçabilité.
      await admin.from('game_actions').insert({
        game_id: gameId, turn, actor_user_id: null, action_type: 'end_turn',
        payload: { bot_unit_id: unit.id, bot_action: 'hold' },
        result: { hold: true }, seed: Date.now(),
      })
      return { unit_id: unit.id, action_kind: 'hold' }
    }
    case 'move': {
      const path = cubeLineDraw(unit.position, action.dest)
      const { error } = await admin.from('units').update({
        q: action.dest.q,
        r: action.dest.r,
        has_moved: true,
        last_move_path: path.map(c => ({ q: c.q, r: c.r, s: c.s })),
      }).eq('id', unit.id).eq('game_id', gameId)
      if (error) { console.warn('[applyBotAction] move failed:', error.message); return null }
      await admin.from('game_actions').insert({
        game_id: gameId, turn, actor_user_id: null, action_type: 'move',
        payload: { unit_id: unit.id, dest_q: action.dest.q, dest_r: action.dest.r, bot: true },
        result: { from: unit.position, to: action.dest, bot: true },
        seed: Date.now(),
      })
      return { unit_id: unit.id, action_kind: 'move', dest_q: action.dest.q, dest_r: action.dest.r }
    }
    case 'attack_melee':
    case 'attack_ranged': {
      const defender = p.allUnits.find(u => u.id === action.targetId)
      if (!defender) return null
      await applyBotCombat({ ...p, defender })
      return { unit_id: unit.id, action_kind: action.kind, target_id: action.targetId }
    }
  }
}

interface CombatParams extends ApplyParams {
  defender: UnitState
}

async function applyBotCombat(p: CombatParams): Promise<void> {
  const { admin, gameId, unit: attacker, defender, turn, allUnits, terrainMap, combatConfig } = p

  const attackerSupport = computeSupport(attacker, allUnits)
  const defenderSupport = computeSupport(defender, allUnits)
  const attackerTerrain = terrainAt(terrainMap, attacker.position)
  const defenderTerrain = terrainAt(terrainMap, defender.position)
  const distance = cubeDistance(attacker.position, defender.position)
  const seed = Date.now()
  const rng = seededRng(seed)

  const { result: combat, ripost } = resolveCombat({
    attacker, defender,
    attackerTerrain, defenderTerrain,
    distance,
    rng,
    config: combatConfig,
    attackerSupport, defenderSupport,
  })

  // État attaquant post-ripost
  let attackerHpAfter = attacker.hp
  let attackerWoundedAfter = attacker.wounded
  let attackerEffectiveAfter = attacker.effective
  let attackerKilledStat = attacker.killed
  let attackerMoraleAfter = combat.attackerMoraleAfter
  let attackerRoutedAfter = combat.attackerRouted
  let attackerKilled = false
  let defenderMoraleAfter = combat.defenderMoraleAfter
  let defenderRoutedAfter = combat.defenderRouted

  if (ripost) {
    attackerHpAfter = ripost.defenderHpAfter
    attackerWoundedAfter = ripost.defenderWoundedAfter
    attackerEffectiveAfter = ripost.defenderEffectiveAfter
    attackerKilledStat = attacker.killed + ripost.killed
    attackerMoraleAfter = ripost.defenderMoraleAfter
    attackerRoutedAfter = ripost.defenderRouted
    attackerKilled = ripost.defenderKilled
    defenderMoraleAfter = ripost.attackerMoraleAfter
    defenderRoutedAfter = ripost.attackerRouted
  }

  const defenderKilled = combat.defenderKilled
  const defenderKilledStat = defender.killed + combat.killed

  // Update défenseur
  if (defenderKilled) {
    await admin.from('units').delete().eq('id', defender.id).eq('game_id', gameId)
  } else {
    await admin.from('units').update({
      hp: combat.defenderHpAfter,
      wounded: combat.defenderWoundedAfter,
      effective: combat.defenderEffectiveAfter,
      killed: defenderKilledStat,
      morale: defenderMoraleAfter,
      routed: defenderRoutedAfter,
    }).eq('id', defender.id).eq('game_id', gameId)
  }

  // Update attaquant
  if (attackerKilled) {
    await admin.from('units').delete().eq('id', attacker.id).eq('game_id', gameId)
  } else {
    await admin.from('units').update({
      hp: attackerHpAfter,
      wounded: attackerWoundedAfter,
      effective: attackerEffectiveAfter,
      killed: attackerKilledStat,
      morale: attackerMoraleAfter,
      routed: attackerRoutedAfter,
      has_attacked: true,
    }).eq('id', attacker.id).eq('game_id', gameId)
  }

  // INSERT game_actions (action_type selon phase)
  const actionType = combat.attackPhase === 'ranged' ? 'attack_ranged' : 'attack_melee'
  const result: AttackResultV2 = {
    attacker_id: attacker.id,
    defender_id: defender.id,
    kind: combat.attackPhase,
    combat: combat as CombatResultSnapshotV2,
    riposte: (ripost as CombatResultSnapshotV2 | null) ?? null,
    defender_killed: defenderKilled,
    attacker_killed: attackerKilled,
    attacker_after: attackerKilled ? null : {
      hp: attackerHpAfter,
      wounded: attackerWoundedAfter,
      morale: attackerMoraleAfter,
      routed: attackerRoutedAfter,
      has_attacked: true,
      effective: attackerEffectiveAfter,
      killed: attackerKilledStat,
    },
    defender_after: defenderKilled ? null : {
      hp: combat.defenderHpAfter,
      wounded: combat.defenderWoundedAfter,
      morale: defenderMoraleAfter,
      routed: defenderRoutedAfter,
      effective: combat.defenderEffectiveAfter,
      killed: defenderKilledStat,
    },
    seed,
  }
  await admin.from('game_actions').insert({
    game_id: gameId, turn, actor_user_id: null, action_type: actionType,
    payload: { unit_id: attacker.id, target_unit_id: defender.id, bot: true },
    result, seed,
  })

  // Engagement Phase 2.6 si melee non-mortelle bilatérale
  if (combat.attackPhase === 'melee' && !defenderKilled && !attackerKilled) {
    const [a, b] = [attacker.id, defender.id].sort()
    await admin.from('engagements').insert({
      game_id: gameId, unit_a_id: a, unit_b_id: b, started_turn: turn,
    })
  }
}
