// v1.0 (08/05/2026) — Hook Realtime parametrable : postgres_changes + presence
import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@lib/supabase'

const TAG = '[useRealtime v1.0]'

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface PostgresChangeConfig {
  table: string
  event?: ChangeEvent
  filter?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (payload: any) => void  // any : payload Supabase non typifiable strict
}

export interface PresenceConfig {
  userId: string
  userMeta?: Record<string, unknown>
  onSync?: (state: Record<string, unknown[]>) => void
}

interface UseRealtimeOptions {
  channelName: string
  enabled?: boolean
  postgresChanges?: PostgresChangeConfig[]
  presence?: PresenceConfig
}

/**
 * Souscrit a un channel Supabase Realtime.
 * - postgresChanges : ecoute des INSERT/UPDATE/DELETE sur des tables (filtrables).
 * - presence : tracking de qui est en ligne sur le channel.
 *
 * Le channel est recree quand `channelName` ou `enabled` change. Les callbacks
 * sont stockes en ref donc passer un nouveau tableau de configs n'est pas un
 * probleme (pas de re-subscription inutile).
 *
 * Retourne `{ stale }` : true si le channel est en erreur ou ferme.
 * Le caller peut s'en servir pour declencher un refetch au reconnect.
 */
export function useRealtime({
  channelName,
  enabled = true,
  postgresChanges,
  presence
}: UseRealtimeOptions): { stale: boolean } {
  const [stale, setStale] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Refs pour les callbacks : permettent de mettre a jour les handlers sans
  // re-subscriber le channel.
  const changesRef = useRef<PostgresChangeConfig[]>(postgresChanges ?? [])
  changesRef.current = postgresChanges ?? []

  const presenceRef = useRef<PresenceConfig | undefined>(presence)
  presenceRef.current = presence

  // Pour eviter de re-track si seul user_meta change
  const presenceUserId = presence?.userId

  useEffect(() => {
    if (!enabled || !channelName) return

    const presenceCfg = presenceRef.current
    const channel = supabase.channel(channelName, {
      config: presenceCfg ? { presence: { key: presenceCfg.userId } } : {}
    })

    // postgres_changes : on bind avec un closure sur l'index pour relire le ref
    const initialChanges = changesRef.current
    initialChanges.forEach((cfg, idx) => {
      channel.on(
        'postgres_changes',
        {
          event: cfg.event ?? '*',
          schema: 'public',
          table: cfg.table,
          ...(cfg.filter ? { filter: cfg.filter } : {})
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          changesRef.current[idx]?.onChange(payload)
        }
      )
    })

    if (presenceCfg) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>
        presenceRef.current?.onSync?.(state)
      })
    }

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setStale(false)
        const cfg = presenceRef.current
        if (cfg) {
          await channel.track({
            user_id: cfg.userId,
            ...(cfg.userMeta ?? {})
          })
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // eslint-disable-next-line no-console
        console.warn(TAG, 'channel issue', { channelName, status })
        setStale(true)
      }
    })

    channelRef.current = channel

    return () => {
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
    // Re-subscribe quand le channel change. presenceUserId aussi car la cle
    // de presence est config-time, pas runtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled, presenceUserId])

  return { stale }
}
