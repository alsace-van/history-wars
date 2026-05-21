// v1.0 (17/05/2026) — Phase 5 Lot B.6 : paint mode pour appliquer un template a un hex via clic
// Source : docs/PLAN-PHASE-5-LOT-B-EDITEUR-HEX.md § 4 B.6
//
// Etat global du paint mode au niveau Game. Quand active, intercepte onTileClick et UPDATE
// terrain_tiles.template_id au lieu de la logique gameplay normale.
//
// Policy RLS terrain_tiles_update_admin (migration 034) : seul l'email admin peut UPDATE.

import { useCallback, useState } from 'react'
import { supabase } from '@lib/supabase'
import type { Cube } from '@engine/hex'

const TAG = '[usePaintMode v1.0]'

export type PaintModeKind = 'paint' | 'erase'

export interface PaintModeState {
  active: boolean
  /** Template a appliquer au clic. null si kind='erase' ou inactif. */
  selectedTemplateId: string | null
  kind: PaintModeKind
}

export interface UsePaintModeResult extends PaintModeState {
  activatePaint: (templateId: string) => void
  activateErase: () => void
  deactivate: () => void
  /** UPDATE terrain_tiles.template_id pour le hex donne. Resout meme si pas actif (no-op). */
  apply: (cube: Cube) => Promise<void>
}

export function usePaintMode(gameId: string | undefined): UsePaintModeResult {
  const [state, setState] = useState<PaintModeState>({
    active: false,
    selectedTemplateId: null,
    kind: 'paint',
  })

  const activatePaint = useCallback((templateId: string) => {
    setState({ active: true, selectedTemplateId: templateId, kind: 'paint' })
  }, [])

  const activateErase = useCallback(() => {
    setState({ active: true, selectedTemplateId: null, kind: 'erase' })
  }, [])

  const deactivate = useCallback(() => {
    setState({ active: false, selectedTemplateId: null, kind: 'paint' })
  }, [])

  const apply = useCallback(async (cube: Cube) => {
    if (!state.active || !gameId) return
    const templateId = state.kind === 'paint' ? state.selectedTemplateId : null
    if (state.kind === 'paint' && !templateId) return
    try {
      const { error: updErr } = await supabase
        .from('terrain_tiles')
        .update({ template_id: templateId })
        .eq('game_id', gameId)
        .eq('q', cube.q)
        .eq('r', cube.r)
      if (updErr) throw updErr
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(TAG, 'apply failed', e)
      throw e
    }
  }, [state.active, state.kind, state.selectedTemplateId, gameId])

  return {
    ...state,
    activatePaint,
    activateErase,
    deactivate,
    apply,
  }
}
