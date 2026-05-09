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

export type ActionType = 'move' | 'attack_ranged' | 'attack_melee'

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

/** Resultat brut engine, dupliqué cote client (engine/combat/types). */
export interface CombatResultSnapshot {
  damageDealt: number
  defenderHpAfter: number
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
 */
export interface AttackResult {
  attacker_id: string
  defender_id: string
  kind: 'melee' | 'ranged'
  combat: CombatResultSnapshot
  riposte: CombatResultSnapshot | null
  defender_killed: boolean
  attacker_killed: boolean
  attacker_after: { hp: number; morale: number; routed: boolean; has_attacked: true } | null
  defender_after: { hp: number; morale: number; routed: boolean } | null
  seed: number
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
  // generique
  INTERNAL: 'INTERNAL',
} as const
