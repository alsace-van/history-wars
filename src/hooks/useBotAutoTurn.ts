// v1.0 (14/05/2026) — Phase 4 Lot A5 : déclenche EF run_bot_turn quand activeTeam = bot
// Anti-double-trigger : seul le host appelle (les autres clients voient le résultat via Realtime).
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '@lib/supabase'
import type { Team } from '@/types/game'

interface UseBotAutoTurnOptions {
  gameId: string | null
  /** Camp dont c'est le tour. */
  activeTeam: Team | null
  /** Liste des game_players (Realtime). On scanne pour détecter is_bot=true sur activeTeam. */
  players: ReadonlyArray<{ team: Team | null; is_bot: boolean }>
  /** Le client courant est-il le host ? Seul lui invoke run_bot_turn (anti-doublon). */
  iAmHost: boolean
  /** Numéro de tour courant (Phase 4 : sert d'idempotency dans la ref locale). */
  currentTurn: number
  enabled?: boolean
  /** Callback post-EF (typiquement : endTurn pour basculer activeTeam). */
  onBotTurnComplete?: () => void
}

/**
 * Auto-invoke run_bot_turn quand l'activeTeam contient au moins 1 bot. Seul le host
 * déclenche (sinon plusieurs clients invoke en parallèle → race condition + game_actions
 * dupliquées). Idempotence locale via `lastTriggeredTurnRef` (1 trigger par tour entrant).
 */
export function useBotAutoTurn(opts: UseBotAutoTurnOptions): void {
  const { gameId, activeTeam, players, iAmHost, currentTurn, enabled = true, onBotTurnComplete } = opts
  const lastTriggeredTurnRef = useRef<number | null>(null)

  useEffect(() => {
    const botsOnActive = players.filter(p => p.team === activeTeam && p.is_bot).length
    // eslint-disable-next-line no-console
    console.log(`[useBotAutoTurn] gameId=${gameId} activeTeam=${activeTeam} iAmHost=${iAmHost} enabled=${enabled} turn=${currentTurn} lastTrig=${lastTriggeredTurnRef.current} playersN=${players.length} botsActive=${botsOnActive}`)
    if (!enabled || !gameId || !activeTeam || !iAmHost) { console.log('[useBotAutoTurn] SKIP : guard fail'); return }
    if (lastTriggeredTurnRef.current === currentTurn) { console.log('[useBotAutoTurn] SKIP : already triggered turn', currentTurn); return }

    const hasBot = players.some(p => p.team === activeTeam && p.is_bot)
    if (!hasBot) { console.log('[useBotAutoTurn] SKIP : no bot on active team', activeTeam); return }

    console.log('[useBotAutoTurn] >>> TRIGGER invoke run_bot_turn for turn', currentTurn)
    lastTriggeredTurnRef.current = currentTurn

    // Invoke direct (pas de setTimeout : le cleanup useEffect en annulait l'exécution).
    // Le toast.loading sert juste de feedback visuel pendant l'appel.
    const loading = toast.loading('🤖 Bot joue son tour…')
    console.log('[useBotAutoTurn] calling supabase.functions.invoke(run_bot_turn)…')
    supabase.functions.invoke('run_bot_turn', { body: { game_id: gameId } })
      .then(({ data, error }) => {
        toast.dismiss(loading)
        if (error) {
          console.error('[useBotAutoTurn] EF error', error)
          toast.error(`Bot turn failed : ${error.message}`)
          return
        }
        const result = data as { ok?: boolean; actions_applied?: number }
        console.log('[useBotAutoTurn] EF result', result)
        if (result?.ok) {
          toast.success(`🤖 Bot a joué ${result.actions_applied ?? 0} action(s)`)
          onBotTurnComplete?.()
        }
      })
      .catch(e => {
        toast.dismiss(loading)
        console.error('[useBotAutoTurn] EF exception', e)
        toast.error(`Bot turn exception : ${e instanceof Error ? e.message : 'unknown'}`)
      })
  }, [enabled, gameId, activeTeam, players, iAmHost, currentTurn, onBotTurnComplete])
}
