// v1.5 (14/05/2026) — Phase 3.3-bis : charge applique combat réel (resolveCombat + ripost) + case camp
// v1.4 (14/05/2026) — Phase 3.3 : applyFireOrderCombat lookup hold posture (bonus défensif)
// v1.3 (14/05/2026) — Phase 3.3 : order_triggered actor = owner du pion (toast côté propriétaire)
// v1.2 (13/05/2026) — Phase 3.3 : fire en mêlée (ripost + engagement) + morale tax alerte −1
// Appelé par resolve_turn entre le reset des flags (§9) et le calcul de morale (§10).
//
// Scope Phase 3.3 :
//  - SELECT unit_orders pour les unités de toTeam.
//  - Construire context (engagedUnitIds, visibleEnemyIds, visibleTileKeys, cohesionByUnit).
//  - evaluateOrders → OrderEvaluation par unité (ou null).
//  - Appliquer les mutations pour les actions exécutables :
//      * 'hold'    → no-op (just consigne dans game_actions).
//      * 'retreat' → UPDATE units.position + has_moved=true + DELETE engagements de cette unité.
//      * 'charge'  → UPDATE units.position + has_moved=true + has_attacked=true + INSERT engagement.
//                    Pas de damage (TODO Phase 3.3 follow-up : appliquer melee/charge complet).
//      * 'fire'    → resolveCombat(phase='ranged') → UPDATE defender + attacker + INSERT
//                    game_actions(attack_ranged) avec actor_user_id = order owner. Passe dans
//                    le pipeline existant useCombatNotifications (les 2 joueurs voient le rapport).
//  - Pour chaque évaluation (skipped ou exécutée), INSERT game_actions(action_type='order_triggered').

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import {
  cube,
  cubeDistance,
  cubeKey,
  cubeLineDraw,
  spiral,
  type Cube,
} from '../_shared/engine-port/hex/index.ts'
import {
  computeCohesion,
  computeSupport,
  type CohesionState,
} from '../_shared/engine-port/cohesion/index.ts'
import {
  visibleEnemiesFromTeam,
  visibleHexesFromTeam,
} from '../_shared/engine-port/vision/index.ts'
import { evaluateOrders } from '../_shared/engine-port/orders/index.ts'
import type {
  EvaluateOrdersContext,
  OrderEvaluation,
  Posture,
} from '../_shared/engine-port/orders/index.ts'
import { resolveCombat, type CombatConfig } from '../_shared/engine-port/combat/v2/index.ts'
import { seededRng } from '../_shared/engine-port/combat/index.ts'
import type { TerrainType } from '../_shared/engine-port/terrain/index.ts'
import { DEFAULT_TERRAIN } from '../_shared/engine-port/terrain/index.ts'
import type { UnitState } from '../_shared/engine-port/units.ts'
import type {
  AttackResultV2,
  CombatResultSnapshotV2,
  OrderActionDTO,
  OrderTriggerDTO,
  Team,
} from '../_shared/types.ts'

