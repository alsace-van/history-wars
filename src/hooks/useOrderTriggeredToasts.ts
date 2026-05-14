// v1.0 (14/05/2026) — Phase 3.3 Lot A : toast côté owner quand un ordre conditionnel se déclenche
import { useRef } from 'react'
import { toast } from 'sonner'
import { useRealtime } from './useRealtime'
import { computeOrdinalLabels } from '@engine/units'
import type { UnitState } from '@engine/units'

interface OrderTriggeredPayload {
  posture_id?: string
  unit_id?: string
  resolved_action?: 'charge' | 'fire' | 'retreat' | 'hold'
  target_unit_id?: string | null
  skipped?: string | null
}

interface GameActionRow {
  id: string
  game_id: string
  turn: number
  actor_user_id: string | null
  action_type: string
  payload: OrderTriggeredPayload
}

interface UseOrderTriggeredToastsOptions {
  gameId: string | null
  viewerUserId: string | null
  units: ReadonlyArray<UnitState>
  enabled?: boolean
}

const ACTION_VERB: Record<'charge' | 'fire' | 'retreat' | 'hold', string> = {
  charge: 'charge',
  fire: 'tire',
  retreat: 'se replie',
  hold: 'tient sa position',
}

const SKIP_REASON_LABEL: Record<string, string> = {
  cohesion_broken: 'cohésion brisée',
  no_target: 'aucune cible',
  out_of_range: 'hors portée',
  has_attacked: 'déjà attaqué ce tour',
  has_moved: 'déjà déplacé ce tour',
}

/**
 * Écoute les `game_actions(action_type='order_triggered')` et émet un toast
 * uniquement si `actor_user_id === viewerUserId` (privacy : l'adversaire ne
 * doit pas voir les ordres conditionnels de l'owner).
 */
export function useOrderTriggeredToasts({
  gameId,
  viewerUserId,
  units,
  enabled = true,
}: UseOrderTriggeredToastsOptions): void {
  const viewerUserIdRef = useRef(viewerUserId)
  viewerUserIdRef.current = viewerUserId
  const unitsRef = useRef(units)
  unitsRef.current = units

  useRealtime({
    channelName: gameId ? `order-toasts:${gameId}` : '',
    enabled: enabled && !!gameId && !!viewerUserId,
    postgresChanges: gameId
      ? [
          {
            table: 'game_actions',
            event: 'INSERT',
            filter: `game_id=eq.${gameId}`,
            onChange: payload => {
              const row = (payload as { new?: GameActionRow }).new
              if (!row || row.action_type !== 'order_triggered') return
              if (!row.actor_user_id || row.actor_user_id !== viewerUserIdRef.current) return

              const pl = row.payload ?? {}
              const action = pl.resolved_action
              if (!action) return

              const labels = computeOrdinalLabels(unitsRef.current)
              const actorLabel = pl.unit_id ? labels.get(pl.unit_id) ?? 'Unité' : 'Unité'
              const targetLabel = pl.target_unit_id ? labels.get(pl.target_unit_id) ?? null : null

              if (pl.skipped) {
                const reason = SKIP_REASON_LABEL[pl.skipped] ?? pl.skipped
                toast(`Ordre ignoré — ${actorLabel}`, { description: reason, duration: 3500 })
                return
              }

              const verb = ACTION_VERB[action]
              const title = targetLabel
                ? `Ordre déclenché — ${actorLabel} ${verb} sur ${targetLabel}`
                : `Ordre déclenché — ${actorLabel} ${verb}`
              toast(title, { duration: 3500 })
            },
          },
        ]
      : undefined,
  })
}
