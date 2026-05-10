// v1.0 (10/05/2026) — Phase 1.5 fix UX : panneau resultat combat persistant (X close), libelles equipes explicites
import type { Team } from '@/types/game'
import type { CombatNotification } from '@hooks/useCombatNotifications'

interface CombatResultPanelProps {
  notif: CombatNotification
  pendingCount: number
  onClose: () => void
}

const TEAM_COLOR: Record<Team, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
}

const TEAM_NAME: Record<Team, string> = {
  blue: 'Bleus',
  red: 'Rouges',
}

export function CombatResultPanel({ notif, pendingCount, onClose }: CombatResultPanelProps) {
  const actionLabel = notif.kind === 'melee' ? 'Charge' : 'Tir'
  const titleColor = notif.isMyAttack ? TEAM_COLOR[notif.attackerTeam] : TEAM_COLOR[notif.defenderTeam]

  // Resume de l'engagement en titre
  const titleSummary = notif.isMyAttack
    ? `${actionLabel} : ${notif.attackerKindLabel} ${TEAM_NAME[notif.attackerTeam]} vs ${notif.defenderKindLabel} ${TEAM_NAME[notif.defenderTeam]}`
    : `${actionLabel} subi : ${notif.attackerKindLabel} ${TEAM_NAME[notif.attackerTeam]} attaque votre ${notif.defenderKindLabel}`

  return (
    <div
      className="absolute bottom-[80px] right-3 w-[340px] max-w-[90vw] z-40 pointer-events-auto animate-slide-up"
      role="dialog"
      aria-live="polite"
    >
      <div
        className="bg-[rgba(8,12,24,0.95)] backdrop-blur-[6px] border rounded-[2px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        style={{ borderColor: titleColor }}
      >
        {/* Bandeau titre */}
        <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2 border-b" style={{ borderColor: 'rgba(226,232,240,0.10)' }}>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-[2px]">
              ⚔ Bilan combat{pendingCount > 1 ? ` · ${pendingCount} en attente` : ''}
            </div>
            <div
              className="text-[12px] font-semibold uppercase tracking-[0.04em] leading-tight"
              style={{ color: titleColor }}
            >
              {titleSummary}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[rgba(226,232,240,0.08)] rounded-[2px] transition-colors text-[16px] leading-none"
          >
            ✕
          </button>
        </div>

        {/* Bloc pertes defenseur */}
        <LossesBlock
          team={notif.defenderTeam}
          unitLabel={notif.defenderKindLabel}
          losses={notif.defenderLosses}
          showFullDetail={notif.isMyDefense}
        />

        {/* Bloc pertes attaquant si riposte (melee defenseur survivant) */}
        {notif.attackerLosses && (
          <LossesBlock
            team={notif.attackerTeam}
            unitLabel={notif.attackerKindLabel}
            losses={notif.attackerLosses}
            showFullDetail={notif.isMyAttack}
            isRiposte
          />
        )}
      </div>
    </div>
  )
}

interface LossesBlockProps {
  team: Team
  unitLabel: string
  losses: { killed: number; woundedAdd: number; hpAfter: number; isKilled: boolean; isRouted: boolean }
  /** Si true → affiche tués + blessés + restants. Sinon → tués uniquement (fog of war). */
  showFullDetail: boolean
  isRiposte?: boolean
}

function LossesBlock({ team, unitLabel, losses, showFullDetail, isRiposte }: LossesBlockProps) {
  const teamColor = TEAM_COLOR[team]
  const teamName = TEAM_NAME[team]
  const headerLabel = isRiposte ? 'Riposte' : 'Pertes'

  if (losses.killed === 0 && losses.woundedAdd === 0 && !losses.isKilled) {
    return (
      <div className="px-4 py-3">
        <div className="text-[9px] uppercase tracking-[0.16em] mb-1" style={{ color: teamColor }}>
          {headerLabel} · {unitLabel} {teamName}
        </div>
        <div className="text-[11px] text-muted-foreground italic">
          Aucune perte
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      <div className="text-[9px] uppercase tracking-[0.16em] mb-2 flex items-center gap-2" style={{ color: teamColor }}>
        <span>{headerLabel} · {unitLabel} {teamName}</span>
        {losses.isKilled && (
          <span className="text-[8px] px-2 py-[1px] bg-[rgba(239,68,68,0.15)] border border-red-500/40 text-red-400 rounded-[2px] tracking-[0.08em]">
            Décimée
          </span>
        )}
        {!losses.isKilled && losses.isRouted && (
          <span className="text-[8px] px-2 py-[1px] bg-[rgba(251,146,60,0.15)] border border-orange-500/40 text-orange-400 rounded-[2px] tracking-[0.08em]">
            En déroute
          </span>
        )}
      </div>

      <div className="space-y-1 text-[11px] tabular-nums">
        <Row icon="⚰" label="Morts au combat" value={losses.killed} color="#ef4444" />
        {showFullDetail && (
          <>
            <Row icon="🩹" label="Blessés (récupérables)" value={losses.woundedAdd} color="#fb923c" />
            {!losses.isKilled && (
              <Row icon="◯" label="Soldats restants" value={losses.hpAfter} color="#22c55e" />
            )}
          </>
        )}
        {!showFullDetail && !losses.isKilled && (
          <div className="text-[10px] italic text-muted-foreground/70 pt-[2px]">
            (effectifs adverses inconnus)
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">
        <span aria-hidden className="mr-2 opacity-80">{icon}</span>
        {label}
      </span>
      <span className="font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  )
}
