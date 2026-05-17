// v1.1 (17/05/2026) — Phase 5 Lot B (ext) : ajout PlacedProp[] (batiments draggables coord monde)
// v1.0 (17/05/2026) — Phase 5 Lot B (extension) : CRUD + Realtime hex_maps

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@lib/supabase'
import { useRealtime } from '@hooks/useRealtime'

const TAG = '[useHexMaps v1.1]'

/**
 * Tiles d'une carte : dictionnaire { cubeKey -> templateId }.
 * Stocke en JSONB cote BDD, manipule comme Record<string, string> cote client.
 */
export type HexMapTiles = Record<string, string>

/**
 * Prop = GLB libre en coordonnees monde (peut couvrir plusieurs hex : batiments, ponts, etc.).
 * Distinct des assets de PlacedAsset (qui sont attaches a un hex template).
 */
export interface PlacedProp {
  /** UUID client pour identification stable (key React + drag). */
  id: string
  /** Reference vers hex_assets.id (GLB uploade). */
  assetId: string
  /** Position monde (X, Y, Z). Y default 0 (sol). */
  x: number
  y?: number
  z: number
  /** Multiplicateur scale applique a la taille native du GLB. */
  scale: number
  /** Rotation autour de l'axe Y en radians. */
  rotationY: number
}

export interface HexMap {
  id: string
  created_by: string
  name: string
  radius: number
  tiles: HexMapTiles
  props: PlacedProp[]
  preview_url: string | null
  created_at: string
  updated_at: string
}

export type HexMapDraft = Omit<HexMap, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
}

export interface UseHexMapsResult {
  maps: HexMap[]
  byId: Map<string, HexMap>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  create: (draft: HexMapDraft) => Promise<HexMap>
  update: (id: string, patch: Partial<HexMapDraft>) => Promise<HexMap>
  remove: (id: string) => Promise<void>
}

export function useHexMaps(enabled: boolean = true): UseHexMapsResult {
  const [maps, setMaps] = useState<HexMap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const refresh = useCallback(async () => {
    if (!enabled) {
      if (mountedRef.current) {
        setMaps([])
        setLoading(false)
      }
      return
    }
    setError(null)
    try {
      const { data, error: selErr } = await supabase
        .from('hex_maps')
        .select('*')
        .order('created_at', { ascending: false })
      if (selErr) throw selErr
      if (mountedRef.current) {
        setMaps((data ?? []) as HexMap[])
        setLoading(false)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur chargement hex_maps'
      // eslint-disable-next-line no-console
      console.error(TAG, 'refresh failed', e)
      if (mountedRef.current) {
        setError(msg)
        setLoading(false)
      }
    }
  }, [enabled])

  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [refresh])

  useRealtime({
    channelName: enabled ? 'hex_maps:all' : '',
    enabled,
    postgresChanges: enabled
      ? [
          {
            table: 'hex_maps',
            event: 'INSERT',
            onChange: payload => {
              const row = payload?.new as HexMap | undefined
              if (!row || !mountedRef.current) return
              setMaps(prev => (prev.some(m => m.id === row.id) ? prev : [row, ...prev]))
            },
          },
          {
            table: 'hex_maps',
            event: 'UPDATE',
            onChange: payload => {
              const row = payload?.new as HexMap | undefined
              if (!row || !mountedRef.current) return
              setMaps(prev => prev.map(m => (m.id === row.id ? row : m)))
            },
          },
          {
            table: 'hex_maps',
            event: 'DELETE',
            onChange: payload => {
              const old = payload?.old as { id?: string } | undefined
              if (!old?.id || !mountedRef.current) return
              setMaps(prev => prev.filter(m => m.id !== old.id))
            },
          },
        ]
      : undefined,
  })

  const byId = useMemo<Map<string, HexMap>>(() => {
    const m = new Map<string, HexMap>()
    for (const x of maps) m.set(x.id, x)
    return m
  }, [maps])

  const create = useCallback(async (draft: HexMapDraft): Promise<HexMap> => {
    const { data, error: insErr } = await supabase
      .from('hex_maps')
      .insert({
        ...(draft.id ? { id: draft.id } : {}),
        created_by: draft.created_by,
        name: draft.name,
        radius: draft.radius,
        tiles: draft.tiles,
        props: draft.props ?? [],
        preview_url: draft.preview_url,
      })
      .select()
      .single()
    if (insErr || !data) throw insErr ?? new Error('insert hex_maps failed')
    const row = data as HexMap
    if (mountedRef.current) {
      setMaps(prev => (prev.some(m => m.id === row.id) ? prev : [row, ...prev]))
    }
    return row
  }, [])

  const update = useCallback(async (id: string, patch: Partial<HexMapDraft>): Promise<HexMap> => {
    const { data, error: updErr } = await supabase
      .from('hex_maps')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (updErr || !data) throw updErr ?? new Error('update hex_maps failed')
    const row = data as HexMap
    if (mountedRef.current) {
      setMaps(prev => prev.map(m => (m.id === row.id ? row : m)))
    }
    return row
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    const { error: delErr } = await supabase
      .from('hex_maps')
      .delete()
      .eq('id', id)
    if (delErr) throw delErr
    if (mountedRef.current) {
      setMaps(prev => prev.filter(m => m.id !== id))
    }
  }, [])

  return { maps, byId, loading, error, refresh, create, update, remove }
}
