// v1.0 (09/05/2026) — Phase 1 L1B.2 : types partages EF
// Aligne sur src/types/game.ts cote client.

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

export const ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  NOT_HOST: 'NOT_HOST',
  NOT_LOBBY: 'NOT_LOBBY',
  NOT_ENOUGH_PLAYERS: 'NOT_ENOUGH_PLAYERS',
  INVALID_SCENARIO: 'INVALID_SCENARIO',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INTERNAL: 'INTERNAL',
} as const
