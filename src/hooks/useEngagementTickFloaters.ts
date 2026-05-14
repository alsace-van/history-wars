// v1.0 (13/05/2026) — QW2 : extraction de handleEndTurnSuccess + tickFloaters de Game.tsx (Phase 3.2-bis)
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import type { DamageFloaterEntry } from '@hooks/useCombatAnimator'
import type { EndTurnResponse } from '@hooks/useCombatActions'
import type { UnitState } from '@engine/units'
import type { Team } from '@/types/game'
import { getKindLabel } from '@ui/game/gameLabels'

interface UseEngagementTickFloatersParams {
  myTeam: Team | null
  unitStates: ReadonlyArray<UnitState>
  /** Durée d'anim des floaters (0 = désactivés, on n'en pousse pas). */
  animationDurationMs: number
}

interface UseEngagementTickFloatersResult {
  tickFloaters: ReadonlyArray<DamageFloaterEntry>
  removeTickFloater: (id: string) => void
  /** À passer à useGameLifecycle.onEndTurnSuccess. */
  handleEndTurnSuccess: (res: EndTurnResponse) => void
}

/**
 * Phase 3.2-bis — découplé de useCombatAnimator (qui traite les CombatNotification Realtime).
 * Reçoit les engagement_ticks renvoyés synchronement par resolve_turn, émet :
 *  - un toast "Combat continu (T+N)" relativisé à myTeam
 *  - des DamageFloaters (id préfixé "tick-") sur la position de chaque unité ayant subi des pertes
 *
 * Les floaters sont identifiés par préfixe "tick-" pour permettre au removeFloater côté Game.tsx
 * de router vers la bonne file (ticks vs combat standard).
 */
export function useEngagementTickFloaters(
  p: UseEngagementTickFloatersParams,
): UseEngagementTickFloatersResult {
  const { myTeam, unitStates, animationDurationMs } = p

  const [tickFloaters, setTickFloaters] = useState<DamageFloaterEntry[]>([])

  const removeTickFloater = useCallback((id: string) => {
    setTickFloaters(prev => prev.filter(f => f.id !== id))
  }, [])

  const handleEndTurnSuccess = useCallback((res: EndTurnResponse) => {
    const ticks = res.engagementTicks
    if (!ticks || ticks.length === 0) return
    const newFloaters: DamageFloaterEntry[] = []
    for (const t of ticks) {
      const turnsActive = t.resolved_at_turn - t.started_turn + 1
      // Toast relativisé à myTeam (ton camp en premier).
      const sides = [t.side_a, t.side_b]
      const mine = sides.find(s => s.team === myTeam)
      const enemy = sides.find(s => s.team !== myTeam)
      const parts: string[] = []
      if (mine && (mine.killed > 0 || mine.dissolved)) {
        const label = getKindLabel(mine.kind)
        parts.push(mine.dissolved ? `Ton ${label} décimée` : `Ton ${label} : −${mine.killed}`)
      }
      if (enemy && (enemy.killed > 0 || enemy.dissolved)) {
        const label = getKindLabel(enemy.kind)
        parts.push(enemy.dissolved ? `${label} adverse décimée` : `${label} adverse : −${enemy.killed}`)
      }
      if (parts.length > 0) {
        toast(`Combat continu (T+${turnsActive})`, {
          description: parts.join(' · '),
          duration: 4500,
        })
      }
      // DamageFloaters : un par côté qui prend des pertes, position = unité avant tick.
      if (animationDurationMs > 0) {
        const aUnit = unitStates.find(u => u.id === t.side_a.unit_id)
        const bUnit = unitStates.find(u => u.id === t.side_b.unit_id)
        const stamp = performance.now()
        if (aUnit && (t.side_a.killed > 0 || t.side_a.wounded_add > 0)) {
          newFloaters.push({
            id: `tick-${t.engagement_id}-a-${stamp}`,
            cube: aUnit.position,
            killed: t.side_a.killed,
            wounded: t.side_a.wounded_add,
            startedAt: stamp,
          })
        }
        if (bUnit && (t.side_b.killed > 0 || t.side_b.wounded_add > 0)) {
          newFloaters.push({
            id: `tick-${t.engagement_id}-b-${stamp}`,
            cube: bUnit.position,
            killed: t.side_b.killed,
            wounded: t.side_b.wounded_add,
            startedAt: stamp,
          })
        }
      }
    }
    if (newFloaters.length > 0) {
      setTickFloaters(prev => [...prev, ...newFloaters])
    }
  }, [myTeam, unitStates, animationDurationMs])

  return { tickFloaters, removeTickFloater, handleEndTurnSuccess }
}
