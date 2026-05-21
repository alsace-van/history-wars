// v1.1 (17/05/2026) — Fix refresh : patches optimistes locales dans create/update/remove
//                      (le Realtime reste actif comme fallback / sync inter-clients)
// v1.0 (17/05/2026) — Phase 5 Lot B.3 : CRUD + Realtime + upload Storage hex_templates
// Source : docs/PLAN-PHASE-5-LOT-B-EDITEUR-HEX.md § 4 B.3
// RLS email-based (migration 029) : SELECT public auth, write reserve alsacevancreation.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@lib/supabase'
import { useRealtime } from '@hooks/useRealtime'

const TAG = '[useHexTemplates v1.1]'
const BUCKET = 'hex-textures'

export type AssetKind =
  | 'pine_tree' | 'leaf_tree' | 'log' | 'rock' | 'bush'
  | 'wall' | 'trench' | 'water'
  | 'custom'  // GLB custom uploade dans hex_assets

export interface PlacedAsset {
  kind: AssetKind
  /** Requis si kind === 'custom' : reference vers hex_assets.id. */
  customAssetId?: string
  /** Position locale dans l'hex (centre = 0,0). Coordonnees normalisees hexSize (rayon 1). */
  dx: number  // [-1, 1]
  dz: number  // [-1, 1]
  /** Scale relatif (1 = scale normal). */
  scale: number
  /** Rotation Y en radians. */
  rotationY: number
}

export interface HexTemplate {
  id: string
  created_by: string
  name: string
  texture_url: string
  texture_scale: number
  texture_mode: 'stretch' | 'tile'
  assets_3d: PlacedAsset[]
  preview_url: string | null
  created_at: string
  updated_at: string
}

export type HexTemplateDraft = Omit<HexTemplate, 'id' | 'created_at' | 'updated_at'> & {
  /** Optionnel : id client pour preupload Storage avant INSERT. */
  id?: string
}

export interface UseHexTemplatesResult {
  templates: HexTemplate[]
  byId: Map<string, HexTemplate>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  create: (draft: HexTemplateDraft) => Promise<HexTemplate>
  update: (id: string, patch: Partial<HexTemplateDraft>) => Promise<HexTemplate>
  remove: (id: string) => Promise<void>
  uploadTexture: (file: File, userId: string, templateId: string) => Promise<string>
}

export function useHexTemplates(enabled: boolean = true): UseHexTemplatesResult {
  const [templates, setTemplates] = useState<HexTemplate[]>([])
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
        setTemplates([])
        setLoading(false)
      }
      return
    }
    setError(null)
    try {
      const { data, error: selErr } = await supabase
        .from('hex_templates')
        .select('*')
        .order('created_at', { ascending: false })
      if (selErr) throw selErr
      if (mountedRef.current) {
        setTemplates((data ?? []) as HexTemplate[])
        setLoading(false)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur chargement hex_templates'
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

  // Realtime : INSERT / UPDATE / DELETE patch local
  useRealtime({
    channelName: enabled ? 'hex_templates:all' : '',
    enabled,
    postgresChanges: enabled
      ? [
          {
            table: 'hex_templates',
            event: 'INSERT',
            onChange: payload => {
              const row = payload?.new as HexTemplate | undefined
              if (!row || !mountedRef.current) return
              setTemplates(prev => {
                if (prev.some(t => t.id === row.id)) return prev
                return [row, ...prev]
              })
            },
          },
          {
            table: 'hex_templates',
            event: 'UPDATE',
            onChange: payload => {
              const row = payload?.new as HexTemplate | undefined
              if (!row || !mountedRef.current) return
              setTemplates(prev => prev.map(t => (t.id === row.id ? row : t)))
            },
          },
          {
            table: 'hex_templates',
            event: 'DELETE',
            onChange: payload => {
              const old = payload?.old as { id?: string } | undefined
              if (!old?.id || !mountedRef.current) return
              setTemplates(prev => prev.filter(t => t.id !== old.id))
            },
          },
        ]
      : undefined,
  })

  const byId = useMemo<Map<string, HexTemplate>>(() => {
    const m = new Map<string, HexTemplate>()
    for (const t of templates) m.set(t.id, t)
    return m
  }, [templates])

  const create = useCallback(async (draft: HexTemplateDraft): Promise<HexTemplate> => {
    const { data, error: insErr } = await supabase
      .from('hex_templates')
      .insert({
        ...(draft.id ? { id: draft.id } : {}),
        created_by: draft.created_by,
        name: draft.name,
        texture_url: draft.texture_url,
        texture_scale: draft.texture_scale,
        texture_mode: draft.texture_mode,
        assets_3d: draft.assets_3d,
        preview_url: draft.preview_url,
      })
      .select()
      .single()
    if (insErr || !data) throw insErr ?? new Error('insert hex_templates failed')
    const row = data as HexTemplate
    // Patch optimiste local : ne pas attendre l'event Realtime (peut etre retarde / perdu).
    if (mountedRef.current) {
      setTemplates(prev => (prev.some(t => t.id === row.id) ? prev : [row, ...prev]))
    }
    return row
  }, [])

  const update = useCallback(async (id: string, patch: Partial<HexTemplateDraft>): Promise<HexTemplate> => {
    const { data, error: updErr } = await supabase
      .from('hex_templates')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (updErr || !data) throw updErr ?? new Error('update hex_templates failed')
    const row = data as HexTemplate
    if (mountedRef.current) {
      setTemplates(prev => prev.map(t => (t.id === row.id ? row : t)))
    }
    return row
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    const { error: delErr } = await supabase
      .from('hex_templates')
      .delete()
      .eq('id', id)
    if (delErr) throw delErr
    if (mountedRef.current) {
      setTemplates(prev => prev.filter(t => t.id !== id))
    }
  }, [])

  const uploadTexture = useCallback(async (file: File, userId: string, templateId: string): Promise<string> => {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const allowed = ['jpg', 'jpeg', 'png', 'webp']
    const safeExt = allowed.includes(ext) ? ext : 'jpg'
    const path = `${userId}/${templateId}.${safeExt}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || `image/${safeExt}` })
    if (upErr) throw upErr
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    if (!data?.publicUrl) throw new Error('getPublicUrl failed')
    // Cache-buster pour reupload meme path (sinon le navigateur garde la version precedente)
    return `${data.publicUrl}?t=${Date.now()}`
  }, [])

  return { templates, byId, loading, error, refresh, create, update, remove, uploadTexture }
}
