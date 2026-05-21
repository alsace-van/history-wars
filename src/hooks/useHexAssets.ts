// v1.3 (17/05/2026) — DRACOLoader local (public/draco/) pour parser les GLB Draco-compressed
// v1.2 (17/05/2026) — Decimation auto a l'upload via gltf-transform + meshoptimizer (Web Worker)
// v1.1 (17/05/2026) — Validation triangles a l'upload (rejet > MAX_TRIANGLES, evite GPU saturation)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { toast } from 'sonner'
import { supabase } from '@lib/supabase'
import { useRealtime } from '@hooks/useRealtime'
import { optimizeGlbFile } from '@lib/glb-optimizer'

const TAG = '[useHexAssets v1.3]'
const BUCKET = 'hex-assets'
const TARGET_TRIANGLES = 30_000   // cible de decimation auto
const MAX_TRIANGLES = 100_000     // rejet hard si decimation ne descend pas en dessous

// DRACOLoader local (public/draco/) partage. Initialise une seule fois.
let dracoLoaderSingleton: DRACOLoader | null = null
function getDracoLoader(): DRACOLoader {
  if (dracoLoaderSingleton) return dracoLoaderSingleton
  const d = new DRACOLoader()
  d.setDecoderPath('/draco/')
  dracoLoaderSingleton = d
  return d
}

export interface HexAsset {
  id: string
  created_by: string
  name: string
  url: string
  category: string
  created_at: string
  updated_at: string
}

export type HexAssetDraft = Omit<HexAsset, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
}

export interface UseHexAssetsResult {
  assets: HexAsset[]
  byId: Map<string, HexAsset>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  create: (draft: HexAssetDraft) => Promise<HexAsset>
  update: (id: string, patch: Partial<HexAssetDraft>) => Promise<HexAsset>
  remove: (id: string) => Promise<void>
  uploadGLB: (file: File, userId: string, assetId: string) => Promise<string>
}

