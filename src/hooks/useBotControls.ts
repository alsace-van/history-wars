// v1.0 (21/05/2026) — Phase 5 Lot 5.0 TASK 5.0.6 : extraction useBotAutoTurn + handleAddBot de Game.tsx
// Regroupe la logique bot solo (auto-trigger run_bot_turn + ajout bot via lobby UI).

import { useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@lib/supabase'
import { useBotAutoTurn } from '@hooks/useBotAutoTurn'
import type { Team } from '@/types/game'
import type { SlotData } from '@ui/game/TeamPanel'

const TAG = '[useBotControls v1.0]'

interface UseBotControlsParams {
  gameId: string | null
  showBattle: boolean
  activeTeam: Team
  players: Array<{ team: Team | null; is_bot: boolean }>
  iAmHost: boolean
  currentTurn: number
  blueSlots: SlotData[]
  redSlots: SlotData[]
  refresh: () => Promise<void>
  endTurn: (gameId: string) => Promise<unknown>
}

interface UseBotControlsResult {
  /** Handler ajout bot (host uniquement, slot vacant). À passer à TeamPanel.onAddBot. */
  handleAddBot: (team: Team, difficulty: 'easy' | 'medium' | 'hard') => Promise<void>
}

/**
 * Hook regroupant la logique bot solo MVP : auto-trigger du tour bot via EF
 * run_bot_turn (host only) et insertion d'un bot dans un slot vacant du lobby.
 *
 * useBotAutoTurn déclenche run_bot_turn quand activeTeam = bot. Après complétion,
 * 1.2s plus tard, on fait endTurn pour bascule auto vers le humain.
 */
export function useBotControls({
  gameId,
  showBattle,
  activeTeam,
  players,
  iAmHost,
  currentTurn,
  blueSlots,
  redSlots,
  refresh,
  endTurn,
}: UseBotControlsParams): UseBotControlsResult {
  // Auto-trigger run_bot_turn quand activeTeam = bot. Host only.
  useBotAutoTurn({
    gameId,
    activeTeam: showBattle ? activeTeam : null,
    players,
    iAmHost,
    currentTurn,
    enabled: showBattle,
    onBotTurnComplete: () => {
      if (!gameId) return
      void refresh()
      window.setTimeout(() => {
        void endTurn(gameId).catch((e: unknown) => {
          console.error(TAG, 'auto endTurn after bot failed', e)
        })
      }, 1200)
    },
  })

  // Ajout d'un bot dans un slot vacant. RLS migration 022 autorise host.
  const handleAddBot = useCallback(
    async (team: Team, difficulty: 'easy' | 'medium' | 'hard') => {
      if (!gameId) return
      const teamSlots = team === 'blue' ? blueSlots : redSlots
      const emptySlot = teamSlots.find(s => s.player === null)
      if (!emptySlot) {
        toast.error('Aucun slot vacant pour ajouter un bot')
        return
      }
      const { error } = await supabase.from('game_players').insert({
        game_id: gameId,
        user_id: null,
        team,
        slot_index: emptySlot.index,
        role: emptySlot.role,
        is_bot: true,
        bot_difficulty: difficulty,
      })
      if (error) {
        toast.error(`Bot impossible : ${error.message}`)
        return
      }
      toast.success(`🤖 Bot ${difficulty} ajouté au camp ${team === 'blue' ? 'bleu' : 'rouge'}`)
    },
    [gameId, blueSlots, redSlots],
  )

  return { handleAddBot }
}
