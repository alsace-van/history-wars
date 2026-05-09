// v1.1 (09/05/2026) — Phase 1 L1B.4b : handlers attack_ranged + attack_melee + riposte melee
// v1.0 (09/05/2026) — Phase 1 L1B.3 : EF resolve_action dispatcher (cas 'move' uniquement)
//
// Logique :
// 1. CORS / POST only
// 2. Auth JWT
// 3. Body { game_id, client_action_id, action: { type, payload } }
// 4. Idempotence D12 : SELECT cached avant tout
// 5. Charger game + state + players + units
// 6. Valider status='in_progress', phase='orders', activeTeam=user_team
// 7. Switch action.type
//    - 'move' → validation + UPDATE units + INSERT game_actions
//    - 'attack_ranged' / 'attack_melee' → validation + combat + UPDATE/DELETE units + INSERT game_actions

import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { extractUserFromJWT } from '../_shared/auth.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import {
  ERROR_CODES,
  type Team,
  type UnitKind,
  type GameStateV1,
  type ResolveActionBody,
  type MovePayload,
  type MoveResult,
  type AttackPayload,
  type AttackResult,
  type CombatResultSnapshot,
} from '../_shared/types.ts'
import { UNIT_STATS_BY_KIND, type UnitState } from '../_shared/engine-port/units.ts'
import { cube, cubeDistance, cubeKey } from '../_shared/engine-port/hex/index.ts'
import { bfsReachable } from '../_shared/engine-port/movement/index.ts'
import { computeEnemyZoc, type UnitForZoc } from '../_shared/engine-port/zoc/index.ts'
import { resolveMelee, resolveRanged, seededRng } from '../_shared/engine-port/combat/index.ts'
import { hasLineOfSight } from '../_shared/engine-port/los/index.ts'

const TAG = '[resolve_action v1.1]'

interface UnitRow {
  id: string
  game_id: string
  team: Team
  kind: UnitKind
  q: number
  r: number
  hp: number
  hp_max: number
  morale: number
  morale_max: number
  routed: boolean
  has_moved: boolean
  has_attacked: boolean
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

    // 6. Charger unites
    const { data: unitsRaw, error: unitsErr } = await admin
      .from('units')
      .select('id, game_id, team, kind, q, r, hp, hp_max, morale, morale_max, routed, has_moved, has_attacked')
      .eq('game_id', gameId)

    if (unitsErr || !unitsRaw) {
      return errorResponse(ERROR_CODES.INTERNAL, 'units fetch failed', 500)
    }
    const units = unitsRaw as UnitRow[]

    // 7. Dispatcher
    if (actionType === 'move') {
      return await handleMove({
        admin,
        gameId,
        userId: user.userId,
        userTeam,
        currentTurn: tactical.currentTurn ?? 1,
        boardRadius,
        units,
        clientActionId,
        payload: body.action.payload as Partial<MovePayload> | null,
      })
    }

    if (actionType === 'attack_ranged' || actionType === 'attack_melee') {
      return await handleAttack({
        admin,
        gameId,
        userId: user.userId,
        userTeam,
        currentTurn: tactical.currentTurn ?? 1,
        units,
        clientActionId,
        kind: actionType === 'attack_melee' ? 'melee' : 'ranged',
        payload: body.action.payload as Partial<AttackPayload> | null,
      })
    }

    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, `unknown action type: ${actionType}`, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error(`${TAG} uncaught:`, message)
    return errorResponse(ERROR_CODES.INTERNAL, message, 500)
  }
})

// ----------------------------------------------------------------------------
// Helper : UnitRow → UnitState (engine pur)
// ----------------------------------------------------------------------------

function buildUnitState(row: UnitRow): UnitState {
  return {
    id: row.id,
    kind: row.kind,
    team: row.team,
    position: cube(row.q, row.r),
    hp: row.hp,
    hpMax: row.hp_max,
    morale: row.morale,
    moraleMax: row.morale_max,
    hasMoved: row.has_moved,
    hasAttacked: row.has_attacked,
    routed: row.routed,
  }
}

// ----------------------------------------------------------------------------
// Cas 'move' — implementation L1B.3
// ----------------------------------------------------------------------------

interface HandleMoveArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  boardRadius: number
  units: UnitRow[]
  clientActionId: string | null
  payload: Partial<MovePayload> | null
}

