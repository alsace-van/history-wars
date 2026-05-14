// v1.0 (14/05/2026) — Phase 3.3 Lot B : map { unit_id → action kind du priority=1 actif }
// Frontière hooks/ : zéro Three, OK Supabase. Fetch global de mes unit_orders pour
// le rendu d'icônes sur le pion 3D (vs usePreOrders qui est par-unit côté sidebar).
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@lib/supabase'
import { useRealtime } from './useRealtime'
import type { OrderActionKind } from '@engine/orders'

export type { OrderActionKind }

interface OrderRow {
  unit_id: string
  priority: number
  action: { kind: string }
  active: boolean
}

interface UseActiveOrdersByUnitOptions {
  gameId: string | null
  myUserId: string | null
  enabled?: boolean
}

export interface UseActiveOrdersByUnitResult {
  activeOrders: Map<string, OrderActionKind>
  refresh: () => Promise<void>
}

const ACTION_KINDS = new Set<OrderActionKind>(['charge', 'fire', 'retreat', 'hold'])

function pickActionKind(a: { kind: string }): OrderActionKind | null {
  return ACTION_KINDS.has(a.kind as OrderActionKind) ? (a.kind as OrderActionKind) : null
}

/**
 * SELECT global de mes unit_orders du game courant. RLS owner-only filtre déjà
 * côté serveur, mais on filtre quand même par game_id pour limiter le payload.
 *
 * Pour chaque unit : on garde le premier ordre actif (priority ASC). Le pion
 * affiche l'icône de cet ordre — c'est celui qui sera évalué en premier.
 *
 * Refresh auto sur INSERT game_actions(action_type='order_triggered') car un
 * ordre déclenché peut être désactivé/supprimé server-side.
 */
export function useActiveOrdersByUnit({
  gameId,
  myUserId,
  enabled = true,
}: UseActiveOrdersByUnitOptions): UseActiveOrdersByUnitResult {
  const [activeOrders, setActiveOrders] = useState<Map<string, OrderActionKind>>(new Map())
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const refresh = useCallback(async () => {
    if (!gameId || !myUserId || !enabled) {
      if (mountedRef.current) setActiveOrders(new Map())
      return
    }
    const { data, error } = await supabase
      .from('unit_orders')
      .select('unit_id, priority, action, active')
      .eq('game_id', gameId)
      .eq('active', true)
      .order('priority', { ascending: true })
    if (error) {
      console.warn('[useActiveOrdersByUnit] fetch failed', error.message)
      return
    }
    const rows = (data ?? []) as OrderRow[]
    const map = new Map<string, OrderActionKind>()
    for (const r of rows) {
      if (map.has(r.unit_id)) continue  // priority ASC : premier = top
      const kind = pickActionKind(r.action)
      if (kind) map.set(r.unit_id, kind)
    }
    if (mountedRef.current) setActiveOrders(map)
  }, [gameId, myUserId, enabled])

  useEffect(() => { void refresh() }, [refresh])

  // Refetch quand un ordre se déclenche : le serveur peut avoir désactivé la row
  // (ex: cas one-shot futur). Pour MVP les ordres restent actifs, mais le refetch
  // garantit la cohérence si la règle change.
  useRealtime({
    channelName: gameId ? `active-orders:${gameId}` : '',
    enabled: enabled && !!gameId && !!myUserId,
    postgresChanges: gameId
      ? [
          {
            table: 'game_actions',
            event: 'INSERT',
            filter: `game_id=eq.${gameId}`,
            onChange: payload => {
              const row = (payload as { new?: { action_type?: string } }).new
              if (row?.action_type === 'order_triggered') void refresh()
            },
          },
        ]
      : undefined,
  })

  return { activeOrders, refresh }
}