/** Phase 3.3 — lookup ordre priority=1 actif kind='hold' (stance défensive). */
async function lookupOnHold(admin: SupabaseClient, unitId: string): Promise<boolean> {
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

interface EngagementRow {
  id: string
  unit_a_id: string
  unit_b_id: string
}

interface UnitOrderRow {
  id: string
  unit_id: string
  owner_user_id: string
  priority: number
  trigger: OrderTriggerDTO
  action: OrderActionDTO
  active: boolean
}

export interface OrderTriggeredEvent {
  unit_id: string
  posture_id: string
  resolved_action: 'charge' | 'fire' | 'retreat' | 'hold'
  target_unit_id: string | null
  dest_q: number | null
  dest_r: number | null
  skipped: string | null
}

export interface EvaluateOrdersResult {
  events: OrderTriggeredEvent[]
}

interface EvaluateOrdersParams {
  admin: SupabaseClient
  gameId: string
  toTeam: Team
  /** Snapshot des unités après tick d'engagement (= état affiché au joueur entrant). */
  units: ReadonlyArray<UnitState>
  /** Engagements actifs APRÈS dissolution post-tick. */
  engagements: ReadonlyArray<EngagementRow>
  boardRadius: number
  /** Tour courant (= turnAfter dans resolve_turn). Servira au INSERT engagement.started_turn. */
  currentTurn: number
  /** user_id qui a déclenché end_turn (pour actor_user_id des log order_triggered fallback). */
  actorUserId: string
  /** Phase 3.3 — terrain map (cubeKey → TerrainType) pour resolveCombat des ordres fire. */
  terrainMap: Map<string, TerrainType>
  /** Phase 3.3 — config combat (DEFAULT_COMBAT_CONFIG ou scénario). */
  combatConfig: CombatConfig
}

/**
 * Évalue tous les ordres des unités de toTeam et applique leurs effets.
 * Retourne la liste des events pour la réponse EndTurnResult (UI Vague C4).
 *
 * Erreurs Supabase : loggées console.warn, pas de throw (cohérent avec les
 * autres blocs de resolve_turn qui tolèrent les échecs partiels).
 */
export async function evaluateAndApplyOrders(p: EvaluateOrdersParams): Promise<EvaluateOrdersResult> {
  const { admin, gameId, toTeam, units, engagements, boardRadius, currentTurn, actorUserId, terrainMap, combatConfig } = p
  const events: OrderTriggeredEvent[] = []

  const toTeamUnitIds = units.filter(u => u.team === toTeam).map(u => u.id)
  if (toTeamUnitIds.length === 0) return { events }

  // 1. Charger les ordres actifs de toTeam.
  const { data: ordersRaw, error: ordersErr } = await admin
    .from('unit_orders')
    .select('id, unit_id, owner_user_id, priority, trigger, action, active')
    .eq('game_id', gameId)
    .eq('active', true)
    .in('unit_id', toTeamUnitIds)
  if (ordersErr) {
    console.warn('[evaluateAndApplyOrders] unit_orders fetch failed:', ordersErr.message)
    return { events }
  }
  const orderRows = (ordersRaw ?? []) as UnitOrderRow[]
  if (orderRows.length === 0) return { events }

  // Group postures by unit + owner lookup (Phase 3.3 : needed pour actor_user_id du game_actions
  // attack_ranged inséré quand fire déclenche — sinon useCombatNotifications attribuerait l'attaque
  // au mauvais camp).
  const posturesByUnit = new Map<string, Posture[]>()
  const ownersByUnit = new Map<string, string>()
  for (const r of orderRows) {
    const posture: Posture = {
      id: r.id,
      unitId: r.unit_id,
      priority: r.priority,
      trigger: r.trigger,
      action: r.action,
      active: r.active,
    }
    const list = posturesByUnit.get(r.unit_id) ?? []
    list.push(posture)
    posturesByUnit.set(r.unit_id, list)
    ownersByUnit.set(r.unit_id, r.owner_user_id)
  }

  // 2. Construire le contexte une fois par team (visibilité, cohésion, engagements).
  const boardKeys = new Set(spiral(cube(0, 0), boardRadius).map(cubeKey))
  const engagedUnitIds = new Set<string>()
  for (const e of engagements) {
    engagedUnitIds.add(e.unit_a_id)
    engagedUnitIds.add(e.unit_b_id)
  }
  const visibleEnemiesMap = visibleEnemiesFromTeam(toTeam, units, boardKeys)
  const visibleEnemyIds = new Set<string>(visibleEnemiesMap.keys())
  const visibleTileKeys = visibleHexesFromTeam(toTeam, units, boardKeys)

  const cohesionByUnit = new Map<string, CohesionState>()
  for (const u of units) {
    const support = computeSupport(u, units)
    const c = computeCohesion(u, support)
    cohesionByUnit.set(u.id, c.state)
  }
  const ctx: EvaluateOrdersContext = {
    allUnits: units,
    engagedUnitIds,
    visibleEnemyIds,
    visibleTileKeys,
    cohesionByUnit,
  }

  // 3. Évaluer chaque unité de toTeam (id ASC pour déterminisme).
  const toTeamUnits = [...units].filter(u => u.team === toTeam).sort((a, b) => a.id.localeCompare(b.id))
  // Cache des positions courantes (mutées au fur et à mesure pour cohérence séquentielle).
  const positionCache = new Map<string, Cube>()
  for (const u of units) positionCache.set(u.id, u.position)

  // Phase 3.3 — track des unités tuées par les ordres fire de ce batch. Évite qu'un 2ème
  // archer ne tente d'overkill un défenseur déjà supprimé en BDD (l'UPDATE échouerait silencieusement
  // mais on génèrerait un game_action faux). Le snapshot `units` n'est PAS muté.
  const killedThisBatch = new Set<string>()

  for (const u of toTeamUnits) {
    const postures = posturesByUnit.get(u.id)
    if (!postures || postures.length === 0) continue
    const evaluation = evaluateOrders(u, postures, ctx)
    if (!evaluation) continue
    await applyOrderEvaluation({
      admin,
      gameId,
      unit: u,
      evaluation,
      currentTurn,
      actorUserId,
      positionCache,
      events,
      ownersByUnit,
      units,
      terrainMap,
      combatConfig,
      killedThisBatch,
    })
  }

  return { events }
}

interface ApplyParams {
  admin: SupabaseClient
  gameId: string
  unit: UnitState
  evaluation: OrderEvaluation
  currentTurn: number
  actorUserId: string
  positionCache: Map<string, Cube>
  events: OrderTriggeredEvent[]
  /** Phase 3.3 — Map<unit_id, owner_user_id> pour attribuer actor du game_actions fire. */
  ownersByUnit: Map<string, string>
  /** Phase 3.3 — snapshot des UnitState (lookup défenseur). */
  units: ReadonlyArray<UnitState>
  /** Phase 3.3 — terrain pour resolveCombat. */
  terrainMap: Map<string, TerrainType>
  /** Phase 3.3 — config combat. */
  combatConfig: CombatConfig
  /** Phase 3.3 — défenseurs tués par un ordre antérieur du batch. */
  killedThisBatch: Set<string>
}

/** Applique les mutations BDD pour une évaluation d'ordre + log game_actions. */
async function applyOrderEvaluation(p: ApplyParams): Promise<void> {
  const {
    admin, gameId, unit, evaluation, currentTurn, actorUserId, positionCache, events,
    ownersByUnit, units, terrainMap, combatConfig, killedThisBatch,
  } = p
  const event: OrderTriggeredEvent = {
    unit_id: unit.id,
    posture_id: evaluation.posture.id,
    resolved_action: evaluation.resolvedAction,
    target_unit_id: evaluation.targetUnitId ?? null,
    dest_q: evaluation.destHex?.q ?? null,
    dest_r: evaluation.destHex?.r ?? null,
    skipped: evaluation.skipped ?? null,
  }
  events.push(event)

  // Phase 3.3 — actor_user_id = OWNER du pion (sa conditional fire dans son tour).
  // useOrderTriggeredToasts côté client matche viewer.userId === actor pour n'émettre
  // qu'au propriétaire (privacy : l'adversaire ne voit pas la ligne de log).
  const orderActor = ownersByUnit.get(unit.id) ?? actorUserId

  // Skipped → pas de mutation, juste log.
  if (evaluation.skipped) {
    await insertOrderTriggeredLog(admin, gameId, orderActor, currentTurn, event)
    return
  }

  // Apply mutations selon kind.
  switch (evaluation.resolvedAction) {
    case 'hold': {
      // No-op. Juste log.
      break
    }
    case 'camp': {
      // Phase 3.3-bis — mode campement : regen morale +5 et soin auto wounded 10%.
      // Pas de bonus défensif (trade-off de hold). Sortie via priorités (on_attacked → retreat).
      const healed = Math.min(Math.round(unit.wounded * 0.10), unit.wounded)
      const newEffective = unit.effective + healed
      const newWounded = unit.wounded - healed
      const newMorale = Math.min(unit.moraleMax, unit.morale + 5)
      const { error } = await admin
        .from('units')
        .update({
          effective: newEffective,
          wounded: newWounded,
          morale: newMorale,
        })
        .eq('id', unit.id)
        .eq('game_id', gameId)
      if (error) console.warn('[applyOrderEvaluation] camp update failed:', error.message)
      break
    }
    case 'retreat': {
      if (!evaluation.destHex) break
      const { error } = await admin
        .from('units')
        .update({ q: evaluation.destHex.q, r: evaluation.destHex.r, has_moved: true })
        .eq('id', unit.id)
        .eq('game_id', gameId)
      if (error) {
        console.warn('[applyOrderEvaluation] retreat update failed:', error.message)
        break
      }
      positionCache.set(unit.id, evaluation.destHex)
      // DELETE engagements de cette unité (rompre tous les contacts en se repliant).
      await admin
        .from('engagements')
        .delete()
        .or(`unit_a_id.eq.${unit.id},unit_b_id.eq.${unit.id}`)
        .eq('game_id', gameId)
      break
    }
    case 'charge': {
      // Phase 3.3-bis — combat charge réel. Avant : juste flag has_attacked + INSERT engagement
      // sans dégâts. Maintenant : déplacement vers destHex + resolveCombat avec attackerPath
      // synthétique pour activer charge cav si distance parcourue ≥ 2 hex en ligne droite.
      if (!evaluation.targetUnitId) {
        console.warn('[applyOrderEvaluation] charge without target — fallback flag only')
        const { error } = await admin
          .from('units')
          .update({ has_attacked: true })
          .eq('id', unit.id)
          .eq('game_id', gameId)
        if (error) console.warn('[applyOrderEvaluation] charge flag failed:', error.message)
        break
      }
      if (killedThisBatch.has(evaluation.targetUnitId)) {
        event.skipped = 'no_target'
        break
      }
      const defender = units.find(u => u.id === evaluation.targetUnitId)
      if (!defender) {
        console.warn('[applyOrderEvaluation] charge defender missing in snapshot')
        break
      }
      const ownerUserId = ownersByUnit.get(unit.id) ?? actorUserId
      await applyChargeOrderCombat({
        admin, gameId, attacker: unit, defender, currentTurn,
        ownerUserId, terrainMap, combatConfig, allUnits: units, killedThisBatch,
        postureId: evaluation.posture.id, destHex: evaluation.destHex ?? null,
        positionCache,
      })
      break
    }
    case 'fire': {
      // Phase 3.3 — applique réellement le combat ranged via resolveCombat. Insère un
      // game_actions(attack_ranged) avec actor_user_id = owner du pion (pour que
      // useCombatNotifications attribue l'attaque au bon camp dans le rapport).
      if (!evaluation.targetUnitId) {
        console.warn('[applyOrderEvaluation] fire without target — should not happen post-evaluateOrders')
        const { error } = await admin
          .from('units')
          .update({ has_attacked: true })
          .eq('id', unit.id)
          .eq('game_id', gameId)
        if (error) console.warn('[applyOrderEvaluation] fire flag failed:', error.message)
        break
      }
      if (killedThisBatch.has(evaluation.targetUnitId)) {
        // Cible déjà tuée par un ordre antérieur de ce batch — skip damage, log skip.
        event.skipped = 'no_target'
        break
      }
      const defender = units.find(u => u.id === evaluation.targetUnitId)
      if (!defender) {
        console.warn('[applyOrderEvaluation] fire defender missing in snapshot')
        break
      }
      const ownerUserId = ownersByUnit.get(unit.id) ?? actorUserId
      await applyFireOrderCombat({
        admin, gameId, attacker: unit, defender, currentTurn,
        ownerUserId, terrainMap, combatConfig, allUnits: units, killedThisBatch,
        postureId: evaluation.posture.id,
      })
      break
    }
  }

  await insertOrderTriggeredLog(admin, gameId, orderActor, currentTurn, event)
}

interface FireCombatParams {
  admin: SupabaseClient
  gameId: string
  attacker: UnitState
  defender: UnitState
  currentTurn: number
  ownerUserId: string
  terrainMap: Map<string, TerrainType>
  combatConfig: CombatConfig
  allUnits: ReadonlyArray<UnitState>
  killedThisBatch: Set<string>
  postureId: string
}

/**
 * Phase 3.3 — Applique le combat d'un ordre `fire` (mode "alerte").
 *
 * Modèle calqué sur handleAttack.ts (resolve_action) mais simplifié :
 *  - pas de pré-validation (déjà faite par evaluateOrders : cohesion/has_attacked/visibilité).
 *  - pas de check LoS ici (pickFireTarget l'a déjà fait en sélectionnant la cible).
 *  - phase auto-détectée par resolveCombat selon `distance` :
 *      * distance > 1 → 'ranged' (archer/artillerie, pas de riposte).
 *      * distance == 1 → 'melee' (infanterie en alerte → riposte du défenseur s'applique).
 *  - Coût d'alerte : −1 morale supplémentaire à l'attaquant (placeholder en attendant
 *    un vrai système d'endurance Phase 5 — voir backlog).
 *  - Si melee non-mortelle : INSERT engagement Phase 2.6 (paire triée invariant unit_a < unit_b).
 *  - INSERT game_actions(attack_melee | attack_ranged) avec actor_user_id = owner du pion
 *    → useCombatNotifications attribue correctement isMyAttack côté Realtime (les 2 joueurs voient).
 */
async function applyFireOrderCombat(p: FireCombatParams): Promise<void> {
  const { admin, gameId, attacker, defender, currentTurn, ownerUserId, terrainMap, combatConfig, allUnits, killedThisBatch, postureId } = p

  const attackerSupport = computeSupport(attacker, allUnits)
  const defenderSupport = computeSupport(defender, allUnits)
  const attackerTerrain = terrainMap.get(cubeKey(attacker.position)) ?? DEFAULT_TERRAIN
  const defenderTerrain = terrainMap.get(cubeKey(defender.position)) ?? DEFAULT_TERRAIN
  const distance = cubeDistance(attacker.position, defender.position)

  const seed = Date.now()
  const rng = seededRng(seed)

  // Phase 3.3 — lookup hold posture sur défenseur ET attaquant (pour ripost si melee).
  const [defenderOnHold, attackerOnHold] = await Promise.all([
    lookupOnHold(admin, defender.id),
    lookupOnHold(admin, attacker.id),
  ])

  const { result: combat, ripost } = resolveCombat({
    attacker, defender,
    attackerTerrain, defenderTerrain,
    distance,
    rng,
    config: combatConfig,
    attackerSupport, defenderSupport,
    attackerOnHold,
    defenderOnHold,
  })

  // Phase 3.3 — état attaquant post-riposte (cohérent handleAttack.ts l153-182).
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

  // Phase 3.3 — coût d'alerte : −1 morale supplémentaire à l'attaquant.
  // Placeholder : à remplacer par consommation d'endurance Phase 5.
  attackerMoraleAfter = Math.max(0, attackerMoraleAfter - 1)

  const defenderKilled = combat.defenderKilled
  const defenderKilledStat = defender.killed + combat.killed

  // Update défenseur
  if (defenderKilled) {
    killedThisBatch.add(defender.id)
    const { error } = await admin.from('units').delete().eq('id', defender.id).eq('game_id', gameId)
    if (error) console.warn('[applyFireOrderCombat] defender delete failed:', error.message)
  } else {
    const { error } = await admin
      .from('units')
      .update({
        hp: combat.defenderHpAfter,
        wounded: combat.defenderWoundedAfter,
        effective: combat.defenderEffectiveAfter,
        killed: defenderKilledStat,
        morale: defenderMoraleAfter,
        routed: defenderRoutedAfter,
      })
      .eq('id', defender.id)
      .eq('game_id', gameId)
    if (error) console.warn('[applyFireOrderCombat] defender update failed:', error.message)
  }

  // Update attaquant
  if (attackerKilled) {
    killedThisBatch.add(attacker.id)
    const { error } = await admin.from('units').delete().eq('id', attacker.id).eq('game_id', gameId)
    if (error) console.warn('[applyFireOrderCombat] attacker delete failed:', error.message)
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
      .eq('id', attacker.id)
      .eq('game_id', gameId)
    if (error) console.warn('[applyFireOrderCombat] attacker update failed:', error.message)
  }

  // INSERT game_actions avec action_type dynamique selon phase résolue.
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
  const { error: actErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: ownerUserId,
    action_type: actionType,
    payload: { unit_id: attacker.id, target_unit_id: defender.id, order_posture_id: postureId },
    result,
    seed,
  })
  if (actErr) console.warn('[applyFireOrderCombat] game_actions insert failed:', actErr.message)

  // Phase 2.6 — engagement créé si melee non-mortelle bilatérale (cohérent handleAttack l296-304).
  if (combat.attackPhase === 'melee' && !defenderKilled && !attackerKilled) {
    const [a, b] = [attacker.id, defender.id].sort()
    const { error: engErr } = await admin
      .from('engagements')
      .insert({ game_id: gameId, unit_a_id: a, unit_b_id: b, started_turn: currentTurn })
    if (engErr && !engErr.message.includes('duplicate')) {
      console.warn('[applyFireOrderCombat] engagement insert failed:', engErr.message)
    }
  }
}

