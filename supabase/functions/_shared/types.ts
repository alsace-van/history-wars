// v2.2 (11/05/2026) — Phase 2.6 Vague B : ActionType etendu break_combat + payload + error codes engagement
// v2.1 (11/05/2026) — Phase 2.5 B : ActionType etendu retreat/surrender/suicide_attack + payloads + error codes cohésion
// v2.0 (10/05/2026) — Phase 2 2C.2 : ActionType etendu split_unit/merge_unit + AttackResultV2 + payloads + error codes
// v1.2 (09/05/2026) — Phase 1 L1B.4a : ajout AttackPayload/Result + EndTurn* + INVALID_TARGET, GAME_FINISHED

export type Team = 'blue' | 'red'
export type UnitKind = 'I' | 'C' | 'A'
export type GameStatus = 'lobby' | 'briefing' | 'in_progress' | 'finished' | 'abandoned'
export type TacticalPhase = 'orders' | 'resolving' | 'review'
export type Scale = 'tactical' | 'operational' | 'strategic'

/**
 * Forme du JSONB games.state apres start_battle.
 * version: 1 (D11) → robustesse migrations.
 * winner: ajoute L1B.4c, null tant que partie en cours.
 */
export interface GameStateV1 {
  version: 1
  tactical: {
    phase: TacticalPhase
    boardRadius: number
    currentTurn: number
    activeTeam: Team
    scenarioId: string
    winner?: Team | null
  }
}

/** Position cubique (s = -q-r), stockee axial cote BDD. */
export interface UnitPlacement {
  team: Team
  kind: UnitKind
  q: number
  r: number
}

// ----------------------------------------------------------------------------
// Phase 1 L1B.3 — Action types & payloads (move)
// ----------------------------------------------------------------------------

export type ActionType =
  | 'move'
  | 'attack_ranged'
  | 'attack_melee'
  | 'split_unit'
  | 'merge_unit'
  // Phase 2.5 — actions critiques unité Brisée
  | 'retreat'
  | 'surrender'
  | 'suicide_attack'
  // Phase 2.6 — rupture volontaire d'engagement persistant
  | 'break_combat'

export interface MovePayload {
  unit_id: string
  dest_q: number
  dest_r: number
}

/**
 * Snapshot D13 stocke dans game_actions.result pour move.
 * Prepare Phase 11 replays : un replay peut rejouer sans recalculer l'engine.
 */
export interface MoveResult {
  from: { q: number; r: number }
  to: { q: number; r: number }
  cost: number
  snapshot: {
    unit_id: string
    q: number
    r: number
    has_moved: boolean
  }
}

/** Forme attendue du body POST resolve_action. */
export interface ResolveActionBody {
  game_id: string
  client_action_id: string | null
  action: {
    type: ActionType
    payload: unknown
  }
}

// ----------------------------------------------------------------------------
// Phase 1 L1B.4 — Attack payloads & results (combat)
// ----------------------------------------------------------------------------

/** Payload commun aux 2 types d'attaque (ranged + melee). */
export interface AttackPayload {
  unit_id: string         // attacker
  target_unit_id: string  // defender
}

/** Resultat brut engine, dupliqué cote client (engine/combat/types).
 * v1.1 (Phase 1.5) : ajout actualDamage, killed, woundedAdd, defenderWoundedAfter. */
export interface CombatResultSnapshot {
  damageDealt: number
  actualDamage: number
  killed: number
  woundedAdd: number
  defenderHpAfter: number
  defenderWoundedAfter: number
  attackerMoraleDelta: number
  defenderMoraleDelta: number
  attackerMoraleAfter: number
  defenderMoraleAfter: number
  attackerRouted: boolean
  defenderRouted: boolean
  defenderKilled: boolean
  rollUsed: number
}

/**
 * Snapshot D13 stocke dans game_actions.result pour attaques.
 * Replay-ready : tout l'etat post-action est present.
 * v1.1 (Phase 1.5) : attacker_after / defender_after exposent aussi `wounded`.
 */
export interface AttackResult {
  attacker_id: string
  defender_id: string
  kind: 'melee' | 'ranged'
  combat: CombatResultSnapshot
  riposte: CombatResultSnapshot | null
  defender_killed: boolean
  attacker_killed: boolean
  attacker_after: { hp: number; wounded: number; morale: number; routed: boolean; has_attacked: true } | null
  defender_after: { hp: number; wounded: number; morale: number; routed: boolean } | null
  seed: number
}

// ----------------------------------------------------------------------------
// Phase 2 v2 — Combat etendu (effectif, phase, breakdown)
// ----------------------------------------------------------------------------

