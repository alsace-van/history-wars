// v1.0 (08/05/2026) — Slot d'equipe pour la page Game
import { type GamePlayerWithProfile, type PlayerRole } from '@/types/game'
import { cn } from '@lib/cn'

interface FilledSlotProps {
  player: GamePlayerWithProfile
  isCurrentUser: boolean
  isHost: boolean
  canKick: boolean
  onKick: (playerId: string) => void
}

interface EmptySlotProps {
  role: PlayerRole
}

export function PlayerSlot(props: FilledSlotProps) {
  const { player, isCurrentUser, isHost, canKick, onKick } = props
  const team = player.team === 'red' ? 'red' : 'blue'
  const initial = (player.username ?? '?').charAt(0).toUpperCase()
  const roleLabel = player.role === 'general' ? 'Général' : 'Commandant'

  return (
    <div className="flex items-center gap-3 p-[12px_14px] bg-[rgba(2,6,23,0.45)] border border-[rgba(226,232,240,0.10)] rounded-[2px] mb-2 min-h-[60px] last:mb-0 hover:bg-[rgba(2,6,23,0.65)] transition-colors">
      <div
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0',
          team === 'blue' ? 'bg-tactica-blue text-white' : 'bg-tactica-red text-white'
        )}
        style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)' }}
      >
        {initial}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[6px] font-semibold text-[14px] text-foreground">
          <span className="truncate">{player.username ?? 'Inconnu'}</span>
          {isCurrentUser && (
            <span className="text-[9px] uppercase tracking-[0.18em] px-[5px] py-[2px] rounded-[2px] font-bold bg-tactica-green/20 text-tactica-green border border-tactica-green/40 shrink-0">
              Toi
            </span>
          )}
          {isHost && (
            <span className="text-[9px] uppercase tracking-[0.18em] px-[5px] py-[2px] rounded-[2px] font-bold bg-tactica-amber text-[#1a1208] shrink-0">
              Hôte
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-[0.18em] mt-[3px] font-medium">
          {roleLabel}
        </div>
      </div>

      {canKick && (
        <button
          onClick={() => onKick(player.id)}
          title="Renvoyer"
          aria-label="Renvoyer ce joueur"
          className="w-7 h-7 p-0 rounded-[2px] text-[16px] text-foreground/40 bg-transparent border border-transparent hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40 transition-colors"
        >
          ×
        </button>
      )}
    </div>
  )
}

export function EmptyPlayerSlot({ role }: EmptySlotProps) {
  const roleLabel = role === 'general' ? 'Général' : 'Commandant'
  return (
    <div className="flex items-center justify-center gap-2 p-[12px_14px] border border-dashed border-[rgba(226,232,240,0.18)] rounded-[2px] mb-2 min-h-[60px] last:mb-0 text-muted-foreground italic text-[12px] uppercase tracking-[0.1em]">
      <span>Slot vacant</span>
      <span className="not-italic text-foreground/35 ml-2 text-[10px]">— {roleLabel}</span>
    </div>
  )
}
