// v1.0 (08/05/2026) — Hook CRUD parties Lobby : list, create, join, leave, kick, delete
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@lib/supabase'
import {
  type Game,
  type GamePlayer,
  type GameWithPlayers,
  type GamePlayerWithProfile,
  DEFAULT_SCALE,
  DEFAULT_MODE,
  DEFAULT_SCENARIO_ID,
  MAX_PLAYERS_DEFAULT,
  deriveSlotAssignment,
  nextFreeSlot
} from '@/types/game'

const TAG = '[useGames v1.0]'

interface CreateGameParams {
  name: string
  maxPlayers?: number
}

interface ActionResult {
  error: string | null
}

interface CreateResult extends ActionResult {
  gameId: string | null
}

export interface UseGamesResult {
  games: GameWithPlayers[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createGame: (params: CreateGameParams) => Promise<CreateResult>
  joinGame: (gameId: string) => Promise<ActionResult>
  leaveGame: (gameId: string) => Promise<ActionResult>
  kickPlayer: (playerId: string) => Promise<ActionResult>
  deleteGame: (gameId: string) => Promise<ActionResult>
}

export function useGames(currentUserId: string | null | undefined): UseGamesResult {
  const [games, setGames] = useState<GameWithPlayers[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return

    setError(null)

    try {
      // 1. Parties visibles (RLS gere le filtre : lobby publiques OU mes parties)
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (gamesError) throw gamesError
      const safeGames: Game[] = gamesData ?? []

      if (safeGames.length === 0) {
        if (mountedRef.current) {
          setGames([])
          setLoading(false)
        }
        return
      }

      const gameIds = safeGames.map(g => g.id)

      // 2. Players de ces parties
      const { data: playersData, error: playersError } = await supabase
        .from('game_players')
        .select('*')
        .in('game_id', gameIds)

      if (playersError) throw playersError
      const safePlayers: GamePlayer[] = playersData ?? []

      // 3. Profils des players (pour afficher username)
      const userIds = Array.from(
        new Set(safePlayers.map(p => p.user_id).filter((id): id is string => !!id))
      )

      const profilesMap = new Map<string, string>()
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds)

        if (profilesError) throw profilesError
        for (const p of profilesData ?? []) {
          profilesMap.set(p.id, p.username)
        }
      }

      // 4. Compose
      const composed: GameWithPlayers[] = safeGames.map(g => {
        const players: GamePlayerWithProfile[] = safePlayers
          .filter(p => p.game_id === g.id)
          .map(p => ({
            ...p,
            username: p.user_id ? profilesMap.get(p.user_id) ?? null : null
          }))
        return { ...g, players }
      })

      if (mountedRef.current) {
        setGames(composed)
        setLoading(false)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement'
      // eslint-disable-next-line no-console
      console.error(TAG, 'refresh failed', e)
      if (mountedRef.current) {
        setError(msg)
        setLoading(false)
      }
    }
  }, [])

  // Initial load
  useEffect(() => {
    void refresh()
  }, [refresh])

  const createGame = useCallback(
    async ({ name, maxPlayers = MAX_PLAYERS_DEFAULT }: CreateGameParams): Promise<CreateResult> => {
      if (!currentUserId) return { gameId: null, error: 'Non authentifie' }
      const trimmed = name.trim()
      if (!trimmed) return { gameId: null, error: 'Le nom est obligatoire' }

      // 1. Insert game
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert({
          name: trimmed,
          created_by: currentUserId,
          status: 'lobby',
          current_scale: DEFAULT_SCALE,
          mode: DEFAULT_MODE,
          scenario_id: DEFAULT_SCENARIO_ID,
          max_players: maxPlayers
        })
        .select()
        .single<Game>()

      if (gameError || !gameData) {
        return { gameId: null, error: gameError?.message ?? 'Echec creation' }
      }

      // 2. Insert l'hote en slot 0 (general bleu)
      const { team, role } = deriveSlotAssignment(0)
      const { error: playerError } = await supabase.from('game_players').insert({
        game_id: gameData.id,
        user_id: currentUserId,
        team,
        role,
        slot_index: 0,
        is_bot: false
      })

      if (playerError) {
        // rollback
        await supabase.from('games').delete().eq('id', gameData.id)
        return { gameId: null, error: 'Echec initialisation : ' + playerError.message }
      }

      await refresh()
      return { gameId: gameData.id, error: null }
    },
    [currentUserId, refresh]
  )

  const joinGame = useCallback(
    async (gameId: string): Promise<ActionResult> => {
      if (!currentUserId) return { error: 'Non authentifie' }

      // Récupère slots pris + max_players en 1 round-trip groupe
      const [{ data: existing, error: fetchError }, { data: gameData, error: gameError }] =
        await Promise.all([
          supabase.from('game_players').select('slot_index').eq('game_id', gameId),
          supabase.from('games').select('max_players, status').eq('id', gameId).single<{ max_players: number; status: string }>()
        ])

      if (fetchError) return { error: fetchError.message }
      if (gameError || !gameData) return { error: gameError?.message ?? 'Partie introuvable' }
      if (gameData.status !== 'lobby') return { error: 'La partie a deja demarre' }

      const taken = (existing ?? [])
        .map(p => p.slot_index)
        .filter((s): s is number => s !== null)

      const slotIndex = nextFreeSlot(taken, gameData.max_players)
      if (slotIndex === null) return { error: 'Partie pleine' }

      const { team, role } = deriveSlotAssignment(slotIndex)
      const { error: insertError } = await supabase.from('game_players').insert({
        game_id: gameId,
        user_id: currentUserId,
        team,
        role,
        slot_index: slotIndex,
        is_bot: false
      })

      if (insertError) return { error: insertError.message }

      await refresh()
      return { error: null }
    },
    [currentUserId, refresh]
  )

  const leaveGame = useCallback(
    async (gameId: string): Promise<ActionResult> => {
      if (!currentUserId) return { error: 'Non authentifie' }
      const { error: delError } = await supabase
        .from('game_players')
        .delete()
        .eq('game_id', gameId)
        .eq('user_id', currentUserId)

      if (delError) return { error: delError.message }
      await refresh()
      return { error: null }
    },
    [currentUserId, refresh]
  )

  const kickPlayer = useCallback(
    async (playerId: string): Promise<ActionResult> => {
      const { error: delError } = await supabase
        .from('game_players')
        .delete()
        .eq('id', playerId)

      if (delError) return { error: delError.message }
      await refresh()
      return { error: null }
    },
    [refresh]
  )

  const deleteGame = useCallback(
    async (gameId: string): Promise<ActionResult> => {
      const { error: delError } = await supabase.from('games').delete().eq('id', gameId)
      if (delError) return { error: delError.message }
      await refresh()
      return { error: null }
    },
    [refresh]
  )

  return {
    games,
    loading,
    error,
    refresh,
    createGame,
    joinGame,
    leaveGame,
    kickPlayer,
    deleteGame
  }
}
