// v1.3 (14/05/2026) — Phase 3.3 Lot C : bouton "Choisir destination" pour retreat directionnel
// v1.2 (14/05/2026) — Phase 3.3 : portée trigger non-fire cappée à max(range, vision) au lieu de 10
// v1.1 (13/05/2026) — Phase 3.3 : portée trigger cappée à stats.range de l'unité (cohérence fire)
// v1.0 (13/05/2026) — Phase 3.2 Vague C2 : UI gestion des ordres conditionnels d'une unité
import { useState } from 'react'
import type {
  UnitOrderRow,
  OrderActionKindUI,
  OrderTriggerKindUI,
  SubmitOrdersOp,
} from '@hooks/usePreOrders'
import type { Cube } from '@engine/hex'
import { ACTION_LABEL, TRIGGER_LABEL, describePosture } from './orderLabels'

const TRIGGER_KINDS: OrderTriggerKindUI[] = ['on_attacked', 'enemy_in_range', 'cohesion_broken', 'enemy_los']
const ACTION_KINDS: OrderActionKindUI[] = ['charge', 'fire', 'retreat', 'hold']

interface OrdersPanelProps {
  isMyUnit: boolean
  orders: UnitOrderRow[]
  busy: boolean
  error: string | null
  /**
   * Phase 3.3 — portée max du trigger `enemy_in_range` quand action='fire'.
   * = stats.range de l'unité. Pour infanterie : 1 (mode alerte, frappe adjacente).
   * Pour archer/artillerie : leur range respective.
   */
  unitFireRange: number
  /**
   * Phase 3.3 — portée de vision de l'unité (sert de plafond pour actions
   * non-fire : on ne peut pas réagir à un ennemi qu'on ne voit pas).
   */
  unitVision: number
  onCreate: (trigger: SubmitOrdersOp['trigger'], action: SubmitOrdersOp['action']) => Promise<boolean>
  onUpdate: (orderId: string, patch: Omit<SubmitOrdersOp, 'op' | 'order_id'>) => Promise<boolean>
  onDelete: (orderId: string) => Promise<boolean>
  onReorder: (orderId: string, newPriority: number) => Promise<boolean>
  /**
   * Phase 3.3 Lot C — déclenche le mode "pick retreat hex" côté parent. Le parent
   * highlight les hex atteignables et invoque `onPicked(hex)` quand l'utilisateur
   * en sélectionne un. Optionnel : si absent, le bouton "Choisir destination" est
   * masqué (fallback comportement auto Phase 3.2).
   */
  onRequestPickRetreatHex?: (onPicked: (hex: Cube) => void) => void
}

export function OrdersPanel(p: OrdersPanelProps) {
  const { isMyUnit, orders, busy, error, unitFireRange, unitVision, onCreate, onUpdate: _onUpdate, onDelete, onReorder, onRequestPickRetreatHex } = p
  const [adding, setAdding] = useState(false)
  const [newTrigger, setNewTrigger] = useState<OrderTriggerKindUI>('enemy_in_range')
  const [newRange, setNewRange] = useState<number>(Math.min(3, Math.max(1, unitFireRange)))
  const [newAction, setNewAction] = useState<OrderActionKindUI>('hold')
  // Phase 3.3 Lot C — destination retreat sélectionnée par l'utilisateur (cliquée sur la map).
  // Null = fallback comportement auto (engine choisit le voisin le plus éloigné des ennemis).
  const [draftDestHex, setDraftDestHex] = useState<Cube | null>(null)

  // Phase 3.3 — borne max du slider portée. Si l'action est `fire`, on respecte la
  // range réelle de l'unité (infanterie 1, archer/arti leur range). Pour les autres
  // actions (charge/retreat/hold), on cappe à max(range, vision) : pas de
  // réaction à un ennemi qu'on ne pourrait ni voir ni atteindre (≠ ancien 10 fixe).
  const rangeMax = newAction === 'fire'
    ? Math.max(1, unitFireRange)
    : Math.max(1, unitFireRange, unitVision)

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
    setNewRange(Math.min(3, Math.max(1, unitFireRange)))
    setNewAction('hold')
    setDraftDestHex(null)
  }

  function cancelAdd() {
    setAdding(false)
    setDraftDestHex(null)
  }

  function requestPickHex() {
    if (!onRequestPickRetreatHex) return
    onRequestPickRetreatHex(hex => setDraftDestHex(hex))
  }

  async function commitAdd() {
    // Phase 3.3 — re-clamp à rangeMax au commit pour éviter envoi stale (ex : portée 5
    // saisie quand action='hold' puis switch vers 'fire' rangeMax=1).
    const clampedRange = Math.min(Math.max(1, newRange), rangeMax)
    const trigger: SubmitOrdersOp['trigger'] = newTrigger === 'enemy_in_range'
      ? { kind: 'enemy_in_range', params: { range: clampedRange } }
      : { kind: newTrigger }
    // Phase 3.3 Lot C — injecte destHex si retreat + user a cliqué une cible.
    const action: SubmitOrdersOp['action'] = newAction === 'retreat' && draftDestHex
      ? { kind: 'retreat', params: { destHex: { q: draftDestHex.q, r: draftDestHex.r, s: draftDestHex.s } } }
      : { kind: newAction }
    const ok = await onCreate(trigger, action)
    if (ok) {
      setAdding(false)
      setDraftDestHex(null)
    }
  }

  const preview = describePosture(
    newTrigger,
    newAction,
    newTrigger === 'enemy_in_range' ? Math.min(Math.max(1, newRange), rangeMax) : undefined,
  )

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
          {newAction === 'retreat' && onRequestPickRetreatHex && (
            <div className="text-[11px] space-y-1">
              <span className="block uppercase tracking-[0.08em] text-muted-foreground">
                Destination repli
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 border border-[rgba(96,165,250,0.4)] rounded-[2px] bg-[rgba(96,165,250,0.08)] text-[#60a5fa] hover:bg-[rgba(96,165,250,0.18)] disabled:opacity-40"
                  onClick={requestPickHex}
                  disabled={busy}
                >Choisir hex sur la map</button>
                <span className="text-muted-foreground">
                  {draftDestHex
                    ? `Vers (q=${draftDestHex.q}, r=${draftDestHex.r})`
                    : 'Vers : auto (engine choisit)'}
                </span>
                {draftDestHex && (
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-300 text-[10px]"
                    onClick={() => setDraftDestHex(null)}
                    title="Effacer destination"
                  >✕</button>
                )}
              </div>
            </div>
          )}
          {newTrigger === 'enemy_in_range' && (
            <label className="block text-[11px] space-y-1">
              <span className="uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-2">
                <span>Portée détection (hex)</span>
                {newAction === 'fire' && (
                  <span className="text-[9px] normal-case tracking-normal text-muted-foreground/70">
                    (max = portée de tir : {rangeMax})
                  </span>
                )}
              </span>
              <input
                type="number"
                min={1}
                max={rangeMax}
                value={Math.min(newRange, rangeMax)}
                onChange={e => setNewRange(Math.max(1, Math.min(rangeMax, Number(e.target.value) || 1)))}
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
