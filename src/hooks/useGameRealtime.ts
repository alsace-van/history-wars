// v1.0 (09/05/2026) — L1C.1 : wrapper Realtime games + game_players + game_actions
import { useRealtime, type PostgresChangeConfig } from '@hooks/useRealtime'

const TAG = '[useGameRealtime v1.0]'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = any // payload Supabase non typifiable strict (heritage useRealtime)

interface UseGameRealtimeOptions {
  gameId: string | undefined
  enabled?: boolean
  onGameUpdate?: (payload: Payload) => void
  onGameDelete?: (payload: Payload) => void
  onPlayersChange?: (payload: Payload) => void
  /** Insert d'une action serveur (move/attack/end_turn/start_battle). Utile pour HUD log + animations. */
  onActionInsert?: (payload: Payload) => void
}

/**
 * Hook unique de souscription Realtime au cycle de vie d'une game.
 * Centralise games (UPDATE+DELETE), game_players (*), game_actions (INSERT).
 * NE TOUCHE PAS la table units — gere par useBattleUnits avec son propre channel.
 *
 * Channel : `game-meta:${gameId}` (distinct de useBattleUnits + ancien `game:${gameId}`).
 *
 * Usage typique dans Game.tsx :
 *   useGameRealtime({
 *     gameId, enabled: !!user,
 *     onGameUpdate: () => refresh(),
 *     onGameDelete: () => navigate('/lobby'),
 *     onPlayersChange: () => refresh(),
 *   })
 */
export function useGameRealtime({
  gameId,
  enabled = true,
  onGameUpdate,
  onGameDelete,
  onPlayersChange,
  onActionInsert,
}: UseGameRealtimeOptions): { stale: boolean } {
  const configs: PostgresChangeConfig[] = []

  if (gameId) {
    if (onGameUpdate) {
      configs.push({
        table: 'games',
        event: 'UPDATE',
        filter: `id=eq.${gameId}`,
        onChange: payload => {
          try {
            onGameUpdate(payload)
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(TAG, 'onGameUpdate threw', e)
          }
        },
      })
    }
    if (onGameDelete) {
      configs.push({
        table: 'games',
        event: 'DELETE',
        filter: `id=eq.${gameId}`,
        onChange: payload => {
          try {
            onGameDelete(payload)
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(TAG, 'onGameDelete threw', e)
          }
        },
      })
    }
    if (onPlayersChange) {
      configs.push({
        table: 'game_players',
        event: '*',
        filter: `game_id=eq.${gameId}`,
        onChange: payload => {
          try {
            onPlayersChange(payload)
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(TAG, 'onPlayersChange threw', e)
          }
        },
      })
    }
    if (onActionInsert) {
      configs.push({
        table: 'game_actions',
        event: 'INSERT',
        filter: `game_id=eq.${gameId}`,
        onChange: payload => {
          try {
            onActionInsert(payload)
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(TAG, 'onActionInsert threw', e)
          }
        },
      })
    }
  }

  return useRealtime({
    channelName: gameId && enabled ? `game-meta:${gameId}` : '',
    enabled: !!gameId && enabled,
    postgresChanges: configs.length > 0 ? configs : undefined,
  })
}
