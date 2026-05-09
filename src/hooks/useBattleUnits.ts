// v1.0 (09/05/2026) — L1C.1 : fetch table units + Realtime sync (INSERT/UPDATE/DELETE)
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@lib/supabase'
import { useRealtime } from '@hooks/useRealtime'
import type { UnitRow } from '@render/_data/unitAdapter'

const TAG = '[useBattleUnits v1.0]'

export interface UseBattleUnitsResult {
  units: UnitRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Charge les units d'une game et maintient la liste a jour via Realtime.
 * - Fetch initial via SELECT (RLS migration 007 : visible aux membres de la game).
 * - INSERT/UPDATE/DELETE Realtime → mise a jour locale du tableau, pas de refetch global.
 * - Channel `units:${gameId}` distinct du channel principal de Game.tsx (zero conflit).
 *
 * Si gameId est falsy, hook inactif (units=[], loading=false).
 */
export function useBattleUnits(
  gameId: string | undefined,
  enabled: boolean = true
): UseBattleUnitsResult {
  const [units, setUnits] = useState<UnitRow[]>([])
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
    if (!gameId || !enabled) {
      if (mountedRef.current) {
        setUnits([])
        setLoading(false)
      }
      return
    }

    setError(null)

    try {
      const { data, error: selErr } = await supabase
        .from('units')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true })

      if (selErr) throw selErr

      if (mountedRef.current) {
        setUnits((data ?? []) as UnitRow[])
        setLoading(false)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur chargement unites'
      // eslint-disable-next-line no-console
      console.error(TAG, 'refresh failed', e)
      if (mountedRef.current) {
        setError(msg)
        setLoading(false)
      }
    }
  }, [gameId, enabled])

  // Initial load + reload sur changement gameId/enabled
  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [refresh])

  // Realtime sync local (pas de refetch, on patch le tableau directement).
  useRealtime({
    channelName: gameId && enabled ? `units:${gameId}` : '',
    enabled: !!gameId && enabled,
    postgresChanges: gameId
      ? [
          {
            table: 'units',
            event: 'INSERT',
            filter: `game_id=eq.${gameId}`,
            onChange: payload => {
              const row = payload?.new as UnitRow | undefined
              if (!row || !mountedRef.current) return
              setUnits(prev => {
                if (prev.some(u => u.id === row.id)) return prev
                return [...prev, row]
              })
            },
          },
          {
            table: 'units',
            event: 'UPDATE',
            filter: `game_id=eq.${gameId}`,
            onChange: payload => {
              const row = payload?.new as UnitRow | undefined
              if (!row || !mountedRef.current) return
              setUnits(prev => prev.map(u => (u.id === row.id ? row : u)))
            },
          },
          {
            table: 'units',
            event: 'DELETE',
            filter: `game_id=eq.${gameId}`,
            onChange: payload => {
              const old = payload?.old as { id?: string } | undefined
              if (!old?.id || !mountedRef.current) return
              setUnits(prev => prev.filter(u => u.id !== old.id))
            },
          },
        ]
      : undefined,
  })

  return { units, loading, error, refresh }
}
