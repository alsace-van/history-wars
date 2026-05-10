// v1.0 (10/05/2026) — P1-L1C5-02 : Radix Dialog victoire + stats game_actions
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { supabase } from '@lib/supabase'
import type { Team } from '@/types/game'

const MODAL_CLIP =
  'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)'
const PRIMARY_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

interface EndGameModalProps {
  open: boolean
  onClose: () => void
  gameId: string
  winner: Team | null
  totalTurns: number
}

interface ActionStats {
  moves: number
  attackMelee: number
  attackRanged: number
  endTurns: number
}

const EMPTY_STATS: ActionStats = { moves: 0, attackMelee: 0, attackRanged: 0, endTurns: 0 }

export function EndGameModal({
  open,
  onClose,
  gameId,
  winner,
  totalTurns,
}: EndGameModalProps) {
  const [stats, setStats] = useState<ActionStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !gameId) {
      setStats(EMPTY_STATS)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const { data, error } = await supabase
        .from('game_actions')
        .select('action_type')
        .eq('game_id', gameId)
      if (cancelled) return
      if (error || !data) {
        // eslint-disable-next-line no-console
        console.error('[EndGameModal v1.0] fetch game_actions failed', error)
        setStats(EMPTY_STATS)
        setLoading(false)
        return
      }
      const acc: ActionStats = { ...EMPTY_STATS }
      for (const row of data) {
        const t = (row as { action_type: string }).action_type
        if (t === 'move') acc.moves++
        else if (t === 'attack_melee') acc.attackMelee++
        else if (t === 'attack_ranged') acc.attackRanged++
        else if (t === 'end_turn') acc.endTurns++
      }
      setStats(acc)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, gameId])

  const winnerLabel =
    winner === 'blue'
      ? 'Bleus victorieux'
      : winner === 'red'
        ? 'Rouges victorieux'
        : 'Égalité'
  const winnerColor =
    winner === 'blue' ? '#3b82f6' : winner === 'red' ? '#ef4444' : '#94a3b8'

  return (
    <Dialog.Root open={open} onOpenChange={next => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(2,6,23,0.78)] backdrop-blur-[6px] animate-fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-[440px] -translate-x-1/2 -translate-y-1/2 px-8 pt-8 pb-7 outline-none animate-slide-up"
          style={{
            background: 'rgba(20, 28, 50, 0.94)',
            border: '1px solid #EF9F27',
            clipPath: MODAL_CLIP,
            boxShadow:
              '0 0 0 4px rgba(8, 12, 24, 0.5), 0 30px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(239, 159, 39, 0.10)',
          }}
        >
          <span
            aria-hidden
            className="absolute top-0 right-0 w-[16px] h-[16px] opacity-40"
            style={{ background: 'linear-gradient(225deg, transparent 50%, #EF9F27 50%)' }}
          />
          <span aria-hidden className="absolute top-2 left-2 w-[14px] h-[14px] border border-tactica-amber border-r-0 border-b-0" />
          <span aria-hidden className="absolute bottom-2 left-2 w-[14px] h-[14px] border border-tactica-amber border-r-0 border-t-0" />
          <span aria-hidden className="absolute bottom-2 right-2 w-[14px] h-[14px] border border-tactica-amber border-l-0 border-t-0" />

          <Dialog.Title asChild>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber mb-1">
                Bataille achevée
              </div>
              <h2
                className="m-0 font-serif italic text-[26px] font-medium tracking-[0.02em]"
                style={{ color: winnerColor }}
              >
                {winnerLabel}
              </h2>
            </div>
          </Dialog.Title>

          <Dialog.Description className="mt-1 mb-6 text-[13px] italic text-muted-foreground">
            Le terrain est silencieux. Les compteurs sont arrêtés.
          </Dialog.Description>

          <div className="space-y-2 mb-6">
            <StatRow label="Tours joués" value={totalTurns} />
            <StatRow label="Mouvements" value={loading ? '…' : stats.moves} />
            <StatRow label="Charges (mêlée)" value={loading ? '…' : stats.attackMelee} />
            <StatRow label="Tirs" value={loading ? '…' : stats.attackRanged} />
            <StatRow label="Fins de tour résolues" value={loading ? '…' : stats.endTurns} />
          </div>

          <div className="flex justify-end pt-[18px] border-t border-[rgba(226,232,240,0.10)]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-[10px] text-[11px] font-semibold uppercase tracking-[0.12em] bg-tactica-amber text-[#0f172a] hover:bg-tactica-amber/90 cursor-pointer transition-colors"
              style={{ clipPath: PRIMARY_BTN_CLIP }}
            >
              Retour à la salle
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-[6px] px-3 bg-[rgba(2,6,23,0.4)] border border-[rgba(226,232,240,0.10)] rounded-[2px]">
      <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="text-[14px] font-semibold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  )
}
