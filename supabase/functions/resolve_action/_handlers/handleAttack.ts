// v1.2 (11/05/2026) — Phase 2.6 Vague B : INSERT engagement après mêlée non-mortelle
// v1.1 (11/05/2026) — Phase 2.5 : check cohésion 'broken' bloque attaque standard + propage support combat
// v1.0 (10/05/2026) — Phase 2 2C.3 : handleAttack v2 (resolveCombat avec terrain + charge cav + breakdown)

import { jsonResponse, errorResponse } from '../../_shared/cors.ts'
import {
  ERROR_CODES,
  type Team,
  type AttackPayload,
  type AttackResultV2,
  type CombatResultSnapshotV2,
} from '../../_shared/types.ts'
import { cube, cubeDistance, cubeKey } from '../../_shared/engine-port/hex/index.ts'
import { hasLineOfSight } from '../../_shared/engine-port/los/index.ts'
import { resolveUnitStatsV2 } from '../../_shared/engine-port/units.ts'
import { resolveCombat } from '../../_shared/engine-port/combat/v2/index.ts'
import { seededRng } from '../../_shared/engine-port/combat/index.ts'
import { computeCohesion, computeSupport } from '../../_shared/engine-port/cohesion/index.ts'
import { buildAllUnitStates, buildUnitState, terrainAt, type UnitRow } from './_common.ts'
import { createEngagementAfterMelee } from './handleEngage.ts'
import type { CombatConfig } from '../../_shared/engine-port/combat/v2/types.ts'
import type { TerrainType } from '../../_shared/engine-port/terrain/index.ts'
import type { Cube } from '../../_shared/engine-port/hex/index.ts'

const TAG = '[handleAttack v1.2]'

export interface HandleAttackArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  units: UnitRow[]
  terrainMap: Map<string, TerrainType>
  combatConfig: CombatConfig
  clientActionId: string | null
  /** kind demande par le client : melee ou ranged. La phase finale est determinee par resolveCombat. */
  kindRequested: 'melee' | 'ranged'
  payload: Partial<AttackPayload> | null
}