export function useHexAssets(enabled: boolean = true): UseHexAssetsResult {
  const [assets, setAssets] = useState<HexAsset[]>([])
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
        setAssets([])
        setLoading(false)
      }
      return
    }
    setError(null)
    try {
      const { data, error: selErr } = await supabase
        .from('hex_assets')
        .select('*')
        .order('created_at', { ascending: false })
      if (selErr) throw selErr
      if (mountedRef.current) {
        setAssets((data ?? []) as HexAsset[])
        setLoading(false)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur chargement hex_assets'
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
    channelName: enabled ? 'hex_assets:all' : '',
    enabled,
    postgresChanges: enabled
      ? [
          {
            table: 'hex_assets',
            event: 'INSERT',
            onChange: payload => {
              const row = payload?.new as HexAsset | undefined
              if (!row || !mountedRef.current) return
              setAssets(prev => (prev.some(a => a.id === row.id) ? prev : [row, ...prev]))
            },
          },
          {
            table: 'hex_assets',
            event: 'UPDATE',
            onChange: payload => {
              const row = payload?.new as HexAsset | undefined
              if (!row || !mountedRef.current) return
              setAssets(prev => prev.map(a => (a.id === row.id ? row : a)))
            },
          },
          {
            table: 'hex_assets',
            event: 'DELETE',
            onChange: payload => {
              const old = payload?.old as { id?: string } | undefined
              if (!old?.id || !mountedRef.current) return
              setAssets(prev => prev.filter(a => a.id !== old.id))
            },
          },
        ]
      : undefined,
  })

  const byId = useMemo<Map<string, HexAsset>>(() => {
    const m = new Map<string, HexAsset>()
    for (const a of assets) m.set(a.id, a)
    return m
  }, [assets])

  const create = useCallback(async (draft: HexAssetDraft): Promise<HexAsset> => {
    const { data, error: insErr } = await supabase
      .from('hex_assets')
      .insert({
        ...(draft.id ? { id: draft.id } : {}),
        created_by: draft.created_by,
        name: draft.name,
        url: draft.url,
        category: draft.category,
      })
      .select()
      .single()
    if (insErr || !data) throw insErr ?? new Error('insert hex_assets failed')
    const row = data as HexAsset
    if (mountedRef.current) {
      setAssets(prev => (prev.some(a => a.id === row.id) ? prev : [row, ...prev]))
    }
    return row
  }, [])

  const update = useCallback(async (id: string, patch: Partial<HexAssetDraft>): Promise<HexAsset> => {
    const { data, error: updErr } = await supabase
      .from('hex_assets')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (updErr || !data) throw updErr ?? new Error('update hex_assets failed')
    const row = data as HexAsset
    if (mountedRef.current) {
      setAssets(prev => prev.map(a => (a.id === row.id ? row : a)))
    }
    return row
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    const { error: delErr } = await supabase
      .from('hex_assets')
      .delete()
      .eq('id', id)
    if (delErr) throw delErr
    if (mountedRef.current) {
      setAssets(prev => prev.filter(a => a.id !== id))
    }
  }, [])

  const uploadGLB = useCallback(async (file: File, userId: string, assetId: string): Promise<string> => {
    // v1.1 — Compte les triangles d'entree (validation cheap, dans le main thread).
    // v1.3 — DRACOLoader configure (local) pour supporter les GLB Draco-compressed.
    const buf = await file.arrayBuffer()
    const loader = new GLTFLoader()
    loader.setDRACOLoader(getDracoLoader())
    const tris = await new Promise<number>((resolve, reject) => {
      loader.parse(buf, '', gltf => {
        let count = 0
        gltf.scene.traverse(obj => {
          const mesh = obj as THREE.Mesh
          if (!mesh.isMesh || !mesh.geometry) return
          const g = mesh.geometry as THREE.BufferGeometry
          const idx = g.index?.count ?? g.attributes.position?.count ?? 0
          count += idx / 3
        })
        resolve(Math.round(count))
      }, err => reject(err))
    })
    // eslint-disable-next-line no-console
    console.log(TAG, 'upload validation', { file: file.name, sizeKB: Math.round(file.size / 1024), triangles: tris })

    // v1.2 — Decimation auto si > TARGET_TRIANGLES. Lance dans un Web Worker (non-bloquant).
    let payload: Blob = file
    let payloadSize = file.size
    if (tris > TARGET_TRIANGLES) {
      const tId = toast.loading(`Optimisation du GLB : ${tris.toLocaleString()} triangles...`)
      try {
        const r = await optimizeGlbFile(file, TARGET_TRIANGLES)
        const reduction = Math.round((1 - r.toTris / r.fromTris) * 100)
        // eslint-disable-next-line no-console
        console.log(TAG, 'optimization done', { fromTris: r.fromTris, toTris: r.toTris, durationMs: r.durationMs, newSizeKB: Math.round(r.blob.size / 1024) })
        if (r.toTris > MAX_TRIANGLES) {
          toast.error(`Optimisation insuffisante : ${r.toTris.toLocaleString()} triangles (max ${MAX_TRIANGLES.toLocaleString()})`, { id: tId })
          throw new Error(`GLB encore trop lourd apres decimation : ${r.toTris.toLocaleString()} triangles`)
        }
        toast.success(
          `GLB optimisé : ${r.fromTris.toLocaleString()} → ${r.toTris.toLocaleString()} tris (-${reduction}%) en ${(r.durationMs / 1000).toFixed(1)}s`,
          { id: tId, duration: 4000 },
        )
        payload = r.blob
        payloadSize = r.blob.size
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(TAG, 'optimization failed', err)
        toast.error(err instanceof Error ? err.message : 'Echec optimisation GLB', { id: tId })
        throw err
      }
    }

    const ext = (file.name.split('.').pop() ?? 'glb').toLowerCase()
    const safeExt = ext === 'gltf' ? 'gltf' : 'glb'
    const path = `${userId}/${assetId}.${safeExt}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, payload, { upsert: true, contentType: file.type || 'model/gltf-binary' })
    if (upErr) throw upErr
    // eslint-disable-next-line no-console
    console.log(TAG, 'upload done', { path, sizeKB: Math.round(payloadSize / 1024) })
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    if (!data?.publicUrl) throw new Error('getPublicUrl failed')
    return `${data.publicUrl}?t=${Date.now()}`
  }, [])

  return { assets, byId, loading, error, refresh, create, update, remove, uploadGLB }
}
