// v1.0 (10/05/2026) — P1-L1C5-01 : bandeau bas Engager / Fin de tour / Quitter
import { cn } from '@lib/cn'
import type { GameStatus } from '@/types/game'

interface GameHUDProps {
  status: GameStatus
  iAmHost: boolean
  iAmIn: boolean
  isMyTurn: boolean
  canStart: boolean
  /** Texte info pour expliquer pourquoi Engager est desactive (null = pas de tooltip) */
  startTooltip: string | null
  busy: boolean
  actionsBusy: boolean
  onStartBattle: () => void
  onEndTurn: () => void
  onLeave: () => void
}

const PRIMARY_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

export function GameHUD({
  status,
  iAmHost,
  iAmIn,
  isMyTurn,
  canStart,
  startTooltip,
  busy,
  actionsBusy,
  onStartBattle,
  onEndTurn,
  onLeave,
}: GameHUDProps) {
  const isLobby = status === 'lobby'
  const isInProgress = status === 'in_progress'

  return (
    <div className="absolute bottom-0 left-0 right-0 px-10 py-3 bg-[rgba(8,12,24,0.85)] backdrop-blur-[6px] border-t border-[rgba(226,232,240,0.18)] flex items-center justify-end gap-3 pointer-events-auto">
      <div
        aria-hidden
        className="absolute top-0 left-3 right-3 h-px opacity-40"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, #EF9F27 50%, transparent 100%)',
        }}
      />

      {/* Engager la bataille — host + lobby uniquement */}
      {isLobby && iAmHost && (
        <span className="relative group">
          <button
            disabled={!canStart || actionsBusy}
            onClick={onStartBattle}
            className={cn(
              'px-5 py-[10px] text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors',
              canStart && !actionsBusy
                ? 'bg-tactica-amber text-[#0f172a] hover:bg-tactica-amber/90 cursor-pointer'
                : 'bg-tactica-amber/20 text-tactica-amber/40 cursor-not-allowed'
            )}
            style={{ clipPath: PRIMARY_BTN_CLIP }}
          >
            {actionsBusy ? 'Lancement…' : 'Engager la bataille'}
          </button>
          {startTooltip && (
            <span className="absolute bottom-full right-0 mb-[6px] whitespace-nowrap text-[10px] uppercase tracking-[0.12em] bg-[rgba(8,12,24,0.95)] border border-tactica-amber px-[10px] py-[6px] rounded-[2px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {startTooltip}
            </span>
          )}
        </span>
      )}

      {/* Fin de tour — en bataille, seulement quand c'est mon tour */}
      {isInProgress && isMyTurn && iAmIn && (
        <button
          onClick={onEndTurn}
          disabled={actionsBusy}
          className={cn(
            'px-5 py-[10px] text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors',
            'bg-tactica-amber text-[#0f172a] hover:bg-tactica-amber/90 cursor-pointer',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          style={{ clipPath: PRIMARY_BTN_CLIP }}
        >
          {actionsBusy ? 'Envoi…' : 'Fin de tour'}
        </button>
      )}

      {/* Quitter / Dissoudre — visible si dans la partie */}
      {iAmIn && (
        <button
          onClick={onLeave}
          disabled={busy}
          className="bg-transparent border border-destructive/50 text-destructive hover:bg-destructive hover:text-white disabled:opacity-50 disabled:cursor-not-allowed px-4 py-[7px] text-[11px] font-semibold uppercase tracking-[0.12em] rounded-[2px] transition-colors"
        >
          {iAmHost ? 'Dissoudre' : 'Quitter'}
        </button>
      )}
    </div>
  )
}