async function handleMove(args: HandleMoveArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, boardRadius, units, clientActionId, payload } = args

  // Validation payload
  if (!payload || typeof payload.unit_id !== 'string' || typeof payload.dest_q !== 'number' || typeof payload.dest_r !== 'number') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id, dest_q, dest_r }', 400)
  }
  const unitId = payload.unit_id
  const destQ = payload.dest_q
  const destR = payload.dest_r

  // Unit existe + ownership
  const unit = units.find(u => u.id === unitId)
  if (!unit) {
    return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `unit ${unitId} not found in game`, 404)
  }
  if (unit.team !== userTeam) {
    return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'unit belongs to another team', 403)
  }
  if (unit.routed) {
    return errorResponse(ERROR_CODES.UNIT_ROUTED, 'routed units cannot move', 400)
  }
  if (unit.has_moved) {
    return errorResponse(ERROR_CODES.ALREADY_MOVED, 'unit has already moved this turn', 400)
  }

  // Destination dans le plateau (piege #19)
  const dest = cube(destQ, destR)
  const origin = cube(0, 0)
  if (cubeDistance(dest, origin) > boardRadius) {
    return errorResponse(ERROR_CODES.OUT_OF_BOARD, `destination beyond boardRadius=${boardRadius}`, 400)
  }

  // Mouvement nul rejete (sinon double-click rezero le tour)
  if (unit.q === destQ && unit.r === destR) {
    return errorResponse(ERROR_CODES.INVALID_MOVE, 'destination is current position', 400)
  }

  // BFS reachable
  const stats = UNIT_STATS_BY_KIND[unit.kind]
  const start = cube(unit.q, unit.r)

  // Blockers = positions des AUTRES unites
  const blockers = new Set<string>()
  for (const u of units) {
    if (u.id === unit.id) continue
    blockers.add(cubeKey(cube(u.q, u.r)))
  }

  // ZdC ennemie (piege #17 : entree OK, sortie +infini)
  const unitsForZoc: UnitForZoc[] = units.map(u => ({
    team: u.team,
    position: cube(u.q, u.r),
    routed: u.routed,
  }))
  const enemyZocCubes = computeEnemyZoc(unitsForZoc, userTeam)

  const reachable = bfsReachable({
    start,
    movementPoints: stats.movement,
    blockers,
    enemyZocCubes,
  })

  const destKey = cubeKey(dest)
  const cost = reachable.get(destKey)
  if (cost === undefined) {
    return errorResponse(ERROR_CODES.INVALID_MOVE, `destination ${destKey} not reachable`, 400)
  }

  // UPDATE unit (catch 23505 piege #18 : race UNIQUE position)
  const { error: updateErr } = await admin
    .from('units')
    .update({ q: destQ, r: destR, has_moved: true })
    .eq('id', unitId)
    .eq('game_id', gameId)

  if (updateErr) {
    if (updateErr.code === '23505') {
      return errorResponse(ERROR_CODES.INVALID_MOVE, 'destination occupied (race)', 409)
    }
    console.error(`${TAG} units update failed:`, updateErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `units update failed: ${updateErr.message}`, 500)
  }

  // Snapshot D13
  const result: MoveResult = {
    from: { q: unit.q, r: unit.r },
    to: { q: destQ, r: destR },
    cost,
    snapshot: {
      unit_id: unitId,
      q: destQ,
      r: destR,
      has_moved: true,
    },
  }

  // INSERT game_actions (idempotence via UNIQUE client_action_id, piege #18 race aussi)
  const { error: actionErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: userId,
    action_type: 'move',
    payload: { unit_id: unitId, dest_q: destQ, dest_r: destR },
    result,
    seed: Date.now(),
    client_action_id: clientActionId,
  })

  if (actionErr) {
    if (actionErr.code === '23505' && clientActionId) {
      const { data: cached } = await admin
        .from('game_actions')
        .select('result')
        .eq('game_id', gameId)
        .eq('client_action_id', clientActionId)
        .maybeSingle()
      if (cached) {
        return jsonResponse({ ok: true, idempotent: true, result: cached.result })
      }
    }
    console.warn(`${TAG} game_actions insert failed:`, actionErr.message)
  }

  return jsonResponse({ ok: true, result })
}

// ----------------------------------------------------------------------------
// Cas 'attack_ranged' / 'attack_melee' — implementation L1B.4b
// ----------------------------------------------------------------------------

interface HandleAttackArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  units: UnitRow[]
  clientActionId: string | null
  kind: 'melee' | 'ranged'
  payload: Partial<AttackPayload> | null
}

