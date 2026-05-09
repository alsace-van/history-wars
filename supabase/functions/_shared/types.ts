// v1.1 (09/05/2026) — Phase 1 L1B.3 : ajout ActionPayload + ERROR_CODES resolve_action
// v1.0 (09/05/2026) — Phase 1 L1B.2 : types partages EF (initial)

export type Team = 'blue' | 'red'
export type UnitKind = 'I' | 'C' | 'A'
export type GameStatus = 'lobby' | 'briefing' | 'in_progress' | 'finished' | 'abandoned'
export type TacticalPhase = 'orders' | 'resolving' | 'review'

/**
 * Forme du JSONB games.state apres start_battle.
 * version: 1 (D11) → robustesse migrations.
 */
export interface GameStateV1 {
  version: 1
  tactical: {
    phase: TacticalPhase
    boardRadius: number
    currentTurn: number
    activeTeam: Team
    scenarioId: string
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
// Phase 1 L1B.3 — Action types & payloads
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
  // generique
  INTERNAL: 'INTERNAL',
} as const
