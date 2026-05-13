// v1.0 (11/05/2026) — Phase 2.5 B : combat suicide unité Brisée encerclée (Thermopyle effect)
// Source : docs/PLAN-MORAL-COHESION.md § 4

import { jsonResponse, errorResponse } from '../../_shared/cors.ts'
import {
  ERROR_CODES,
  type Team,
  type SuicidePayload,
  type SuicideResult,
  type CombatResultSnapshotV2,
} from '../../_shared/types.ts'
import { cube, cubeDistance, cubeKey, neighbors } from '../../_shared/engine-port/hex/index.ts'
import { resolveContact } from '../../_shared/engine-port/combat/v2/index.ts'
import { seededRng } from '../../_shared/engine-port/combat/index.ts'
import { computeSupport } from '../../_shared/engine-port/cohesion/index.ts'
import { MORALE_ROUT_THRESHOLD } from '../../_shared/engine-port/morale/index.ts'
import {
  buildAllUnitStates,
  buildUnitState,
  computeCohesionFor,
  getCampEffectiveRatio,
  terrainAt,
  type UnitRow,
} from './_common.ts'
import type { CombatConfig } from '../../_shared/engine-port/combat/v2/types.ts'
import type { TerrainType } from '../../_shared/engine-port/terrain/index.ts'

const TAG = '[handleSuicide v1.0]'

// Cf. docs/PLAN-MORAL-COHESION.md § 4 — décisions actées 11/05/2026 #10-11
const SUICIDE_DAMAGE_MULTIPLIER = 1.5
const SUICIDE_GLOBAL_RATIO_FLOOR = 0.25
const SUICIDE_ENEMY_MORALE_MALUS = 5

export interface HandleSuicideArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  boardRadius: number
  units: UnitRow[]
  terrainMap: Map<string, TerrainType>
  combatConfig: CombatConfig
  clientActionId: string | null
  payload: Partial<SuicidePayload> | null
}