export type AttackPhase = 'melee' | 'ranged' | 'charge'

export interface BonusBreakdownEntry {
  label: string
  multiplier: number
  appliedTo: 'attacker' | 'defender'
}

/**
 * Snapshot resultat combat v2 (mirror engine/combat/v2/types.ts CombatResultV2).
 * Etend CombatResultSnapshot v1 avec champs effectif + breakdown.
 */
export interface CombatResultSnapshotV2 extends CombatResultSnapshot {
  attackPhase: AttackPhase
  attackerEffectiveBefore: number
  attackerEffectiveAfter: number
  defenderEffectiveBefore: number
  defenderEffectiveAfter: number
  menEngagedAttacker: number
  menEngagedDefender: number
  contactCap: number
  bonusBreakdown: ReadonlyArray<BonusBreakdownEntry>
  chargeBonusApplied: boolean
}

/**
 * AttackResult v2 : combat avec champs Phase 2 + retours UI riches.
 * Conserve compatibilite v1 sur les champs hp/morale/routed.
 */
export interface AttackResultV2 {
  attacker_id: string
  defender_id: string
  /** Phase d'attaque resolue (peut differer de la kind demandee : 'melee' demande peut devenir 'charge'). */
  kind: AttackPhase
  combat: CombatResultSnapshotV2
  riposte: CombatResultSnapshotV2 | null
  defender_killed: boolean
  attacker_killed: boolean
  attacker_after: {
    hp: number
    wounded: number
    morale: number
    routed: boolean
    has_attacked: true
    effective: number
    killed: number
  } | null
  defender_after: {
    hp: number
    wounded: number
    morale: number
    routed: boolean
    effective: number
    killed: number
  } | null
  seed: number
}

// ----------------------------------------------------------------------------
// Phase 2 v2 — Sizing (split / merge)
// ----------------------------------------------------------------------------

/** Body POST resolve_action — payload pour split_unit. */
export interface SplitPayload {
  unit_id: string
  target_q: number
  target_r: number
  ratio: 'half' | 'three_quarter' | 'nine_one'
}

export interface SplitResult {
  source_id: string
  new_unit_id: string
  ratio: 'half' | 'three_quarter' | 'nine_one'
  source_after: {
    effective: number
    wounded: number
    killed: number
    hp: number
    has_moved: true
    has_attacked: true
  }
  new_unit: {
    id: string
    q: number
    r: number
    effective: number
    wounded: number
    killed: number
    hp: number
  }
}

export interface MergePayload {
  target_unit_id: string
  source_unit_id: string
}

export interface MergeResult {
  target_id: string
  source_id_deleted: string
  target_after: {
    effective: number
    effectiveMax: number
    effectiveMin: number
    wounded: number
    killed: number
    hp: number
    hpMax: number
    morale: number
    routed: boolean
    has_moved: true
    has_attacked: true
  }
}

// ----------------------------------------------------------------------------
// Phase 2.5 — Actions critiques unité Brisée (cohésion ≤ 0.2)
// ----------------------------------------------------------------------------

/** Retraite volontaire vers 1 hex voisin choisi (case libre in-board). */
export interface RetreatPayload {
  unit_id: string
  dest_q: number
  dest_r: number
}

export interface RetreatResult {
  unit_id: string
  from: { q: number; r: number }
  to: { q: number; r: number }
  /** Hommes désertés pendant la retraite (>=0). Si pertes < 50% → 0. */
  desertion: number
  /** True si l'unité a été dissoute (effective post-désertion < effectiveMin). */
  dissolved: boolean
  /** État post-retraite. null si dissolved=true. */
  unit_after: {
    q: number
    r: number
    effective: number
    killed: number
    has_moved: true
    has_attacked: true
  } | null
}

/** Reddition (capitulation) volontaire ou forcée. Unité éliminée. */
export interface SurrenderPayload {
  unit_id: string
}

export interface SurrenderResult {
  unit_id_deleted: string
  /** Liste des id des unités du camp adverse dont le moral a augmenté (+10). */
  enemy_units_morale_boosted: string[]
  /** Liste des id des unités du camp qui se rend dont le moral a baissé (-10). */
  ally_units_morale_lowered: string[]
}

/** Combat suicide (Thermopyle). Attaquant éliminé après l'attaque, pas de riposte, ×1.5 dégâts. */
export interface SuicidePayload {
  unit_id: string
  target_unit_id: string
}