async function insertOrderTriggeredLog(
  admin: SupabaseClient,
  gameId: string,
  actorUserId: string,
  turn: number,
  event: OrderTriggeredEvent,
): Promise<void> {
  const { error } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn,
    actor_user_id: actorUserId,
    action_type: 'order_triggered',
    payload: {
      posture_id: event.posture_id,
      unit_id: event.unit_id,
      resolved_action: event.resolved_action,
      target_unit_id: event.target_unit_id,
      skipped: event.skipped,
    },
    result: event,
    seed: Date.now(),
  })
  if (error) {
    console.warn('[insertOrderTriggeredLog] insert failed:', error.message)
  }
}

interface ChargeCombatParams {
  admin: SupabaseClient
  gameId: string
  attacker: UnitState
  defender: UnitState
  currentTurn: number
  ownerUserId: string
  terrainMap: Map<string, TerrainType>
  combatConfig: CombatConfig
  allUnits: ReadonlyArray<UnitState>
  killedThisBatch: Set<string>
  postureId: string
  /** Hex adjacent au défenseur où l'attaquant arrive en charge (null si déjà adjacent). */
  destHex: Cube | null
  positionCache: Map<string, Cube>
}

/**
 * Phase 3.3-bis — Applique le combat d'un ordre `charge` avec déplacement + dégâts réels.
 *
 * Pipeline :
 *  - Si destHex fourni : déplacer attaquant + flag has_moved (UPDATE units position).
 *  - Synthétiser un attackerPath = cubeLineDraw(origPos, destHex) pour activer
 *    chargeMult cav si path ≥ 3 hex en ligne droite.
 *  - resolveCombat (phase auto : 'charge' si cav + path éligible, sinon 'melee').
 *  - Appliquer dégâts défenseur + ripost si melee non-mortelle, identique à applyFireOrderCombat.
 *  - Coût d'effort : −1 morale attaquant (consistance mode alerte).
 *  - INSERT engagement si survivants mêlée.
 */
