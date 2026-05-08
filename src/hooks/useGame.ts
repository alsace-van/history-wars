// v1.0 (08/05/2026) — Hook single game : fetch + leave + kick + delete
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@lib/supabase'
import {
  type Game,
  type GamePlayer,
  type GamePlayerWithProfile
} from '@/types/game'

const TAG = '[useGame v1.0]'

interface ActionResult {
  error: string | null
}

export interface UseGameResult {
  game: Game | null
  players: GamePlayerWithProfile[]
  loading: boolean
  notFound: boolean
  error: string | null
  refresh: () => Promise<void>
  leaveGame: () => Promise<ActionResult>
  kickPlayer: (playerId: string) => Promise<ActionResult>
  deleteGame: () => Promise<ActionResult>
}

export function useGame(
  gameId: string | undefined,
  currentUserId: string | null | undefined
): UseGameResult {
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<GamePlayerWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!gameId) {
      if (mountedRef.current) {
        setLoading(false)
        setNotFound(true)
      }
      return
    }

    setError(null)

    try {
      // 1. Game (single)
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .maybeSingle<Game>()

      if (gameError) throw gameError

      if (!gameData) {
        if (mountedRef.current) {
          setGame(null)
          setPlayers([])
          setNotFound(true)
          setLoading(false)
        }
        return
      }

      // 2. Players
      const { data: playersData, error: playersError } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', gameId)
        .order('slot_index', { ascending: true })

      if (playersError) throw playersError
      const safePlayers: GamePlayer[] = playersData ?? []

      // 3. Profils
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

      const composed: GamePlayerWithProfile[] = safePlayers.map(p => ({
        ...p,
        username: p.user_id ? profilesMap.get(p.user_id) ?? null : null
      }))

      if (mountedRef.current) {
        setGame(gameData)
        setPlayers(composed)
        setNotFound(false)
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
  }, [gameId])

  // Initial load + reload si gameId change
  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [refresh])

  const leaveGame = useCallback(async (): Promise<ActionResult> => {
    if (!gameId || !currentUserId) return { error: 'Non authentifie' }
    const { error: delError } = await supabase
      .from('game_players')
      .delete()
      .eq('game_id', gameId)
      .eq('user_id', currentUserId)

    if (delError) return { error: delError.message }
    return { error: null }
  }, [gameId, currentUserId])

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

  const deleteGame = useCallback(async (): Promise<ActionResult> => {
    if (!gameId) return { error: 'Pas de partie' }
    const { error: delError } = await supabase.from('games').delete().eq('id', gameId)
    if (delError) return { error: delError.message }
    return { error: null }
  }, [gameId])

  return {
    game,
    players,
    loading,
    notFound,
    error,
    refresh,
    leaveGame,
    kickPlayer,
    deleteGame
  }
}
