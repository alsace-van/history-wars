// v1.0 (13/05/2026) — Phase 3.2 Vague C1 : fetch + CRUD batch des ordres conditionnels par unité
// Pas de Realtime (table unit_orders n'est pas publiée — privacy gameplay).
// Refresh manuel après chaque mutation OK locale.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@lib/supabase'

const TAG = '[usePreOrders v1.0]'

/** Mirror SUPABASE row unit_orders (Phase 3.2 migration 019). */
export interface UnitOrderRow {
  id: string
  game_id: string
  unit_id: string
  owner_user_id: string
  priority: number
  trigger: { kind: string; params?: { range?: number } }
  action: { kind: string; params?: Record<string, unknown> }
  active: boolean
  created_at: string
}

export type OrderTriggerKindUI = 'on_attacked' | 'enemy_in_range' | 'cohesion_broken' | 'enemy_los' | 'always'
export type OrderActionKindUI = 'charge' | 'fire' | 'retreat' | 'hold' | 'camp'

export interface SubmitOrdersOp {
  op: 'create' | 'update' | 'delete'
  order_id?: string
  priority?: number
  trigger?: { kind: OrderTriggerKindUI; params?: { range?: number } }
  action?: { kind: OrderActionKindUI; params?: Record<string, unknown> }
  active?: boolean
}

interface UsePreOrdersParams {
  gameId: string | undefined
  unitId: string | null | undefined
  enabled?: boolean
}

export interface UsePreOrdersResult {
  orders: UnitOrderRow[]
  loading: boolean
  busy: boolean
  error: string | null
  refresh: () => Promise<void>
  /** Crée un ordre. Calcule automatiquement la priority = max+1 ≤ 3. */
  createOrder: (trigger: SubmitOrdersOp['trigger'], action: SubmitOrdersOp['action']) => Promise<boolean>
  /** Patch un ordre. */
  updateOrder: (orderId: string, patch: Omit<SubmitOrdersOp, 'op' | 'order_id'>) => Promise<boolean>
  deleteOrder: (orderId: string) => Promise<boolean>
  /** Réordonne : déplace `orderId` à la nouvelle position (1..3). Les autres se décalent. */
  reorderOrder: (orderId: string, newPriority: number) => Promise<boolean>
}

export function usePreOrders(p: UsePreOrdersParams): UsePreOrdersResult {
  const { gameId, unitId, enabled = true } = p

  const [orders, setOrders] = useState<UnitOrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const refresh = useCallback(async () => {
    if (!gameId || !unitId || !enabled) {
      if (mountedRef.current) {
        setOrders([])
        setLoading(false)
      }
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: selErr } = await supabase
        .from('unit_orders')
        .select('*')
        .eq('unit_id', unitId)
        .order('priority', { ascending: true })
      if (selErr) throw selErr
      if (mountedRef.current) {
        setOrders((data ?? []) as UnitOrderRow[])
        setLoading(false)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      console.error(TAG, 'refresh failed', e)
      if (mountedRef.current) {
        setError(msg)
        setLoading(false)
      }
    }
  }, [gameId, unitId, enabled])

  useEffect(() => { void refresh() }, [refresh])

  const submitOps = useCallback(async (operations: SubmitOrdersOp[]): Promise<boolean> => {
    if (!gameId || !unitId || busy) return false
    setBusy(true)
    setError(null)
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('submit_orders', {
        body: { game_id: gameId, unit_id: unitId, operations },
      })
      if (invokeErr) throw invokeErr
      const res = data as { ok?: boolean; orders?: UnitOrderRow[]; code?: string; message?: string }
      if (!res || !res.ok) {
        const msg = res?.message ?? 'EF submit_orders failed'
        setError(msg)
        return false
      }
      if (mountedRef.current && res.orders) setOrders(res.orders)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      console.error(TAG, 'submit failed', e)
      if (mountedRef.current) setError(msg)
      return false
    } finally {
      if (mountedRef.current) setBusy(false)
    }
  }, [gameId, unitId, busy])

  const createOrder = useCallback(async (
    trigger: SubmitOrdersOp['trigger'],
    action: SubmitOrdersOp['action'],
  ): Promise<boolean> => {
    if (!trigger || !action) return false
    if (orders.length >= 3) {
      setError('max 3 orders per unit')
      return false
    }
    const nextPriority = orders.length === 0 ? 1 : Math.max(...orders.map(o => o.priority)) + 1
    if (nextPriority > 3) {
      setError('no free priority slot (1-3)')
      return false
    }
    return submitOps([{ op: 'create', priority: nextPriority, trigger, action, active: true }])
  }, [orders, submitOps])

  const updateOrder = useCallback(async (
    orderId: string,
    patch: Omit<SubmitOrdersOp, 'op' | 'order_id'>,
  ): Promise<boolean> => {
    return submitOps([{ op: 'update', order_id: orderId, ...patch }])
  }, [submitOps])

  const deleteOrder = useCallback(async (orderId: string): Promise<boolean> => {
    return submitOps([{ op: 'delete', order_id: orderId }])
  }, [submitOps])

  /**
   * Réordonne : déplace une posture à une nouvelle priorité. Recompose la liste
   * et envoie un batch d'updates pour repositionner toutes les priorités.
   */
  const reorderOrder = useCallback(async (orderId: string, newPriority: number): Promise<boolean> => {
    if (newPriority < 1 || newPriority > 3) return false
    const moving = orders.find(o => o.id === orderId)
    if (!moving) return false
    if (moving.priority === newPriority) return true
    const others = orders.filter(o => o.id !== orderId).sort((a, b) => a.priority - b.priority)
    // Construire la nouvelle liste ordonnée
    const reordered: { id: string; priority: number }[] = []
    let idxOther = 0
    for (let p = 1; p <= 3 && (reordered.length < orders.length); p++) {
      if (p === newPriority) {
        reordered.push({ id: moving.id, priority: p })
      } else if (idxOther < others.length) {
        reordered.push({ id: others[idxOther].id, priority: p })
        idxOther++
      }
    }
    const ops: SubmitOrdersOp[] = reordered
      .filter(r => {
        const orig = orders.find(o => o.id === r.id)
        return orig && orig.priority !== r.priority
      })
      .map(r => ({ op: 'update' as const, order_id: r.id, priority: r.priority }))
    if (ops.length === 0) return true
    return submitOps(ops)
  }, [orders, submitOps])

  return { orders, loading, busy, error, refresh, createOrder, updateOrder, deleteOrder, reorderOrder }
}