async function applyChargeOrderCombat(p: ChargeCombatParams): Promise<void> {
  const {
    admin, gameId, attacker, defender, currentTurn, ownerUserId, terrainMap, combatConfig,
    allUnits, killedThisBatch, postureId, destHex, positionCache,
  } = p

  // 1. Déplacement attaquant si destHex fourni (charge avec move).
  const origPos = attacker.position
  const finalPos = destHex ?? origPos
  if (destHex) {
    const { error: posErr } = await admin
      .from('units')
      .update({ q: destHex.q, r: destHex.r, has_moved: true })
      .eq('id', attacker.id)
      .eq('game_id', gameId)
    if (posErr) {
      console.warn('[applyChargeOrderCombat] move update failed:', posErr.message)
      return
    }
    positionCache.set(attacker.id, destHex)
  }

  // 2. Path synthétique pour détection charge cav (ligne droite orig → final).
  //    isPathStraight + length ≥ 3 → chargeMult > 1.0. Sinon resolveCombat retombe en 'melee'.
  const attackerPath = cubeLineDraw(origPos, finalPos)
  const attackerPathTerrain = attackerPath.map(c => terrainMap.get(cubeKey(c)) ?? DEFAULT_TERRAIN)

  // 3. Reconstruire un UnitState attaquant post-move (la position a changé).
  const attackerPostMove: UnitState = { ...attacker, position: finalPos }

  const attackerSupport = computeSupport(attackerPostMove, allUnits)
  const defenderSupport = computeSupport(defender, allUnits)
  const attackerTerrain = terrainMap.get(cubeKey(finalPos)) ?? DEFAULT_TERRAIN
  const defenderTerrain = terrainMap.get(cubeKey(defender.position)) ?? DEFAULT_TERRAIN
  const distance = cubeDistance(finalPos, defender.position)

  const seed = Date.now()
  const rng = seededRng(seed)

  const [defenderOnHold, attackerOnHold] = await Promise.all([
    lookupOnHold(admin, defender.id),
    lookupOnHold(admin, attacker.id),
  ])

  const { result: combat, ripost } = resolveCombat({
    attacker: attackerPostMove, defender,
    attackerTerrain, defenderTerrain,
    distance,
    attackerPath, attackerPathTerrain,
    rng,
    config: combatConfig,
    attackerSupport, defenderSupport,
    attackerOnHold,
    defenderOnHold,
  })

  // 4. Application des résultats (mirror applyFireOrderCombat).
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

  // Coût d'effort : −1 morale attaquant.
  attackerMoraleAfter = Math.max(0, attackerMoraleAfter - 1)

  const defenderKilled = combat.defenderKilled
  const defenderKilledStat = defender.killed + combat.killed

  // Update défenseur
  if (defenderKilled) {
    killedThisBatch.add(defender.id)
    const { error } = await admin.from('units').delete().eq('id', defender.id).eq('game_id', gameId)
    if (error) console.warn('[applyChargeOrderCombat] defender delete failed:', error.message)
  } else {
    const { error } = await admin
      .from('units')
      .update({
        hp: combat.defenderHpAfter,
        wounded: combat.defenderWoundedAfter,
        effective: combat.defenderEffectiveAfter,
        killed: defenderKilledStat,
        morale: defenderMoraleAfter,
        routed: defenderRoutedAfter,
      })
      .eq('id', defender.id)
      .eq('game_id', gameId)
    if (error) console.warn('[applyChargeOrderCombat] defender update failed:', error.message)
  }

  // Update attaquant (has_attacked + hp/morale post-ripost si applicable)
  if (attackerKilled) {
    killedThisBatch.add(attacker.id)
    const { error } = await admin.from('units').delete().eq('id', attacker.id).eq('game_id', gameId)
    if (error) console.warn('[applyChargeOrderCombat] attacker delete failed:', error.message)
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
      .eq('id', attacker.id)
      .eq('game_id', gameId)
    if (error) console.warn('[applyChargeOrderCombat] attacker update failed:', error.message)
  }

  // INSERT game_actions (action_type = attack_melee — résolveCombat différencie via combat.attackPhase).
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
  const { error: actErr } = await admin.from('game_actions').insert({
    game_id: gameId,
    turn: currentTurn,
    actor_user_id: ownerUserId,
    action_type: actionType,
    payload: { unit_id: attacker.id, target_unit_id: defender.id, order_posture_id: postureId, charge: true },
    result,
    seed,
  })
  if (actErr) console.warn('[applyChargeOrderCombat] game_actions insert failed:', actErr.message)

  // Engagement si melee non-mortelle bilatérale.
  if (combat.attackPhase !== 'ranged' && !defenderKilled && !attackerKilled) {
    const [a, b] = [attacker.id, defender.id].sort()
    const { error: engErr } = await admin
      .from('engagements')
      .insert({ game_id: gameId, unit_a_id: a, unit_b_id: b, started_turn: currentTurn })
    if (engErr && !engErr.message.includes('duplicate')) {
      console.warn('[applyChargeOrderCombat] engagement insert failed:', engErr.message)
    }
  }
}
