// v1.0 (13/05/2026) — Phase 3.2 Vague C2 : UI gestion des ordres conditionnels d'une unité
import { useState } from 'react'
import type {
  UnitOrderRow,
  OrderActionKindUI,
  OrderTriggerKindUI,
  SubmitOrdersOp,
} from '@hooks/usePreOrders'
import { ACTION_LABEL, TRIGGER_LABEL, describePosture } from './orderLabels'

const TRIGGER_KINDS: OrderTriggerKindUI[] = ['on_attacked', 'enemy_in_range', 'cohesion_broken', 'enemy_los']
const ACTION_KINDS: OrderActionKindUI[] = ['charge', 'fire', 'retreat', 'hold']

interface OrdersPanelProps {
  isMyUnit: boolean
  orders: UnitOrderRow[]
  busy: boolean
  error: string | null
  onCreate: (trigger: SubmitOrdersOp['trigger'], action: SubmitOrdersOp['action']) => Promise<boolean>
  onUpdate: (orderId: string, patch: Omit<SubmitOrdersOp, 'op' | 'order_id'>) => Promise<boolean>
  onDelete: (orderId: string) => Promise<boolean>
  onReorder: (orderId: string, newPriority: number) => Promise<boolean>
}

export function OrdersPanel(p: OrdersPanelProps) {
  const { isMyUnit, orders, busy, error, onCreate, onUpdate: _onUpdate, onDelete, onReorder } = p
  const [adding, setAdding] = useState(false)
  const [newTrigger, setNewTrigger] = useState<OrderTriggerKindUI>('enemy_in_range')
  const [newRange, setNewRange] = useState<number>(3)
  const [newAction, setNewAction] = useState<OrderActionKindUI>('hold')

  if (!isMyUnit) {
    return (
      <div className="px-3 py-3 text-[11px] uppercase tracking-[0.08em] text-muted-foreground border border-[rgba(226,232,240,0.10)] rounded-[2px]">
        Ordres conditionnels d'une unité ennemie : info privée à l'adversaire.
      </div>
    )
  }

  const canAdd = orders.length < 3 && !adding && !busy

  function startAdd() {
    setAdding(true)
    setNewTrigger('enemy_in_range')
    setNewRange(3)
    setNewAction('hold')
  }

  function cancelAdd() { setAdding(false) }

  async function commitAdd() {
    const trigger: SubmitOrdersOp['trigger'] = newTrigger === 'enemy_in_range'
      ? { kind: 'enemy_in_range', params: { range: newRange } }
      : { kind: newTrigger }
    const action: SubmitOrdersOp['action'] = { kind: newAction }
    const ok = await onCreate(trigger, action)
    if (ok) setAdding(false)
  }

  const preview = describePosture(newTrigger, newAction, newTrigger === 'enemy_in_range' ? newRange : undefined)

  return (
    <div className="px-3 py-3 border border-[rgba(226,232,240,0.10)] rounded-[2px] space-y-2 bg-[rgba(15,23,42,0.45)]">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tactica-amber">
          Ordres conditionnels
        </div>
        <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {orders.length}/3
        </div>
      </div>

      {orders.length === 0 && !adding && (
        <div className="text-[11px] text-muted-foreground italic">
          Aucun ordre. L'unité attend ton tour pour agir.
        </div>
      )}

      {orders.map(o => (
        <div key={o.id} className="flex items-center gap-2 text-[12px] px-2 py-1 border border-[rgba(226,232,240,0.10)] rounded-[2px] bg-[rgba(8,12,24,0.55)]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-tactica-amber w-[14px] text-center">
            {o.priority}
          </span>
          <span className="flex-1">
            {describePosture(
              o.trigger.kind as OrderTriggerKindUI,
              o.action.kind as OrderActionKindUI,
              o.trigger.params?.range,
            )}
          </span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-[10px] disabled:opacity-40"
            disabled={busy || o.priority === 1}
            onClick={() => void onReorder(o.id, o.priority - 1)}
            title="Monter en priorité"
          >▲</button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-[10px] disabled:opacity-40"
            disabled={busy || o.priority === orders.length}
            onClick={() => void onReorder(o.id, o.priority + 1)}
            title="Descendre en priorité"
          >▼</button>
          <button
            type="button"
            className="text-red-400 hover:text-red-300 text-[12px] disabled:opacity-40"
            disabled={busy}
            onClick={() => void onDelete(o.id)}
            title="Supprimer"
          >✕</button>
        </div>
      ))}

      {adding && (
        <div className="space-y-2 px-2 py-2 border border-tactica-amber/40 rounded-[2px] bg-[rgba(239,159,39,0.05)]">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <label className="space-y-1">
              <span className="block uppercase tracking-[0.08em] text-muted-foreground">Si</span>
              <select
                value={newTrigger}
                onChange={e => setNewTrigger(e.target.value as OrderTriggerKindUI)}
                className="w-full bg-[rgba(15,23,42,0.85)] border border-[rgba(226,232,240,0.18)] rounded-[2px] px-1 py-1 text-foreground"
              >
                {TRIGGER_KINDS.map(k => (
                  <option key={k} value={k}>{TRIGGER_LABEL[k]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block uppercase tracking-[0.08em] text-muted-foreground">Alors</span>
              <select
                value={newAction}
                onChange={e => setNewAction(e.target.value as OrderActionKindUI)}
                className="w-full bg-[rgba(15,23,42,0.85)] border border-[rgba(226,232,240,0.18)] rounded-[2px] px-1 py-1 text-foreground"
              >
                {ACTION_KINDS.map(k => (
                  <option key={k} value={k}>{ACTION_LABEL[k]}</option>
                ))}
              </select>
            </label>
          </div>
          {newTrigger === 'enemy_in_range' && (
            <label className="block text-[11px] space-y-1">
              <span className="uppercase tracking-[0.08em] text-muted-foreground">Portée (hex)</span>
              <input
                type="number"
                min={1}
                max={10}
                value={newRange}
                onChange={e => setNewRange(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                className="w-full bg-[rgba(15,23,42,0.85)] border border-[rgba(226,232,240,0.18)] rounded-[2px] px-1 py-1 text-foreground"
              />
            </label>
          )}
          <div className="text-[11px] text-tactica-amber italic">
            Aperçu : {preview}
          </div>
          <div className="flex justify-end gap-2 text-[11px]">
            <button
              type="button"
              className="px-2 py-1 border border-[rgba(226,232,240,0.18)] rounded-[2px] hover:bg-[rgba(226,232,240,0.05)]"
              onClick={cancelAdd}
              disabled={busy}
            >Annuler</button>
            <button
              type="button"
              className="px-2 py-1 border border-tactica-amber rounded-[2px] bg-tactica-amber/15 text-tactica-amber hover:bg-tactica-amber/25 disabled:opacity-40"
              onClick={() => void commitAdd()}
              disabled={busy}
            >Valider</button>
          </div>
        </div>
      )}

      {!adding && canAdd && (
        <button
          type="button"
          className="w-full px-2 py-1 text-[11px] uppercase tracking-[0.10em] border border-dashed border-[rgba(226,232,240,0.25)] rounded-[2px] text-muted-foreground hover:border-tactica-amber/60 hover:text-tactica-amber"
          onClick={startAdd}
        >+ Ajouter un ordre</button>
      )}

      {!adding && orders.length >= 3 && (
        <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground italic">
          Limite atteinte (3/3). Supprime un ordre pour en ajouter un autre.
        </div>
      )}

      {error && (
        <div className="text-[11px] text-red-400 italic">
          ⚠ {error}
        </div>
      )}
    </div>
  )
}
