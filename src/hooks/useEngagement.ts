// v1.0 (11/05/2026) — Phase 2.6 Vague C : fetch table engagements + Realtime sync
// Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 8 (UI engagement)
// Pattern miroir de useBattleUnits v1.0 — INSERT/DELETE sur table engagements.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@lib/supabase'
import { useRealtime } from '@hooks/useRealtime'

const TAG = '[useEngagement v1.0]'

/**
 * Forme brute d'une ligne `engagements` (migration 017).
 * snake_case côté BDD, on conserve tel quel (pas de transformation).
 */
export interface EngagementRow {
  id: string
  game_id: string
  unit_a_id: string
  unit_b_id: string
  started_turn: number
  created_at: string
}

export interface UseEngagementResult {
  engagements: EngagementRow[]
  /** Set des unitId impliquées dans au moins 1 engagement actif. */
  engagedUnitIds: Set<string>
  /** Map<unitId, EngagementRow[]> pour multi-engagement (1 unité, N paires). */
  engagementsByUnit: Map<string, EngagementRow[]>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Charge les engagements d'une game et maintient à jour via Realtime.
 *  - Fetch initial via SELECT (RLS migration 017 : visible aux membres).
 *  - INSERT/DELETE Realtime → patch local du tableau, pas de refetch global.
 *  - Channel `engagements:${gameId}` distinct.
 *  - Pas d'UPDATE (les engagements ne sont jamais modifiés, seulement créés/supprimés).
 *
 * Si gameId est falsy ou enabled=false → hook inactif (engagements=[]).
 */
export function useEngagement(
  gameId: string | undefined,
  enabled: boolean = true,
): UseEngagementResult {
  const [engagements, setEngagements] = useState<EngagementRow[]>([])
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
        setEngagements([])
        setLoading(false)
      }
      return
    }

    setError(null)

    try {
      const { data, error: selErr } = await supabase
        .from('engagements')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true })

      if (selErr) throw selErr

      if (mountedRef.current) {
        setEngagements((data ?? []) as EngagementRow[])
        setLoading(false)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur chargement engagements'
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

  // Realtime sync local (patch tableau, pas de refetch).
  useRealtime({
    channelName: gameId && enabled ? `engagements:${gameId}` : '',
    enabled: !!gameId && enabled,
    postgresChanges: gameId
      ? [
          {
            table: 'engagements',
            event: 'INSERT',
            filter: `game_id=eq.${gameId}`,
            onChange: payload => {
              const row = payload?.new as EngagementRow | undefined
              if (!row || !mountedRef.current) return
              setEngagements(prev => {
                if (prev.some(e => e.id === row.id)) return prev
                return [...prev, row]
              })
            },
          },
          {
            table: 'engagements',
            event: 'DELETE',
            filter: `game_id=eq.${gameId}`,
            onChange: payload => {
              const old = payload?.old as { id?: string } | undefined
              if (!old?.id || !mountedRef.current) return
              setEngagements(prev => prev.filter(e => e.id !== old.id))
            },
          },
        ]
      : undefined,
  })

  // Dérivés mémoïsés : Set + Map pour O(1) lookup côté UI.
  const engagedUnitIds = useMemo<Set<string>>(() => {
    const s = new Set<string>()
    for (const e of engagements) {
      s.add(e.unit_a_id)
      s.add(e.unit_b_id)
    }
    return s
  }, [engagements])

  const engagementsByUnit = useMemo<Map<string, EngagementRow[]>>(() => {
    const m = new Map<string, EngagementRow[]>()
    for (const e of engagements) {
      const a = m.get(e.unit_a_id) ?? []
      a.push(e)
      m.set(e.unit_a_id, a)
      const b = m.get(e.unit_b_id) ?? []
      b.push(e)
      m.set(e.unit_b_id, b)
    }
    return m
  }, [engagements])

  return { engagements, engagedUnitIds, engagementsByUnit, loading, error, refresh }
}