export interface SuicideResult {
  attacker_id_deleted: string
  target_id: string
  combat: CombatResultSnapshotV2
  target_killed: boolean
  /** -5 moral sur toutes les unités camp adverse (impressionnées par la résistance). */
  enemy_units_morale_lowered: string[]
  seed: number
}

// ----------------------------------------------------------------------------
// Phase 2.6 — Engagement persistant (combat continu)
// ----------------------------------------------------------------------------

/**
 * Rupture volontaire de tous les engagements d'une unité.
 * Coût fixe 10 % effective (cf. docs/PLAN-ENGAGEMENT-PERSISTENT.md § 3, 11.3).
 */
export interface BreakCombatPayload {
  unit_id: string
}

// ----------------------------------------------------------------------------
// Phase 3.2 — Pré-postures / ordres conditionnels (table unit_orders, EF submit_orders)
// ----------------------------------------------------------------------------

export type OrderTriggerKindDTO = 'on_attacked' | 'enemy_in_range' | 'cohesion_broken' | 'enemy_los'
export type OrderActionKindDTO = 'charge' | 'fire' | 'retreat' | 'hold'

export interface OrderTriggerDTO {
  kind: OrderTriggerKindDTO
  params?: { range?: number }
}

export interface OrderActionDTO {
  kind: OrderActionKindDTO
  params?: Record<string, unknown>
}

/** Row brute table unit_orders (snake_case BDD, transformée côté client si besoin). */
export interface UnitOrderRow {
  id: string
  game_id: string
  unit_id: string
  owner_user_id: string
  priority: number
  trigger: OrderTriggerDTO
  action: OrderActionDTO
  active: boolean
  created_at: string
}

/**
 * Body POST EF submit_orders. Batch d'opérations CRUD pour une unité.
 *  - `create` : INSERT (priority obligatoire, libre tant que pas en conflit ; trigger/action obligatoires).
 *  - `update` : UPDATE par order_id (champs optionnels).
 *  - `delete` : DELETE par order_id.
 */
export interface SubmitOrdersBody {
  game_id: string
  unit_id: string
  operations: Array<
    | { op: 'create'; priority: number; trigger: OrderTriggerDTO; action: OrderActionDTO; active?: boolean }
    | { op: 'update'; order_id: string; priority?: number; trigger?: OrderTriggerDTO; action?: OrderActionDTO; active?: boolean }
    | { op: 'delete'; order_id: string }
  >
}

export interface SubmitOrdersResult {
  ok: true
  orders: UnitOrderRow[]
}

/**
 * Log d'un ordre déclenché lors de resolve_turn (sauvegardé dans game_actions
 * avec action_type='order_triggered' pour replay + UI rapport).
 */
export interface OrderTriggeredLog {
  unit_id: string
  posture_id: string
  resolved_action: OrderActionKindDTO
  target_unit_id?: string | null
  dest_q?: number | null
  dest_r?: number | null
  skipped?: 'broken' | 'has_moved' | 'has_attacked' | 'no_target' | 'routed' | null
}

/** Snapshot D13 stocke dans game_actions.result pour break_combat. */
export interface BreakCombatResultSnapshot {
  unit_id: string
  /** Ids des engagements supprimés (1 ou plus pour multi-engagement). */
  engagements_removed: string[]
  /** Pertes appliquées (cumul split 60/40 killed + woundedAdd). */
  losses: {
    actualDamage: number
    killed: number
    woundedAdd: number
  }
  /** État unité post-rupture (jamais null : l'unité ne dissout pas en rompant). */
  unit_after: {
    effective: number
    wounded: number
    killed: number
    hp: number
    has_moved: true
    has_attacked: true
  }
}

/**
 * Snapshot léger d'un engagement (forme BDD), retourné par les EF qui en créent
 * ou en suppriment. Utile pour replay D13 et debug.
 */
export interface EngagementSnapshot {
  id: string
  game_id: string
  unit_a_id: string
  unit_b_id: string
  started_turn: number
}

// ----------------------------------------------------------------------------
// Phase 1 L1B.4c — End turn
// ----------------------------------------------------------------------------

/** Body POST resolve_turn. */
export interface EndTurnBody {
  game_id: string
  client_action_id: string | null
  scale: Scale
}

/**
 * Phase 3.2-bis : événement de tick d'attrition d'engagement persistant émis
 * par resolve_turn pour qu'on puisse surfacer en UI (toast + DamageFloater).
 */
