// v1.2 (13/05/2026) — Phase 3.2-bis : nom officier coloré par équipe (top-right)
// v1.1 (12/05/2026) — UX : bouton notif rapports combat (badge + toggle panel)
// v1.0 (10/05/2026) — extraction du header global Game.tsx (réduction Game.tsx < 600 lignes)

import type { Team } from '@/types/game'

interface GameTopBarProps {
  subtitleLabel: string
  username: string
  /** Phase 3.2-bis : couleur du nom officier = couleur de son équipe (FoW : self only). */
  myTeam?: Team | null
  onBack: () => void
  /**
   * Nombre de rapports combat dans le journal. Si > 0 → badge ambré sur le bouton notif.
   * Quand undefined ou 0, le bouton reste visible mais sans badge (état neutre).
   */
  combatReportsCount?: number
  /** Panel rapports actuellement ouvert ? Si oui, le bouton prend une teinte active. */
  combatReportsOpen?: boolean
  /** Toggle l'ouverture du panel rapports. Si undefined, bouton masqué (lobby). */
  onToggleCombatReports?: () => void
}

const TAG = '[GameTopBar v1.2]'
void TAG

export function GameTopBar({
  subtitleLabel,
  username,
  myTeam,
  onBack,
  combatReportsCount,
  combatReportsOpen = false,
  onToggleCombatReports,
}: GameTopBarProps) {
  const nameColor = myTeam === 'blue' ? '#60a5fa' : myTeam === 'red' ? '#f87171' : undefined
  const hasBadge = (combatReportsCount ?? 0) > 0
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
      <div className="flex items-center gap-4">
        {onToggleCombatReports && (
          <button
            type="button"
            onClick={onToggleCombatReports}
            aria-label={combatReportsOpen ? 'Fermer journal des combats' : 'Ouvrir journal des combats'}
            title={combatReportsOpen ? 'Fermer le journal des combats' : `Journal des combats${hasBadge ? ` (${combatReportsCount})` : ''}`}
            className={`relative inline-flex items-center gap-2 px-3 py-[6px] rounded-[2px] border text-[12px] uppercase tracking-[0.08em] transition-colors ${
              combatReportsOpen
                ? 'border-tactica-amber bg-tactica-amber/15 text-tactica-amber'
                : hasBadge
                  ? 'border-tactica-amber/50 text-tactica-amber hover:bg-tactica-amber/10'
                  : 'border-[rgba(226,232,240,0.20)] text-muted-foreground hover:text-foreground hover:border-[rgba(226,232,240,0.40)]'
            }`}
          >
            <span aria-hidden className="text-[14px] leading-none">⚔</span>
            <span>Rapports</span>
            {hasBadge && (
              <span
                aria-hidden
                className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-bold leading-none rounded-full bg-tactica-amber text-[#0b1020] tabular-nums"
              >
                {combatReportsCount! > 99 ? '99+' : combatReportsCount}
              </span>
            )}
          </button>
        )}
        <span className="text-[12px] text-muted-foreground tracking-[0.05em]">
          Officier{' '}
          <strong
            className="font-semibold"
            style={{ color: nameColor ?? undefined }}
          >
            {username}
          </strong>
        </span>
      </div>
      <div
        aria-hidden
        className="absolute left-10 right-10 -bottom-px h-px opacity-40"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #EF9F27 25%, #EF9F27 75%, transparent 100%)' }}
      />
    </header>
  )
}