export async function handleSuicide(args: HandleSuicideArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, boardRadius, units, terrainMap, combatConfig, clientActionId, payload } = args

  if (!payload || typeof payload.unit_id !== 'string' || typeof payload.target_unit_id !== 'string') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id, target_unit_id }', 400)
  }
  const attackerId = payload.unit_id
  const targetId = payload.target_unit_id

  if (attackerId === targetId) {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'cannot suicide-attack self', 400)
  }

  const attackerRow = units.find(u => u.id === attackerId)
  if (!attackerRow) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `attacker ${attackerId} not found`, 404)
  if (attackerRow.team !== userTeam) {
    return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'attacker belongs to another team', 403)
  }

  const targetRow = units.find(u => u.id === targetId)
  if (!targetRow) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `target ${targetId} not found`, 404)
  if (targetRow.team === attackerRow.team) {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'cannot suicide-attack ally', 400)
  }

  // Validation distance : adjacent (mêlée pure)
  const attackerPos = cube(attackerRow.q, attackerRow.r)
  const targetPos = cube(targetRow.q, targetRow.r)
  if (cubeDistance(attackerPos, targetPos) !== 1) {
    return errorResponse(ERROR_CODES.OUT_OF_RANGE, 'suicide attack requires adjacent target', 400)
  }

  // Phase 3.2-bis : suicide réservé aux routed (effectif < 20%) ou cohésion broken.
  const coh = computeCohesionFor(attackerId, units)
  if (!coh) return errorResponse(ERROR_CODES.INTERNAL, 'cohesion lookup failed', 500)
  if (!attackerRow.routed && coh.cohesion.state !== 'broken') {
    return errorResponse(ERROR_CODES.COHESION_NOT_BROKEN, 'suicide attack reserved for routed or broken units', 400)
  }

  // Validation encerclement : tous voisins libres in-board sont occupés par des ennemis,
  // OU hors-board. Au moins une case voisine = ennemi (sinon retraite possible → pas de suicide).
  const occupiedMap = new Map<string, UnitRow>()
  for (const u of units) {
    occupiedMap.set(cubeKey(cube(u.q, u.r)), u)
  }
  let hasFreeNeighbor = false
  for (const n of neighbors(attackerPos)) {
    if (cubeDistance(n, cube(0, 0)) > boardRadius) continue // hors-board, ignoré
    const occ = occupiedMap.get(cubeKey(n))
    if (!occ) { hasFreeNeighbor = true; break }
    if (occ.team === attackerRow.team) { hasFreeNeighbor = true; break } // allié bloque pas une "fuite vers allié"
  }
  if (hasFreeNeighbor) {
    return errorResponse(ERROR_CODES.SUICIDE_NOT_SURROUNDED, 'suicide attack reserved for fully surrounded units (use retreat instead)', 400)
  }

  // Validation ratio camp : ≥ 25% (sinon → forcer surrender)
  const campRatio = getCampEffectiveRatio(attackerRow.team, units)
  if (campRatio < SUICIDE_GLOBAL_RATIO_FLOOR) {
    return errorResponse(ERROR_CODES.SUICIDE_CAMP_TOO_LOW, `camp effective ratio ${campRatio.toFixed(2)} < ${SUICIDE_GLOBAL_RATIO_FLOOR} — surrender forced`, 400)
  }

  // UnitState v2
  const attacker = buildUnitState(attackerRow)
  const defender = buildUnitState(targetRow)
  const allStates = buildAllUnitStates(units)
  const defenderSupport = computeSupport(defender, allStates)

  const attackerTerrain = terrainAt(terrainMap, attackerPos)
  const defenderTerrain = terrainAt(terrainMap, targetPos)
  const seed = Date.now()
  const rng = seededRng(seed)

  // Combat : appel direct à resolveContact (pas resolveCombat) pour éviter toute riposte.
  // chargeMult = 1.5 sert ici de proxy au multiplicateur "suicide héroïque" (Thermopyle).
  // TODO Vague C/D : remplacer par champ explicit damageMultiplier + label breakdown propre.
  const combat = resolveContact({
    attacker,
    defender,
    phase: 'melee',
    attackerTerrain,
    defenderTerrain,
    distance: 1,
    chargeMult: SUICIDE_DAMAGE_MULTIPLIER,
    rng,
    config: combatConfig,
    defenderSupport,
  })

  // 1. DELETE attacker (toujours — qu'elle ait tué la cible ou non)
  const { error: delErr } = await admin.from('units').delete().eq('id', attackerId).eq('game_id', gameId)
  if (delErr) {
    console.error(`${TAG} attacker delete failed:`, delErr.message)
    return errorResponse(ERROR_CODES.INTERNAL, `attacker delete failed: ${delErr.message}`, 500)
  }

  // 2. UPDATE / DELETE defender selon combat
  const targetKilled = combat.defenderKilled
  if (targetKilled) {
    const { error } = await admin.from('units').delete().eq('id', targetId).eq('game_id', gameId)
    if (error) {
      console.error(`${TAG} target delete failed:`, error.message)
      return errorResponse(ERROR_CODES.INTERNAL, `target delete failed: ${error.message}`, 500)
    }
  } else {
    const newKilledStat = defender.killed + combat.killed
    const { error } = await admin
      .from('units')
      .update({
        hp: combat.defenderHpAfter,
        wounded: combat.defenderWoundedAfter,
        effective: combat.defenderEffectiveAfter,
        killed: newKilledStat,
        morale: combat.defenderMoraleAfter,
        routed: combat.defenderRouted,
      })
      .eq('id', targetId)
      .eq('game_id', gameId)
    if (error) {
      console.error(`${TAG} target update failed:`, error.message)
      return errorResponse(ERROR_CODES.INTERNAL, `target update failed: ${error.message}`, 500)
    }
  }

  // 3. −5 moral camp adverse (toutes unités vivantes hors target déjà mise à jour ci-dessus)
  const enemyTeam: Team = attackerRow.team === 'blue' ? 'red' : 'blue'
  const enemyLowered: string[] = []
  for (const u of units) {
    if (u.team !== enemyTeam) continue
    if (u.id === targetId) continue // évite double update (target a déjà été modifiée)
    if (u.id === attackerId) continue // shouldn't happen (attacker.team !== enemyTeam)
    const newMorale = Math.max(0, u.morale - SUICIDE_ENEMY_MORALE_MALUS)
    if (newMorale === u.morale) continue
    const { error } = await admin
      .from('units')
      .update({ morale: newMorale, routed: newMorale < MORALE_ROUT_THRESHOLD })
      .eq('id', u.id)
      .eq('game_id', gameId)
    if (error) {
      console.warn(`${TAG} enemy malus ${u.id} failed:`, error.message)
      continue
    }
    enemyLowered.push(u.id)
  }

  const result: SuicideResult = {
    attacker_id_deleted: attackerId,
    target_id: targetId,
    combat: combat as CombatResultSnapshotV2,
    target_killed: targetKilled,
    enemy_units_morale_lowered: enemyLowered,
    seed,
  }

  const { error: actionErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: userId,
    action_type: 'suicide_attack',
    payload: { unit_id: attackerId, target_unit_id: targetId },
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
      if (cached) return jsonResponse({ ok: true, idempotent: true, result: cached.result })
    }
    console.warn(`${TAG} game_actions insert failed:`, actionErr.message)
  }

  return jsonResponse({ ok: true, result })
}
