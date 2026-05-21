// v1.9 (16/05/2026) — fix hit-and-run : retreat post-charge exécuté même si
//   defenderKilled (la cav doit pouvoir se replier après avoir achevé l'ennemi —
//   c'est le sens tactique du hit-and-run historique). Skip validDirection
//   quand defender supprimé. attackerKilled reste un blocker (pas d'attacker
//   à déplacer).
// v1.8 (16/05/2026) — Phase 2.6 UX pré-commit : retreat radius étendu de 1 à 3 hex (charge_intent.retreat_dest)
// v1.7 (16/05/2026) — Phase 2.6 refonte : pré-move atomique si payload.move_path fourni (auto-charge cav + auto-march inf + auto-position art)
// v1.6 (16/05/2026) — Phase 2.6 UX : payload.charge_intent → résout charge_stay/retreat direct (skip pending modal)
// v1.5 (16/05/2026) — Phase 2.6 : charge cav non-mortelle → set pending_post_charge_target_id (menu Rester/Replier)
// v1.4 (14/05/2026) — Phase 3.3 : lookup hold posture pour bonus défensif (attaquant + défenseur)
// v1.3 (14/05/2026) — Phase 3.3 : skip LoS si attacker.arcedTrajectory (obusier tire par-dessus les unités)
// v1.2 (11/05/2026) — Phase 2.6 Vague B : INSERT engagement après mêlée non-mortelle
// v1.1 (11/05/2026) — Phase 2.5 : check cohésion 'broken' bloque attaque standard + propage support combat

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

const TAG = '[handleAttack v1.8]'

/**
 * Phase 2.6 refonte — valide un move_path fourni par le client (pré-move atomique).
 * Vérifie : path[0]==start, path[N-1]==goal, chaque pas adjacent, pas de blocker
 * sauf goal, longueur ≤ movement budget. Skip ZoC (trust client : engine ZoC déjà
 * appliquée client-side, faible risque cheat MVP).
 *
 * Retourne `null` si valide, sinon un message d'erreur descriptif.
 */
function validateMovePath(
  start: Cube,
  goal: Cube,
  path: ReadonlyArray<Cube>,
  blockers: ReadonlySet<string>,
  movement: number,
): string | null {
  if (path.length < 2) return 'move_path must have at least start + goal'
  if (path[0].q !== start.q || path[0].r !== start.r) return 'move_path[0] != attacker position'
  const last = path[path.length - 1]
  if (last.q !== goal.q || last.r !== goal.r) return 'move_path last hex != move_dest'
  if (path.length - 1 > movement) return `move_path length ${path.length - 1} > movement ${movement}`
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]
    const cur = path[i]
    if (cubeDistance(prev, cur) !== 1) return `move_path step ${i} not adjacent`
    if (blockers.has(cubeKey(cur))) return `move_path step ${i} hits blocker`
  }
  return null
}

/** Phase 3.3 — lookup ordre priority=1 actif kind='hold' pour un pion (stance défensive). */
// deno-lint-ignore no-explicit-any
async function lookupOnHold(admin: any, unitId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('unit_orders')
    .select('action')
    .eq('unit_id', unitId)
    .eq('priority', 1)
    .eq('active', true)
    .maybeSingle()
  if (error || !data) return false
  return (data as { action?: { kind?: string } }).action?.kind === 'hold'
}

export interface HandleAttackArgs {
  // deno-lint-ignore no-explicit-any
  admin: any
  gameId: string
  userId: string
  userTeam: Team
  currentTurn: number
  /** Phase 2.6 UX : rayon du plateau pour valider charge_intent.retreat_dest. */
  boardRadius: number
  units: UnitRow[]
  terrainMap: Map<string, TerrainType>
  combatConfig: CombatConfig
  clientActionId: string | null
  /** kind demande par le client : melee ou ranged. La phase finale est determinee par resolveCombat. */
  kindRequested: 'melee' | 'ranged'
  payload: Partial<AttackPayload> | null
}