export async function handleAttack(args: HandleAttackArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, units, terrainMap, combatConfig, clientActionId, kindRequested, payload } = args

  if (!payload || typeof payload.unit_id !== 'string' || typeof payload.target_unit_id !== 'string') {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'expected { unit_id, target_unit_id }', 400)
  }
  const attackerId = payload.unit_id
  const defenderId = payload.target_unit_id

  if (attackerId === defenderId) {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'cannot attack self', 400)
  }

  const attackerRow = units.find(u => u.id === attackerId)
  if (!attackerRow) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `attacker ${attackerId} not found`, 404)
  if (attackerRow.team !== userTeam) return errorResponse(ERROR_CODES.UNIT_NOT_OWNED, 'attacker belongs to another team', 403)
  if (attackerRow.routed) return errorResponse(ERROR_CODES.UNIT_ROUTED, 'routed units cannot attack', 400)
  if (attackerRow.has_attacked) return errorResponse(ERROR_CODES.ALREADY_ATTACKED, 'attacker has already attacked this turn', 400)

  const defenderRow = units.find(u => u.id === defenderId)
  if (!defenderRow) return errorResponse(ERROR_CODES.UNIT_NOT_FOUND, `defender ${defenderId} not found`, 404)
  if (defenderRow.team === attackerRow.team) {
    return errorResponse(ERROR_CODES.INVALID_PAYLOAD, 'cannot attack ally (friendly fire)', 400)
  }

  const attackerPos = cube(attackerRow.q, attackerRow.r)
  const defenderPos = cube(defenderRow.q, defenderRow.r)
  const distance = cubeDistance(attackerPos, defenderPos)
  const stats = resolveUnitStatsV2(attackerRow.kind, attackerRow.sub_kind ?? undefined)

  if (kindRequested === 'melee') {
    if (distance !== 1) {
      return errorResponse(ERROR_CODES.OUT_OF_RANGE, `melee requires distance 1, got ${distance}`, 400)
    }
  } else {
    // ranged : range + LoS + min_range
    if (distance > stats.range) {
      return errorResponse(ERROR_CODES.OUT_OF_RANGE, `target distance ${distance} > range ${stats.range}`, 400)
    }
    if (distance < stats.minRange) {
      return errorResponse(ERROR_CODES.OUT_OF_RANGE, `target distance ${distance} < min_range ${stats.minRange}`, 400)
    }
    const blockers = new Set<string>()
    for (const u of units) {
      if (u.id === attackerId || u.id === defenderId) continue
      blockers.add(cubeKey(cube(u.q, u.r)))
    }
    if (!hasLineOfSight(attackerPos, defenderPos, blockers)) {
      return errorResponse(ERROR_CODES.NO_LINE_OF_SIGHT, 'line of sight blocked', 400)
    }
  }

  // UnitState v2
  const attacker = buildUnitState(attackerRow)
  const defender = buildUnitState(defenderRow)

  // Phase 2.5 — check cohésion attaquant : Brisé ne peut pas attaquer (sauf suicide_attack).
  // Le routed legacy (moral < 25) reste également un blocage via le check au-dessus.
  // Note : on calcule support sur TOUS les unitStates (alliés non-brisés rayon 1+2).
  const allStates = buildAllUnitStates(units)
  const attackerSupport = computeSupport(attacker, allStates)
  const attackerCohesion = computeCohesion(attacker, attackerSupport)
  if (attackerCohesion.state === 'broken') {
    // v1.3 (12/05/2026) — Override : autorise l'attaque si la cible est strictement
    // plus petite (en effectif) que l'attaquant. Permet de finir une unité affaiblie
    // même quand on est soi-même Brisé (par moral). L'information ne fuit pas vers le
    // joueur côté UI (la requête réussit ou échoue, le serveur seul connaît l'écart).
    const targetWeaker = defender.effective < attacker.effective
    if (!targetWeaker) {
      return errorResponse(
        ERROR_CODES.COHESION_BROKEN,
        'broken unit cannot perform standard attack — use retreat / surrender / suicide_attack',
        400,
      )
    }
  }
  const defenderSupport = computeSupport(defender, allStates)

  const attackerTerrain = terrainAt(terrainMap, attackerPos)
  const defenderTerrain = terrainAt(terrainMap, defenderPos)

  // Path attaquant pour detection charge cav (cf. handleMove last_move_path)
  let attackerPath: ReadonlyArray<Cube> | undefined
  let attackerPathTerrain: ReadonlyArray<TerrainType> | undefined
  if (kindRequested === 'melee' && attacker.lastMovePath && attacker.lastMovePath.length >= 3) {
    attackerPath = attacker.lastMovePath
    attackerPathTerrain = attackerPath.map(p => terrainAt(terrainMap, p))
  }

  const seed = Date.now()
  const rng = seededRng(seed)

  const combatRun = resolveCombat({
    attacker,
    defender,
    attackerTerrain,
    defenderTerrain,
    distance,
    attackerPath,
    attackerPathTerrain,
    rng,
    config: combatConfig,
    attackerSupport,
    defenderSupport,
  })

  const combat = combatRun.result
  const ripost = combatRun.ripost

  // Etats post-combat
  let attackerHpAfter = attacker.hp
  let attackerWoundedAfter = attacker.wounded
  let attackerEffectiveAfter = attacker.effective
  let attackerKilledStat = attacker.killed
  let attackerMoraleAfter = combat.attackerMoraleAfter
  let attackerRoutedAfter = combat.attackerRouted
  let attackerKilled = false

  let defenderHpAfter = combat.defenderHpAfter
  let defenderWoundedAfter = combat.defenderWoundedAfter
  let defenderEffectiveAfter = combat.defenderEffectiveAfter
  let defenderKilledStat = defender.killed + combat.killed
  let defenderMoraleAfter = combat.defenderMoraleAfter
  let defenderRoutedAfter = combat.defenderRouted
  const defenderKilled = combat.defenderKilled

  if (ripost) {
    // riposte = defender frappe attacker, donc :
    //   attacker (cible riposte) : hp/wounded/morale/effective baissent
    //   defender (attaquant riposte) : morale + 2
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

  // Updates DB
  if (defenderKilled) {
    const { error } = await admin.from('units').delete().eq('id', defenderId).eq('game_id', gameId)
    if (error) {
      console.error(`${TAG} defender delete failed:`, error.message)
      return errorResponse(ERROR_CODES.INTERNAL, `defender delete failed: ${error.message}`, 500)
    }
  } else {
    const { error } = await admin
      .from('units')
      .update({
        hp: defenderHpAfter,
        wounded: defenderWoundedAfter,
        effective: defenderEffectiveAfter,
        killed: defenderKilledStat,
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
    const { error } = await admin.from('units').delete().eq('id', attackerId).eq('game_id', gameId)
    if (error) {
      console.error(`${TAG} attacker delete failed:`, error.message)
      return errorResponse(ERROR_CODES.INTERNAL, `attacker delete failed: ${error.message}`, 500)
    }
  } else {
    const { error } = await admin
      .from('units')
      .update({
        hp: attackerHpAfter,
        wounded: attackerWoundedAfter,
        effective: attackerEffectiveAfter,
        killed: attackerKilledStat,
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

  // Snapshot D13 (CombatResultV2 enrichi pour Realtime/replays)
  const result: AttackResultV2 = {
    attacker_id: attackerId,
    defender_id: defenderId,
    kind: combat.attackPhase,
    combat: combat as CombatResultSnapshotV2,
    riposte: ripost as CombatResultSnapshotV2 | null,
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
      hp: defenderHpAfter,
      wounded: defenderWoundedAfter,
      morale: defenderMoraleAfter,
      routed: defenderRoutedAfter,
      effective: defenderEffectiveAfter,
      killed: defenderKilledStat,
    },
    seed,
  }

  const actionType = combat.attackPhase === 'ranged' ? 'attack_ranged' : 'attack_melee'
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
      if (cached) return jsonResponse({ ok: true, idempotent: true, result: cached.result })
    }
    console.warn(`${TAG} game_actions insert failed:`, actionErr.message)
  }

  // Phase 2.6 — INSERT (idempotent) engagement après mêlée non-mortelle.
  // Conditions cf. docs/PLAN-ENGAGEMENT-PERSISTENT.md § 1.2 :
  //  - phase resolue == 'melee' (charge = ponctuelle, ranged = pas d'engagement)
  //  - les 2 unités survivent (pas de dissolution unilatérale)
  // L'appel est non-fatal : un échec ne casse pas le retour client. Realtime
  // propage l'INSERT au client via la publication engagements (migration 017).
  if (combat.attackPhase === 'melee' && !defenderKilled && !attackerKilled) {
    await createEngagementAfterMelee({
      admin,
      gameId,
      attackerId,
      defenderId,
      currentTurn,
    })
  }

  return jsonResponse({ ok: true, result })
}
