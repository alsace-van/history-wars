// v1.0 (10/05/2026) — Phase 2 2.5 : queue de DamageFloater déclenchée par notifications combat
// Source : useCombatNotifications fournit notifications + unitStates. Le hook pousse 1-2 floaters par
// combat (défenseur + attaquant si riposte), respecte useSettings.animationSpeed, et expose un skip
// global (vide la queue via touche Espace).
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Cube } from '@engine/hex'
import type { UnitState } from '@engine/units'
import type { CombatNotification } from './useCombatNotifications'

export interface DamageFloaterEntry {
  id: string
  cube: Cube
  killed: number
  wounded: number
  /** Timestamp ms (performance.now relative) où le floater a démarré. */
  startedAt: number
}

interface UseCombatAnimatorParams {
  notifications: ReadonlyArray<CombatNotification>
  unitStates: ReadonlyArray<UnitState>
  /** Durée de montée d'un floater. Si 0 → désactivé (aucun floater n'est ajouté). */
  animationDurationMs: number
  /** Activer ou non l'observation du keydown. Désactivé en briefing/finished. */
  enabled?: boolean
}

interface UseCombatAnimatorResult {
  floaters: ReadonlyArray<DamageFloaterEntry>
  /** Retirer un floater (appelé par DamageFloater quand l'anim finit). */
  removeFloater: (id: string) => void
  /** Vider la queue (skip Espace, ou changement de partie). */
  clear: () => void
}

/**
 * Hook qui transforme la queue `notifications` en une queue de DamageFloater 3D
 * positionnés sur les cibles. Anti-doublon par `notifId+role` (def/atk).
 *
 * Note : on lit la dernière notif via une ref pour ne pousser qu'une fois par
 * arrivée Realtime, même si `notifications` re-render après removal d'autres entrées.
 */
export function useCombatAnimator({
  notifications,
  unitStates,
  animationDurationMs,
  enabled = true,
}: UseCombatAnimatorParams): UseCombatAnimatorResult {
  const [floaters, setFloaters] = useState<DamageFloaterEntry[]>([])
  const seenIdsRef = useRef<Set<string>>(new Set())

  // Sync : pour chaque notif jamais vue, ajouter les floaters correspondants.
  useEffect(() => {
    if (!enabled || animationDurationMs <= 0) return
    if (notifications.length === 0) return
    const toAdd: DamageFloaterEntry[] = []
    for (const n of notifications) {
      if (seenIdsRef.current.has(n.id)) continue
      seenIdsRef.current.add(n.id)
      const defenderUnit = unitStates.find(u => u.id === n.defenderId)
      if (defenderUnit && (n.defenderLosses.killed > 0 || n.defenderLosses.woundedAdd > 0)) {
        toAdd.push({
          id: `${n.id}-def`,
          cube: defenderUnit.position,
          killed: n.defenderLosses.killed,
          wounded: n.defenderLosses.woundedAdd,
          startedAt: performance.now(),
        })
      }
      if (n.attackerLosses) {
        const attackerUnit = unitStates.find(u => u.id === n.attackerId)
        if (attackerUnit && (n.attackerLosses.killed > 0 || n.attackerLosses.woundedAdd > 0)) {
          toAdd.push({
            id: `${n.id}-atk`,
            cube: attackerUnit.position,
            killed: n.attackerLosses.killed,
            wounded: n.attackerLosses.woundedAdd,
            startedAt: performance.now(),
          })
        }
      }
    }
    if (toAdd.length > 0) {
      setFloaters(prev => [...prev, ...toAdd])
    }
  }, [notifications, unitStates, animationDurationMs, enabled])

  const removeFloater = useCallback((id: string) => {
    setFloaters(prev => prev.filter(f => f.id !== id))
  }, [])

  const clear = useCallback(() => {
    setFloaters([])
  }, [])

  // Skip global via touche Espace : vide la queue immédiatement.
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      // Ignorer si focus dans un input/textarea/contentEditable (saisie utilisateur)
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      setFloaters(prev => (prev.length > 0 ? [] : prev))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])

  return { floaters, removeFloater, clear }
}
