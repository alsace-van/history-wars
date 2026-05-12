// v1.0 (12/05/2026) — QW1 : extrait du footer sidebar (officiers/online) de Game.tsx pour rester sous 600 lignes
import { cn } from '@lib/cn'
import { Bracket } from '@ui/game/Bracket'

interface BattleSidebarFooterProps {
  playersCount: number
  maxPlayers: number
  online: boolean
}

export function BattleSidebarFooter(p: BattleSidebarFooterProps) {
  const { playersCount, maxPlayers, online } = p
  return (
    <div className="relative p-4 border-t border-[rgba(226,232,240,0.18)] bg-[rgba(15,23,42,0.85)]">
      <div aria-hidden className="absolute top-[-1px] left-3 right-3 h-px opacity-40" style={{ background: 'linear-gradient(90deg, transparent, #EF9F27, transparent)' }} />
      <Bracket position="tl" /><Bracket position="tr" /><Bracket position="bl" /><Bracket position="br" />

      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
          <strong className="text-foreground font-semibold">{playersCount} / {maxPlayers} officiers</strong>
          {' · '}
          {playersCount < maxPlayers ? 'en attente' : 'effectif complet'}
        </div>
        <span className="flex items-center gap-[6px] text-[10px] uppercase tracking-[0.12em]" title={online ? 'Connecté au serveur' : 'Hors ligne — Realtime indisponible'}>
          <span aria-hidden className={cn('w-[7px] h-[7px] rounded-full shrink-0', online ? 'bg-emerald-400' : 'bg-red-500 animate-pulse')} />
          <span className={online ? 'text-muted-foreground' : 'text-red-400'}>{online ? 'En ligne' : 'Hors ligne'}</span>
        </span>
      </div>
    </div>
  )
}
