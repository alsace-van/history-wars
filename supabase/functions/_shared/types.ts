// v2.0 (10/05/2026) — Phase 2 2C.2 : ActionType etendu split_unit/merge_unit + AttackResultV2 + payloads + error codes
// v1.2 (09/05/2026) — Phase 1 L1B.4a : ajout AttackPayload/Result + EndTurn* + INVALID_TARGET, GAME_FINISHED
// v1.1 (09/05/2026) — Phase 1 L1B.3 : ajout ActionPayload + ERROR_CODES resolve_action
// v1.0 (09/05/2026) — Phase 1 L1B.2 : types partages EF (initial)

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

export type ActionType = 'move' | 'attack_ranged' | 'attack_melee' | 'split_unit' | 'merge_unit'

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
// Phase 1 L1B.4c — End turn
// ----------------------------------------------------------------------------

/** Body POST resolve_turn. */
export interface EndTurnBody {
  game_id: string
  client_action_id: string | null
  scale: Scale
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
  // generique
  INTERNAL: 'INTERNAL',
} as const