async function handleAttack(args: HandleAttackArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, units, clientActionId, kind, payload } = args

  // Validation payload
  if (!payload || typeof payload.unit_id !== 'string' || typeof payload.target_unit_id !== 'string') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id, target_unit_id }', 400)
  }
  const attackerId = payload.unit_id
  const defenderId = payload.target_unit_id

  // Auto-attaque (piege #23)
  if (attackerId === defenderId) {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'cannot attack self', 400)
  }

  // Attacker ownership + statut
  const attackerRow = units.find(u => u.id === attackerId)
  if (!attackerRow) {
    return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `attacker ${attackerId} not found`, 404)
  }
  if (attackerRow.team !== userTeam) {
    return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'attacker belongs to another team', 403)
  }
  if (attackerRow.routed) {
    return errorResponse(ERROR_CODES.UNIT_ROUTED, 'routed units cannot attack', 400)
  }
  if (attackerRow.has_attacked) {
    return errorResponse(ERROR_CODES.ALREADY_ATTACKED, 'attacker has already attacked this turn', 400)
  }

  // Defender existe + camp adverse (piege #24 friendly fire)
  const defenderRow = units.find(u => u.id === defenderId)
  if (!defenderRow) {
    return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `defender ${defenderId} not found`, 404)
  }
  if (defenderRow.team === attackerRow.team) {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'cannot attack ally (friendly fire)', 400)
  }

  // Distance
  const attackerPos = cube(attackerRow.q, attackerRow.r)
  const defenderPos = cube(defenderRow.q, defenderRow.r)
  const distance = cubeDistance(attackerPos, defenderPos)
  const stats = UNIT_STATS_BY_KIND[attackerRow.kind]

  if (kind === 'melee') {
    // Piege #26 : melee distance == 1 strict
    if (distance !== 1) {
      return errorResponse(ERROR_CODES.OUT_OF_RANGE, `melee requires distance 1, got ${distance}`, 400)
    }
  } else {
    // Ranged : distance <= range
    if (distance > stats.range) {
      return errorResponse(ERROR_CODES.OUT_OF_RANGE, `target distance ${distance} > range ${stats.range}`, 400)
    }
    // Ranged : LoS — blockers = TOUS les autres units sauf attacker et defender (piege #15, #25)
    const blockers = new Set<string>()
    for (const u of units) {
      if (u.id === attackerId || u.id === defenderId) continue
      blockers.add(cubeKey(cube(u.q, u.r)))
    }
    if (!hasLineOfSight(attackerPos, defenderPos, blockers)) {
      return errorResponse(ERROR_CODES.NO_LINE_OF_SIGHT, 'line of sight blocked', 400)
    }
  }

  // Build UnitState pour engine
  const attacker = buildUnitState(attackerRow)
  const defender = buildUnitState(defenderRow)

  // Combat (rng partage entre attaque + riposte pour determinisme replay)
  const seed = Date.now()
  const rng = seededRng(seed)
  const modifiers = { flanked: false }

  const combat = kind === 'melee'
    ? resolveMelee(attacker, defender, modifiers, rng)
    : resolveRanged(attacker, defender, modifiers, rng)

  // Etat post-attaque (avant riposte eventuelle)
  // Defender : hp = combat.defenderHpAfter, morale = combat.defenderMoraleAfter, routed = combat.defenderRouted
  // Attacker : hp inchange (l'attaque seule ne blesse pas l'attaquant), morale = combat.attackerMoraleAfter, routed = combat.attackerRouted

  let attackerHpAfter = attacker.hp
  let attackerMoraleAfter = combat.attackerMoraleAfter
  let attackerRoutedAfter = combat.attackerRouted
  let defenderHpAfter = combat.defenderHpAfter
  let defenderMoraleAfter = combat.defenderMoraleAfter
  let defenderRoutedAfter = combat.defenderRouted

  let riposte: CombatResultSnapshot | null = null
  let attackerKilled = false
  const defenderKilled = combat.defenderKilled

  // Riposte melee : si defender survit ET non routed apres l'attaque initiale
  if (kind === 'melee' && !defenderKilled && !defenderRoutedAfter) {
    // Build UnitState post-attaque pour la riposte (defender riposte → defender devient attacker)
    const defenderAfter: UnitState = {
      ...defender,
      hp: defenderHpAfter,
      morale: defenderMoraleAfter,
      routed: defenderRoutedAfter,
    }
    const attackerAfter: UnitState = {
      ...attacker,
      morale: attackerMoraleAfter,
      routed: attackerRoutedAfter,
    }
    const ripCombat = resolveMelee(defenderAfter, attackerAfter, { flanked: false }, rng)
    riposte = ripCombat

    // Apres riposte : defender (en tant qu'attaquant de riposte) gagne morale +2 → ripCombat.attackerMoraleAfter
    //                 attacker (en tant que cible) prend des degats + morale -damage/4 → ripCombat.defenderMoraleAfter
    defenderMoraleAfter = ripCombat.attackerMoraleAfter
    defenderRoutedAfter = ripCombat.attackerRouted
    attackerHpAfter = Math.max(0, attacker.hp - ripCombat.damageDealt)
    attackerMoraleAfter = ripCombat.defenderMoraleAfter
    attackerRoutedAfter = ripCombat.defenderRouted
    attackerKilled = ripCombat.defenderKilled
  }

  // Updates DB (piege #22 : non atomic, MVP acceptable)
  // Defender first puis attacker. Si defender DELETE/UPDATE rate, on n'a pas encore touche attacker.

  if (defenderKilled) {
    const { error } = await admin
      .from('units')
      .delete()
      .eq('id', defenderId)
      .eq('game_id', gameId)
    if (error) {
      console.error(`${TAG} defender delete failed:`, error.message)
      return errorResponse(ERROR_CODES.INTERNAL, `defender delete failed: ${error.message}`, 500)
    }
  } else {
    const { error } = await admin
      .from('units')
      .update({
        hp: defenderHpAfter,
        morale: defenderMoraleAfter,
        routed: defenderRoutedAfter,
      })
      .eq('id', defenderId)
      .eq('game_id', gameId)
    if (error) {
      console.error(`${TAG} defender update failed:`, error.message)
      return errorResponse(ERROR_CODES.INTERNAL, `defender update failed: ${error.message}`, 500)
    }
  }

  if (attackerKilled) {
    const { error } = await admin
      .from('units')
      .delete()
      .eq('id', attackerId)
      .eq('game_id', gameId)
    if (error) {
      console.error(`${TAG} attacker delete failed:`, error.message)
      return errorResponse(ERROR_CODES.INTERNAL, `attacker delete failed: ${error.message}`, 500)
    }
  } else {
    const { error } = await admin
      .from('units')
      .update({
        hp: attackerHpAfter,
        morale: attackerMoraleAfter,
        routed: attackerRoutedAfter,
        has_attacked: true,
      })
      .eq('id', attackerId)
      .eq('game_id', gameId)
    if (error) {
      console.error(`${TAG} attacker update failed:`, error.message)
      return errorResponse(ERROR_CODES.INTERNAL, `attacker update failed: ${error.message}`, 500)
    }
  }

  // Snapshot D13
  const result: AttackResult = {
    attacker_id: attackerId,
    defender_id: defenderId,
    kind,
    combat: { ...combat },
    riposte: riposte ? { ...riposte } : null,
    defender_killed: defenderKilled,
    attacker_killed: attackerKilled,
    attacker_after: attackerKilled ? null : {
      hp: attackerHpAfter,
      morale: attackerMoraleAfter,
      routed: attackerRoutedAfter,
      has_attacked: true,
    },
    defender_after: defenderKilled ? null : {
      hp: defenderHpAfter,
      morale: defenderMoraleAfter,
      routed: defenderRoutedAfter,
    },
    seed,
  }

  // INSERT game_actions (idempotence via UNIQUE client_action_id)
  const actionType = kind === 'melee' ? 'attack_melee' : 'attack_ranged'
  const { error: actionErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: userId,
    action_type: actionType,
    payload: { unit_id: attackerId, target_unit_id: defenderId },
    result,
    seed,
    client_action_id: clientActionId,
  })

  if (actionErr) {
    if (actionErr.code === '23505' && clientActionId) {
      const { data: cached } = await admin
        .from('game_actions')
        .select('result')
        .eq('game_id', gameId)
        .eq('client_action_id', clientActionId)
        .maybeSingle()
      if (cached) {
        return jsonResponse({ ok: true, idempotent: true, result: cached.result })
      }
    }
    console.warn(`${TAG} game_actions insert failed:`, actionErr.message)
  }

  return jsonResponse({ ok: true, result })
}
