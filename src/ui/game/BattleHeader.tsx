// v1.0 (12/05/2026) — QW1 : extrait du bloc "Ordre de bataille" de Game.tsx pour rester sous 600 lignes
interface BattleHeaderProps {
  statusLabel: string
  gameName: string
  scenarioId: string | null
  scaleLabel: string
  hostName: string
  turnNumber: number
}

export function BattleHeader(p: BattleHeaderProps) {
  return (
    <div className="px-10 py-5 border-b border-[rgba(226,232,240,0.10)] shrink-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber mb-[4px]">
        Ordre de bataille — {p.statusLabel}
      </div>
      <h1 className="font-serif italic text-[28px] font-medium m-0 leading-[1.1] text-foreground">
        {p.gameName}
      </h1>
      <div className="text-muted-foreground text-[10px] uppercase tracking-[0.08em] flex flex-wrap gap-x-[12px] gap-y-1 mt-1">
        <span>{p.scenarioId ?? '—'}</span>
        <span className="opacity-40">/</span>
        <span>{p.scaleLabel}</span>
        <span className="opacity-40">/</span>
        <span>Hôte : {p.hostName}</span>
        <span className="opacity-40">/</span>
        <span>Tour {p.turnNumber}</span>
      </div>
    </div>
  )
}
