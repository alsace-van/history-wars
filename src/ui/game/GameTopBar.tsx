// v1.0 (10/05/2026) — extraction du header global Game.tsx (réduction Game.tsx < 600 lignes)

interface GameTopBarProps {
  subtitleLabel: string
  username: string
  onBack: () => void
}

const TAG = '[GameTopBar v1.0]'
void TAG

export function GameTopBar({ subtitleLabel, username, onBack }: GameTopBarProps) {
  return (
    <header className="relative flex items-center justify-between px-10 py-[18px] border-b border-[rgba(226,232,240,0.18)] bg-gradient-to-b from-[rgba(8,12,24,0.85)] to-transparent shrink-0">
      <div className="flex items-center gap-[18px]">
        <button
          onClick={onBack}
          className="bg-transparent border-none text-muted-foreground hover:text-tactica-amber px-2 py-[6px] text-[12px] uppercase tracking-[0.12em] cursor-pointer transition-colors"
        >
          ← Salle de commandement
        </button>
        <div className="text-[20px] font-bold tracking-[0.32em] text-foreground">
          TACTICA
          <span className="ml-3 align-middle font-serif italic font-normal text-[18px] tracking-[0.04em] text-tactica-amber">
            — {subtitleLabel}
          </span>
        </div>
      </div>
      <span className="text-[12px] text-muted-foreground tracking-[0.05em]">
        Officier <strong className="text-foreground font-semibold">{username}</strong>
      </span>
      <div
        aria-hidden
        className="absolute left-10 right-10 -bottom-px h-px opacity-40"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #EF9F27 25%, #EF9F27 75%, transparent 100%)' }}
      />
    </header>
  )
}
