// v1.1 (17/05/2026) — Phase 5 Lot B.5 : fetch + expose template_id (lien hex_templates)
// v1.0 (17/05/2026) — Phase 5 Lot 1 : fetch terrain_tiles + Realtime

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@lib/supabase'
import { useRealtime } from '@hooks/useRealtime'
import { cubeKey } from '@engine/hex'
import type { TerrainType } from '@engine/terrain/types'

const TAG = '[useTerrainTiles v1.1]'

export interface TerrainTileRow {
  game_id: string
  q: number
  r: number
  type: TerrainType
  /** Phase 5 Lot B.5 : reference optionnelle vers hex_templates.id (custom hex). */
  template_id?: string | null
}

export interface UseTerrainTilesResult {
  /** Map cubeKey ("q,r") → TerrainType. Vide tant que loading ou disabled. */
  terrainMap: Map<string, TerrainType>
  /** Map cubeKey -> template_id (uniquement les hex avec un template applique). */
  templateMap: Map<string, string>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useTerrainTiles(
  gameId: string | undefined,
  enabled: boolean = true,
): UseTerrainTilesResult {
  const [rows, setRows] = useState<TerrainTileRow[]>([])
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
        setRows([])
        setLoading(false)
      }
      return
    }
    setError(null)
    try {
      const { data, error: selErr } = await supabase
        .from('terrain_tiles')
        .select('game_id, q, r, type, template_id')
        .eq('game_id', gameId)
      if (selErr) throw selErr
      if (mountedRef.current) {
        setRows((data ?? []) as TerrainTileRow[])
        setLoading(false)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur chargement terrain_tiles'
      // eslint-disable-next-line no-console
      console.error(TAG, 'refresh failed', e)
      if (mountedRef.current) {
        setError(msg)
        setLoading(false)
      }
    }
  }, [gameId, enabled])

  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [refresh])

  // Realtime : INSERT/UPDATE pour permettre l'édition par paint-mode futur (Vague E).
  useRealtime({
    channelName: gameId && enabled ? `terrain:${gameId}` : '',
    enabled: !!gameId && enabled,
    postgresChanges: gameId
      ? [
          {
            table: 'terrain_tiles',
            event: 'INSERT',
            filter: `game_id=eq.${gameId}`,
            onChange: payload => {
              const row = payload?.new as TerrainTileRow | undefined
              if (!row || !mountedRef.current) return
              setRows(prev => {
                if (prev.some(r => r.q === row.q && r.r === row.r)) return prev
                return [...prev, row]
              })
            },
          },
          {
            table: 'terrain_tiles',
            event: 'UPDATE',
            filter: `game_id=eq.${gameId}`,
            onChange: payload => {
              const row = payload?.new as TerrainTileRow | undefined
              if (!row || !mountedRef.current) return
              setRows(prev => prev.map(r =>
                r.q === row.q && r.r === row.r ? row : r,
              ))
            },
          },
        ]
      : undefined,
  })

  const terrainMap = useMemo(() => {
    const m = new Map<string, TerrainType>()
    for (const r of rows) m.set(cubeKey({ q: r.q, r: r.r, s: -r.q - r.r }), r.type)
    return m
  }, [rows])

  const templateMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) {
      if (r.template_id) m.set(cubeKey({ q: r.q, r: r.r, s: -r.q - r.r }), r.template_id)
    }
    return m
  }, [rows])

  return { terrainMap, templateMap, loading, error, refresh }
}