export interface EngagementTickEvent {
  engagement_id: string
  started_turn: number
  /** Tour AVANT bascule (= le tour pendant lequel les pertes sont infligées). */
  resolved_at_turn: number
  side_a: {
    unit_id: string
    team: Team
    kind: UnitKind
    killed: number
    wounded_add: number
    dissolved: boolean
  }
  side_b: {
    unit_id: string
    team: Team
    kind: UnitKind
    killed: number
    wounded_add: number
    dissolved: boolean
  }
  engagement_dissolved: boolean
}

/** Snapshot D13 stocke dans game_actions.result pour end_turn. */
export interface EndTurnResult {
  scale: Scale
  from_team: Team
  to_team: Team
  turn_before: number
  turn_after: number
  units_recovered_count: number
  finished: boolean
  winner: Team | null
  /** Phase 3.2 : événements d'ordres conditionnels déclenchés en début de tour entrant. */
  orders_triggered?: OrderTriggeredLog[]
  /** Phase 3.2-bis : ticks d'engagement persistant infligés pendant le tour résolu. */
  engagement_ticks?: EngagementTickEvent[]
}

/** Payload stocke dans game_actions.payload pour end_turn (utile replay). */
export interface EndTurnPayload {
  scale: Scale
}

// ----------------------------------------------------------------------------
// Error codes
// ----------------------------------------------------------------------------

export const ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  // start_battle
  NOT_HOST: 'NOT_HOST',
  NOT_LOBBY: 'NOT_LOBBY',
  NOT_ENOUGH_PLAYERS: 'NOT_ENOUGH_PLAYERS',
  INVALID_SCENARIO: 'INVALID_SCENARIO',
  // resolve_action
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  NOT_IN_GAME: 'NOT_IN_GAME',
  NOT_IN_PROGRESS: 'NOT_IN_PROGRESS',
  NOT_ORDERS_PHASE: 'NOT_ORDERS_PHASE',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  UNIT_NOT_FOUND: 'UNIT_NOT_FOUND',
  UNIT_NOT_OWNED: 'UNIT_NOT_OWNED',
  UNIT_ROUTED: 'UNIT_ROUTED',
  ALREADY_MOVED: 'ALREADY_MOVED',
  ALREADY_ATTACKED: 'ALREADY_ATTACKED',
  INVALID_MOVE: 'INVALID_MOVE',
  OUT_OF_BOARD: 'OUT_OF_BOARD',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  NO_LINE_OF_SIGHT: 'NO_LINE_OF_SIGHT',
  INVALID_TARGET: 'INVALID_TARGET',
  GAME_FINISHED: 'GAME_FINISHED',
  // Phase 2 — sizing
  EFFECTIVE_TOO_LOW: 'EFFECTIVE_TOO_LOW',
  TARGET_NOT_ADJACENT: 'TARGET_NOT_ADJACENT',
  TARGET_OCCUPIED: 'TARGET_OCCUPIED',
  HAS_ATTACKED_ALREADY: 'HAS_ATTACKED_ALREADY',
  KIND_MISMATCH: 'KIND_MISMATCH',
  TEAM_MISMATCH: 'TEAM_MISMATCH',
  UNITS_NOT_ADJACENT: 'UNITS_NOT_ADJACENT',
  EFFECTIVE_OVERFLOW: 'EFFECTIVE_OVERFLOW',
  CHARGE_NOT_ALLOWED: 'CHARGE_NOT_ALLOWED',
  // Phase 2.5 — cohésion / actions critiques
  COHESION_BROKEN: 'COHESION_BROKEN',
  COHESION_NOT_BROKEN: 'COHESION_NOT_BROKEN',
  RETREAT_NO_FREE_NEIGHBOR: 'RETREAT_NO_FREE_NEIGHBOR',
  RETREAT_DEST_NOT_ADJACENT: 'RETREAT_DEST_NOT_ADJACENT',
  RETREAT_DEST_OCCUPIED: 'RETREAT_DEST_OCCUPIED',
  SUICIDE_NOT_SURROUNDED: 'SUICIDE_NOT_SURROUNDED',
  SUICIDE_CAMP_TOO_LOW: 'SUICIDE_CAMP_TOO_LOW',
  // Phase 2.6 — engagement persistant
  NOT_ENGAGED: 'NOT_ENGAGED',
  // Phase 3.2 — pré-postures / ordres conditionnels
  ORDERS_LIMIT_EXCEEDED: 'ORDERS_LIMIT_EXCEEDED',
  INVALID_TRIGGER: 'INVALID_TRIGGER',
  INVALID_ACTION: 'INVALID_ACTION',
  INVALID_PRIORITY: 'INVALID_PRIORITY',
  PRIORITY_CONFLICT: 'PRIORITY_CONFLICT',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  // generique
  INTERNAL: 'INTERNAL',
} as const
