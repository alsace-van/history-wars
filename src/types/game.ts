// v1.1 (09/05/2026) — L1C.2 : ajout Game.state JSONB + GameState/GameStateTactical (Phase 1)
// v1.0a (09/05/2026) — Ajout UnitKind pour Lot 6 (placeholders unites)
// v1.0 (08/05/2026) — Types Lobby Lot 4 : Game, GamePlayer + literals + helpers
// Source de verite : migration 003_lobby_columns.sql + 007_phase1_units_and_actions.sql

// ----------------------------------------------------------------------------
// Types literaux (alignes sur les CHECK constraints SQL)
// ----------------------------------------------------------------------------

export type GameStatus = 'lobby' | 'briefing' | 'in_progress' | 'finished' | 'abandoned'

export type GameMode = 'casual' | 'ranked'

export type Scale = 'tactical' | 'operational' | 'strategic'

export type Team = 'blue' | 'red'

export type PlayerRole = 'general' | 'commander'

export type BotDifficulty = 'easy' | 'medium' | 'hard'

/**
 * Type d'unite militaire.
 *   I = Infanterie
 *   C = Cavalerie
 *   A = Artillerie
 * Phase 0 : utilise par UnitPlaceholder (lettre affichee).
 * Phase 1+ : sera utilise par la table BDD `units`.
 */
export type UnitKind = 'I' | 'C' | 'A'

// ----------------------------------------------------------------------------
// Constantes de jeu (pas de hardcode dans le reste du code)
// ----------------------------------------------------------------------------

export const MAX_PLAYERS_DEFAULT = 4
export const MAX_PLAYERS_MIN = 2
export const MAX_PLAYERS_MAX = 8

export const DEFAULT_SCENARIO_ID = 'mvp-plaine'
export const DEFAULT_SCALE: Scale = 'tactical'
export const DEFAULT_MODE: GameMode = 'casual'

// ----------------------------------------------------------------------------
// Modeles BDD (1:1 avec les colonnes Supabase apres migration 003)
// ----------------------------------------------------------------------------

/** Sous-etat tactique stocke dans games.state (migration 007). */
export interface GameStateTactical {
  phase?: 'orders' | 'resolving' | 'review'
  boardRadius?: number
  currentTurn?: number
  activeTeam?: Team
  scenarioId?: string
  /** L1B.4c : equipe gagnante quand status='finished'. null tant qu'en cours. */
  winner?: Team | null
}

/**
 * games.state JSONB. Initialise a {} avant start_battle, puis enrichi.
 * version pour migrations futures (D11). Sous-etats par echelle.
 */
export interface GameState {
  version?: number
  tactical?: GameStateTactical
  // operational?: ... (Phase 8)
  // strategic?: ... (Phase 9)
}

export interface Game {
  id: string
  created_at: string
  created_by: string
  name: string
  status: GameStatus
  current_scale: Scale
  turn_number: number
  mode: GameMode
  is_private: boolean
  invite_code: string | null
  last_action_at: string
  max_players: number
  scenario_id: string | null
  state: GameState
}

export interface GamePlayer {
  id: string
  game_id: string
  user_id: string | null
  joined_at: string
  team: Team | null
  role: PlayerRole
  slot_index: number | null
  is_bot: boolean
  bot_difficulty: BotDifficulty | null
}

// ----------------------------------------------------------------------------
// Modeles enrichis (joints cote client)
// ----------------------------------------------------------------------------

export interface GameWithPlayers extends Game {
  players: GamePlayerWithProfile[]
}

export interface GamePlayerWithProfile extends GamePlayer {
  username: string | null
}

// ----------------------------------------------------------------------------
// Helpers de derivation
// ----------------------------------------------------------------------------

export function isHost(game: Game, userId: string | null | undefined): boolean {
  return !!userId && game.created_by === userId
}

export function isPlayerInGame(
  players: Pick<GamePlayer, 'user_id'>[],
  userId: string | null | undefined
): boolean {
  if (!userId) return false
  return players.some(p => p.user_id === userId)
}

export function freeSlotsCount(game: Pick<Game, 'max_players'>, playersCount: number): number {
  return Math.max(0, game.max_players - playersCount)
}

export function isGameFull(game: Pick<Game, 'max_players'>, playersCount: number): boolean {
  return playersCount >= game.max_players
}

/**
 * Calcule le prochain slot_index libre pour une partie.
 * Strategie MVP Phase 0 : on alterne blue/red, general puis commander.
 *   slot 0 -> blue/general (host)
 *   slot 1 -> red/general
 *   slot 2 -> blue/commander
 *   slot 3 -> red/commander
 *   etc.
 */
export function nextFreeSlot(takenSlots: number[], maxPlayers: number): number | null {
  for (let i = 0; i < maxPlayers; i++) {
    if (!takenSlots.includes(i)) return i
  }
  return null
}

/**
 * Derive team + role d'un slot_index selon la convention MVP.
 * Pair = blue, impair = red.
 * Premier de chaque equipe = general, suivants = commanders.
 */
export function deriveSlotAssignment(slotIndex: number): { team: Team; role: PlayerRole } {
  const team: Team = slotIndex % 2 === 0 ? 'blue' : 'red'
  // 0 et 1 = general (premier de chaque equipe), 2+ = commander
  const role: PlayerRole = slotIndex < 2 ? 'general' : 'commander'
  return { team, role }
}
