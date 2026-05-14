// v1.1 (14/05/2026) — Phase 4 : bouton "Spectateur" pour parties in_progress (non-membre)
// v1.0 (08/05/2026) — Carte d'une partie dans la liste du Lobby
import { type GameWithPlayers, isHost, isPlayerInGame, isGameFull } from '@/types/game'
import { Button } from '@ui/components/Button'
import { cn } from '@lib/cn'

interface GameCardProps {
  game: GameWithPlayers
  currentUserId: string | null
  onJoin: (gameId: string) => void
  onView: (gameId: string) => void
}

export function GameCard({ game, currentUserId, onJoin, onView }: GameCardProps) {
  const iAmHost = isHost(game, currentUserId)
  const iAmIn = isPlayerInGame(game.players, currentUserId)
  const isMine = iAmHost || iAmIn
  const full = isGameFull(game, game.players.length)
  const inProgress = game.status === 'in_progress'
  const hostPlayer = game.players.find(p => p.user_id === game.created_by)
  const hostName = hostPlayer?.username ?? '...'
  const ago = formatRelative(game.created_at)

  // Construit les pastilles de slots dans l'ordre 0..maxPlayers-1
  type DotKind = 'free' | 'blue' | 'red'
  const slotDots: DotKind[] = []
  for (let i = 0; i < game.max_players; i++) {
    const player = game.players.find(p => p.slot_index === i)
    if (!player) slotDots.push('free')
    else slotDots.push(player.team === 'red' ? 'red' : 'blue')
  }

  return (
    <div
      className={cn(
        'flex items-center gap-[18px] px-[22px] py-[18px]',
        'bg-[rgba(15,23,42,0.78)] backdrop-blur-[6px]',
        'border border-[rgba(226,232,240,0.10)] rounded-[2px]',
        'border-l-[3px] border-l-transparent',
        'mb-[10px] transition-all',
        'hover:border-l-tactica-amber hover:bg-[rgba(15,23,42,0.88)]',
        isMine && 'border-l-tactica-amber',
        full && !isMine && 'opacity-60'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[10px] font-serif italic font-semibold text-[19px] text-foreground">
          <span className="truncate">{game.name}</span>
          {isMine && (
            <span className="text-[9px] uppercase tracking-[0.18em] px-[7px] py-[3px] rounded-[2px] font-semibold bg-tactica-amber/20 text-tactica-amber border border-tactica-amber/40 not-italic shrink-0">
              {iAmHost ? 'Ma partie' : 'Tu es dedans'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-[18px] gap-y-1 mt-[6px] text-[11px] text-muted-foreground tracking-[0.05em] uppercase">
          <span>
            {hostName}
            {iAmHost ? ' · hôte' : ''}
          </span>
          <span className="opacity-40">/</span>
          <span>{game.scenario_id ?? '—'}</span>
          <span className="opacity-40">/</span>
          <span>{ago}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-[5px] min-w-[80px] shrink-0">
        <span
          className={cn(
            'font-serif text-[18px] font-semibold tracking-[0.05em]',
            full ? 'text-tactica-red-bright' : 'text-foreground'
          )}
        >
          {game.players.length} / {game.max_players}
        </span>
        <div className="flex gap-[4px]">
          {slotDots.map((kind, i) => (
            <span
              key={i}
              className={cn(
                'w-[9px] h-[9px] rounded-full border',
                kind === 'free' && 'bg-[rgba(226,232,240,0.12)] border-[rgba(226,232,240,0.20)]',
                kind === 'blue' && 'bg-tactica-blue-bright border-tactica-blue-bright',
                kind === 'red' && 'bg-tactica-red-bright border-tactica-red-bright'
              )}
            />
          ))}
        </div>
      </div>

      {isMine ? (
        <Button variant="outline" size="sm" onClick={() => onView(game.id)}>
          Voir
        </Button>
      ) : inProgress ? (
        <button
          onClick={() => onView(game.id)}
          className="inline-flex items-center justify-center gap-[6px] px-[14px] py-[7px] rounded-full text-[11px] font-semibold uppercase tracking-[0.12em] bg-tactica-amber/15 text-tactica-amber border border-tactica-amber/40 hover:bg-tactica-amber/25 transition-colors"
        >
          👁 Spectateur
        </button>
      ) : full ? (
        <Button variant="ghost" size="sm" disabled>
          Pleine
        </Button>
      ) : (
        <button
          onClick={() => onJoin(game.id)}
          className="inline-flex items-center justify-center gap-[6px] px-[14px] py-[7px] rounded-full text-[11px] font-semibold uppercase tracking-[0.12em] bg-tactica-blue-bright/15 text-tactica-blue-bright border border-tactica-blue-bright/40 hover:bg-tactica-blue-bright/25 transition-colors"
        >
          Rejoindre →
        </button>
      )}
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}
