// v1.0 (08/05/2026) — Types Lobby Lot 4 : Game, GamePlayer + literals + helpers
// Source de verite : migration 003_lobby_columns.sql

// ----------------------------------------------------------------------------
// Types literaux (alignes sur les CHECK constraints SQL)
// ----------------------------------------------------------------------------

export type GameStatus = 'lobby' | 'briefing' | 'in_progress' | 'finished' | 'abandoned'

export type GameMode = 'casual' | 'ranked'

export type Scale = 'tactical' | 'operational' | 'strategic'

export type Team = 'blue' | 'red'

export type PlayerRole = 'general' | 'commander'

export type BotDifficulty = 'easy' | 'medium' | 'hard'

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