export async function handleAttack(args: HandleAttackArgs): Promise<Response> {
  const { admin, gameId, userId, userTeam, currentTurn, boardRadius, units, terrainMap, combatConfig, clientActionId, kindRequested, payload } = args

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

  const stats = resolveUnitStatsV2(attackerRow.kind, attackerRow.sub_kind ?? undefined)

  // Phase 2.6 refonte — pré-move atomique. Si payload.move_path fourni, on
  // applique d'abord le déplacement de l'attaquant (UPDATE units q,r,
  // last_move_path, has_moved) puis on continue avec l'attaque depuis la
  // nouvelle position. Une seule transaction, idéal pour auto-charge cav +
  // auto-march inf + auto-position art.
  if (payload.move_dest && payload.move_path && payload.move_path.length > 0) {
    if (attackerRow.has_moved) {
      return errorResponse(ERROR_CODES.ALREADY_MOVED, 'attacker has already moved this turn', 400)
    }
    const startCube = cube(attackerRow.q, attackerRow.r)
    const goalCube = cube(payload.move_dest.q, payload.move_dest.r)
    const pathCubes: Cube[] = payload.move_path.map(p => ({ q: p.q, r: p.r, s: -p.q - p.r }))

    // Blockers = positions des autres unités (le défenseur compte aussi : on
    // s'arrête à 1 hex de lui pour la mêlée, pas dessus). Goal autorisé.
    const moveBlockers = new Set<string>()
    for (const u of units) {
      if (u.id === attackerId) continue
      moveBlockers.add(cubeKey(cube(u.q, u.r)))
    }

    const validationErr = validateMovePath(startCube, goalCube, pathCubes, moveBlockers, stats.movement)
    if (validationErr) {
      return errorResponse(ERROR_CODES.INVALID_MOVE, validationErr, 400)
    }

    // Validation in-board (rayon plateau).
    if (cubeDistance(goalCube, cube(0, 0)) > boardRadius) {
      return errorResponse(ERROR_CODES.OUT_OF_BOARD, 'move_dest beyond boardRadius', 400)
    }

    // UPDATE units : nouvelle position + last_move_path + has_moved.
    const { error: moveErr } = await admin.from('units').update({
      q: goalCube.q,
      r: goalCube.r,
      last_move_path: pathCubes.map(c => ({ q: c.q, r: c.r, s: c.s })),
      has_moved: true,
    }).eq('id', attackerId).eq('game_id', gameId)
    if (moveErr) {
      if (moveErr.code === '23505') {
        return errorResponse(ERROR_CODES.TARGET_OCCUPIED, 'move_dest just got occupied (race)', 400)
      }
      console.error(`${TAG} pre-move update failed:`, moveErr.message)
      return errorResponse(ERROR_CODES.INTERNAL, `pre-move failed: ${moveErr.message}`, 500)
    }

    // Patch l'attackerRow en mémoire pour que tout le code aval voit la
    // nouvelle position (notamment buildUnitState → lastMovePath → isChargeApplicable).
    attackerRow.q = goalCube.q
    attackerRow.r = goalCube.r
    attackerRow.has_moved = true
    attackerRow.last_move_path = pathCubes.map(c => ({ q: c.q, r: c.r, s: c.s }))
  }

  const attackerPos = cube(attackerRow.q, attackerRow.r)
  const defenderPos = cube(defenderRow.q, defenderRow.r)
  const distance = cubeDistance(attackerPos, defenderPos)

  if (kindRequested === 'melee') {
    if (distance !== 1) {
      return errorResponse(ERROR_CODES.OUT_OF_RANGE, `melee requires distance 1, got ${distance}`, 400)
    }
  } else {
    // ranged : range + min_range + LoS conditionnel.
    if (distance > stats.range) {
      return errorResponse(ERROR_CODES.OUT_OF_RANGE, `target distance ${distance} > range ${stats.range}`, 400)
    }
    if (distance < stats.minRange) {
      return errorResponse(ERROR_CODES.OUT_OF_RANGE, `target distance ${distance} < min_range ${stats.minRange}`, 400)
    }
    // Phase 3.3 — tir en cloche (obusier) ignore les blockers unités. Sinon LoS classique.
    if (!stats.arcedTrajectory) {
      const blockers = new Set<string>()
      for (const u of units) {
        if (u.id === attackerId || u.id === defenderId) continue
        blockers.add(cubeKey(cube(u.q, u.r)))
      }
      if (!hasLineOfSight(attackerPos, defenderPos, blockers)) {
        return errorResponse(ERROR_CODES.NO_LINE_OF_SIGHT, 'line of sight blocked', 400)
      }
    }
  }

  // UnitState v2.
  // Phase 2.6 UX — si charge_intent.skip_charge, on strip lastMovePath de
  // l'attaquant *en mémoire* (la BDD reste intacte). Conséquence : resolveCombat
  // ne détecte plus de charge éligible → phase='melee' standard, pas de bonus.
  let attacker = buildUnitState(attackerRow)
  if (payload.charge_intent?.post_charge === 'skip_charge') {
    attacker = { ...attacker, lastMovePath: undefined }
  }
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

  // Phase 3.3 — bonus défensif si le défenseur (et l'attaquant pour la riposte) ont
  // une posture hold priority=1 active. Indépendant du trigger : la posture seule suffit.
  const [defenderOnHold, attackerOnHold] = await Promise.all([
    lookupOnHold(admin, defender.id),
    lookupOnHold(admin, attacker.id),
  ])

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
    attackerOnHold,
    defenderOnHold,
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

  // Phase 2.6 — charge cav ponctuelle : si phase='charge' ET attaquant survit.
  // v1.6 UX : si le client a fourni `charge_intent` dans le payload (mini popup
  // pré-commit), on résout direct selon le choix. Sinon, fallback legacy :
  // set `pending_post_charge_target_id` qui ouvre la modale côté client.
  // v1.9 : le retreat hit-and-run s'exécute MÊME si defenderKilled (la cav
  // doit pouvoir se retirer après avoir achevé l'ennemi). attackerKilled reste
  // un blocker (pas d'attaquant à déplacer).
  if (combat.attackPhase === 'charge' && !attackerKilled) {
    const intent = payload.charge_intent
    if (intent?.post_charge === 'stay') {
      // Rester en mêlée : engagement immédiat avec from_charge=true.
      // Si defenderKilled : pas d'engagement possible (pas de cible) → no-op.
      if (!defenderKilled) {
        await createEngagementAfterMelee({
          admin, gameId, attackerId, defenderId, currentTurn, fromCharge: true,
        })
      }
    } else if (intent?.post_charge === 'retreat' && intent.retreat_dest) {
      // Replier 1-3 hex : déplace la cavalerie. Validation defensive (in-board,
      // distance ≤ 3, libre, ne se rapproche pas du défenseur — sinon fallback stay).
      const destQ = intent.retreat_dest.q
      const destR = intent.retreat_dest.r
      const origin = cube(attackerRow.q, attackerRow.r)
      const dest = cube(destQ, destR)
      const occupied = units.some(u => u.id !== attackerId && u.q === destQ && u.r === destR)
      // v1.8 (16/05/2026) — retreat radius étendu à 3 (au lieu de 1) pour
      // donner une vraie zone de retraite (feedback user pré-commit UX).
      const validAdjacent = cubeDistance(origin, dest) >= 1 && cubeDistance(origin, dest) <= 3
      const validBoard = cubeDistance(dest, cube(0, 0)) <= boardRadius
      // v1.9 : si defenderKilled, defenderRow.q/r reflète encore la position
      // d'avant suppression (la row est en mémoire, pas re-fetched). On peut
      // l'utiliser pour validDirection. Si jamais defenderRow n'existait pas
      // (ne devrait pas arriver), on skip le check directionnel.
      const defenderPos = cube(defenderRow.q, defenderRow.r)
      const distBefore = cubeDistance(origin, defenderPos)
      const distAfter = cubeDistance(dest, defenderPos)
      const validDirection = distAfter >= distBefore

      if (validAdjacent && validBoard && !occupied && validDirection) {
        const { error: moveErr } = await admin
          .from('units')
          .update({ q: destQ, r: destR, last_move_path: null })
          .eq('id', attackerId)
          .eq('game_id', gameId)
        if (moveErr) {
          console.warn(`${TAG} charge_intent retreat update failed:`, moveErr.message)
          // Fallback : si le déplacement échoue ET défenseur vivant, on retombe
          // sur stay (engagement). Si défenseur mort, no-op (cav reste à landing).
          if (!defenderKilled) {
            await createEngagementAfterMelee({
              admin, gameId, attackerId, defenderId, currentTurn, fromCharge: true,
            })
          }
        }
        // Sinon : pas d'engagement (la cav s'éloigne), aucun pending. Done.
      } else {
        // Intent invalide → fallback stay (mieux que pending modal pour UX fluide).
        // Si defenderKilled, pas d'engagement possible → cav reste sur landing.
        console.warn(`${TAG} charge_intent retreat invalid (adj=${validAdjacent} board=${validBoard} occupied=${occupied} dir=${validDirection}), fallback ${defenderKilled ? 'stay-at-landing' : 'engagement'}`)
        if (!defenderKilled) {
          await createEngagementAfterMelee({
            admin, gameId, attackerId, defenderId, currentTurn, fromCharge: true,
          })
        }
      }
    } else if (!defenderKilled) {
      // Pas d'intent fourni → legacy fallback : set pending (modale s'ouvre côté client).
      // Si defenderKilled, pas de décision pending nécessaire (pas de cible).
      const { error: pendingErr } = await admin
        .from('units')
        .update({ pending_post_charge_target_id: defenderId })
        .eq('id', attackerId)
      if (pendingErr) {
        console.warn(`${TAG} set pending_post_charge_target_id failed:`, pendingErr.message)
      }
    }
  }

  return jsonResponse({ ok: true, result })
}
