// v1.1 (13/05/2026) — Phase 3.2-bis : callback onEndTurnSuccess avec payload (engagementTicks)
// v1.0 (12/05/2026) — QW1 : extraction des handlers cycle de vie (leave/kick/start/endTurn/breakCombat) de Game.tsx
import { useCallback } from 'react'
import { toast } from 'sonner'
import type { GameAction, EndTurnResponse } from '@hooks/useCombatActions'
import type { UnitState } from '@engine/units'

interface ActionResult {
  error: string | null
}

interface UseGameLifecycleParams {
  gameId: string | null
  iAmHost: boolean
  busy: boolean
  setBusy: (b: boolean) => void
  deleteGame: () => Promise<ActionResult>
  leaveGame: () => Promise<ActionResult>
  kickPlayer: (playerId: string) => Promise<ActionResult>
  canStart: boolean
  inProgress: boolean
  isMyTurn: boolean
  actionsBusy: boolean
  startBattle: (gameId: string) => Promise<{ ok: boolean }>
  endTurn: (gameId: string) => Promise<EndTurnResponse>
  submitAction: (gameId: string, action: GameAction) => Promise<{ ok: boolean }>
  refresh: () => Promise<void>
  clearSelection: () => void
  selectedUnit: UnitState | null
  engagedUnitIds: Set<string>
  navigate: (path: string) => void
  /** Phase 3.2-bis : invoqué après endTurn ok pour dispatcher les ticks d'engagement (toasts + floaters). */
  onEndTurnSuccess?: (res: EndTurnResponse) => void
}

export interface UseGameLifecycleResult {
  handleLeave: () => Promise<void>
  handleKick: (playerId: string) => Promise<void>
  handleStartBattle: () => Promise<void>
  handleEndTurn: () => Promise<void>
  handleBreakCombat: () => Promise<void>
}

export function useGameLifecycle(p: UseGameLifecycleParams): UseGameLifecycleResult {
  const {
    gameId, iAmHost, busy, setBusy, deleteGame, leaveGame, kickPlayer,
    canStart, inProgress, isMyTurn, actionsBusy,
    startBattle, endTurn, submitAction, refresh, clearSelection,
    selectedUnit, engagedUnitIds, navigate, onEndTurnSuccess,
  } = p

  const handleLeave = useCallback(async () => {
    if (busy) return
    if (iAmHost) {
      const ok = window.confirm("Tu es l'hôte. Quitter va dissoudre la partie pour tous les joueurs. Continuer ?")
      if (!ok) return
      setBusy(true)
      const { error } = await deleteGame()
      setBusy(false)
      if (error) { toast.error(error); return }
      toast.success('Partie dissoute.')
      navigate('/lobby')
    } else {
      setBusy(true)
      const { error } = await leaveGame()
      setBusy(false)
      if (error) { toast.error(error); return }
      toast.success('Tu as quitté la partie.')
      navigate('/lobby')
    }
  }, [busy, iAmHost, setBusy, deleteGame, leaveGame, navigate])

  const handleKick = useCallback(async (playerId: string) => {
    if (!iAmHost || busy) return
    setBusy(true)
    const { error } = await kickPlayer(playerId)
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success('Officier renvoyé.')
  }, [iAmHost, busy, setBusy, kickPlayer])

  const handleStartBattle = useCallback(async () => {
    if (!gameId || !canStart || actionsBusy) return
    const res = await startBattle(gameId)
    if (res.ok) toast.success('Bataille engagée.')
  }, [gameId, canStart, actionsBusy, startBattle])

  const handleEndTurn = useCallback(async () => {
    if (!gameId || !inProgress || !isMyTurn || actionsBusy) return
    const res = await endTurn(gameId)
    if (res.ok) {
      clearSelection()
      // Phase 2.5 fix : ne pas dépendre uniquement de Realtime (qui peut décrocher).
      void refresh()
      toast.success('Tour terminé.')
      onEndTurnSuccess?.(res)
    }
  }, [gameId, inProgress, isMyTurn, actionsBusy, endTurn, clearSelection, refresh, onEndTurnSuccess])

  const handleBreakCombat = useCallback(async () => {
    if (!gameId || !selectedUnit || !isMyTurn || actionsBusy) return
    if (!engagedUnitIds.has(selectedUnit.id)) return
    const res = await submitAction(gameId, {
      type: 'break_combat',
      payload: { unit_id: selectedUnit.id },
    })
    if (res.ok) {
      void refresh()
      toast.success('Combat rompu.')
    }
  }, [gameId, selectedUnit, isMyTurn, actionsBusy, engagedUnitIds, submitAction, refresh])

  return { handleLeave, handleKick, handleStartBattle, handleEndTurn, handleBreakCombat }
}
