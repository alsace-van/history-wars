// v1.0 (09/05/2026) — Panneau d'equipe extrait de Game.tsx pour le sous-lot 6B
import type { GamePlayerWithProfile, PlayerRole, Team } from '@/types/game'
import { PlayerSlot, EmptyPlayerSlot } from '@ui/game/PlayerSlot'
import { cn } from '@lib/cn'

export interface SlotData {
  index: number
  team: Team
  role: PlayerRole
  player: GamePlayerWithProfile | null
}

interface TeamPanelProps {
  team: Team
  slots: SlotData[]
  hostUserId: string
  currentUserId: string
  canKick: boolean
  onKick: (playerId: string) => void
  /** Compact = sidebar mode (Lot 6B) */
  compact?: boolean
}

export function TeamPanel({
  team,
  slots,
  hostUserId,
  currentUserId,
  canKick,
  onKick,
  compact = false,
}: TeamPanelProps) {
  const filled = slots.filter(s => s.player !== null).length
  const total = slots.length
  const titleColor = team === 'blue' ? 'text-tactica-blue-bright' : 'text-tactica-red-bright'
  const borderTopColor =
    team === 'blue' ? 'border-t-tactica-blue-bright' : 'border-t-tactica-red-bright'
  const teamLabel = team === 'blue' ? 'État-Major Bleu' : 'État-Major Rouge'
  const teamSub = team === 'blue' ? 'Alliés' : 'Adversaires'

  return (
    <div
      className={cn(
        'bg-[rgba(15,23,42,0.85)] backdrop-blur-[6px] border border-[rgba(226,232,240,0.18)] border-t-[3px] rounded-[2px]',
        borderTopColor,
        compact ? 'p-3' : 'p-5'
      )}
    >
      <div className={cn('flex items-center justify-between', compact ? 'mb-2' : 'mb-[14px]')}>
        <div
          className={cn(
            'flex items-center gap-[8px] font-serif italic font-medium tracking-[0.03em]',
            compact ? 'text-[15px]' : 'text-[18px]',
            titleColor
          )}
        >
          {teamLabel}
          {!compact && (
            <span className="font-sans not-italic text-[9px] tracking-[0.2em] uppercase text-muted-foreground font-semibold">
              · {teamSub}
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
          {filled} / {total}
        </span>
      </div>

      {slots.map(s =>
        s.player ? (
          <PlayerSlot
            key={s.index}
            player={s.player}
            isCurrentUser={s.player.user_id === currentUserId}
            isHost={s.player.user_id === hostUserId}
            canKick={canKick && s.player.user_id !== currentUserId}
            onKick={onKick}
          />
        ) : (
          <EmptyPlayerSlot key={s.index} role={s.role} />
        )
      )}
    </div>
  )
}
