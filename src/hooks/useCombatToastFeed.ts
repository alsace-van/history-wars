// v1.0 (12/05/2026) — QW1 : extraction du panel combat (toast + open state + auto-close) de Game.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { CombatNotification } from '@hooks/useCombatNotifications'

interface UseCombatToastFeedParams {
  combatNotifs: ReadonlyArray<CombatNotification>
}

export interface UseCombatToastFeedResult {
  combatPanelOpen: boolean
  setCombatPanelOpen: (open: boolean) => void
  toggleCombatPanel: () => void
}

/**
 * Journal des combats (v3.23 Game.tsx) :
 *  - Panel replié par défaut.
 *  - Chaque nouvelle notif déclenche un toast bref avec action "Détail" → ouvre panel.
 *  - Auto-close si la liste devient vide (clear).
 */
export function useCombatToastFeed(p: UseCombatToastFeedParams): UseCombatToastFeedResult {
  const { combatNotifs } = p

  const [combatPanelOpen, setCombatPanelOpen] = useState(false)
  const prevCombatNotifLenRef = useRef(0)

  useEffect(() => {
    const prev = prevCombatNotifLenRef.current
    prevCombatNotifLenRef.current = combatNotifs.length
    if (combatNotifs.length <= prev) return
    const last = combatNotifs[combatNotifs.length - 1]
    const phase = last.kind === 'charge' ? 'Charge cav' : last.kind === 'melee' ? 'Mêlée' : 'Tir'
    const perspective = last.isMyAttack
      ? `${phase} : ${last.attackerKindLabel} → ${last.defenderKindLabel} adverse`
      : `${phase} subi : ${last.attackerKindLabel} adverse → ${last.defenderKindLabel}`
    const losses = last.defenderLosses
    const subtitle = losses.isKilled
      ? `${last.defenderKindLabel} décimée`
      : `${losses.killed} morts au combat`
    toast(perspective, {
      description: subtitle,
      duration: 4000,
      action: {
        label: 'Détail',
        onClick: () => setCombatPanelOpen(true),
      },
    })
  }, [combatNotifs])

  useEffect(() => {
    if (combatPanelOpen && combatNotifs.length === 0) setCombatPanelOpen(false)
  }, [combatPanelOpen, combatNotifs.length])

  const toggleCombatPanel = useCallback(() => {
    setCombatPanelOpen(prev => !prev)
  }, [])

  return { combatPanelOpen, setCombatPanelOpen, toggleCombatPanel }
}
