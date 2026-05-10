// v2.1 (10/05/2026) — Phase 1.5 : bouton "Centrer la vue" sur l'onglet actif (focus camera mon unité)
// v2.0 (10/05/2026) — Phase 1.5 : refactor en onglets + clic sélectionne combat actif (highlight unités plateau)
// v1.1 (10/05/2026) — Phase 1.5 : agrandi chiffres pertes (20px gras) pour lisibilité
// v1.0 (10/05/2026) — Phase 1.5 fix UX : panneau resultat combat persistant (X close), libelles equipes explicites
import { useEffect, useMemo, useState } from 'react'
import type { Team } from '@/types/game'
import type { CombatNotification } from '@hooks/useCombatNotifications'
import { cn } from '@lib/cn'

interface CombatResultPanelProps {
  notifications: ReadonlyArray<CombatNotification>
  /** Callback quand l'onglet actif change → Game.tsx en derive les unitéIds à highlighter sur le plateau. */
  onActiveChange?: (notif: CombatNotification | null) => void
  /** Retire une notification (X de l'onglet). */
  onRemove: (id: string) => void
  /** Vide toutes les notifications (X global du panel). */
  onClear: () => void
  /** Phase 1.5 : centre la caméra sur une unité (typiquement l'unité du viewer dans le combat actif). */
  onFocusUnit?: (unitId: string) => void
}

const TEAM_COLOR: Record<Team, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
}

const TEAM_NAME: Record<Team, string> = {
  blue: 'Bleus',
  red: 'Rouges',
}

export function CombatResultPanel({ notifications, onActiveChange, onRemove, onClear, onFocusUnit }: CombatResultPanelProps) {
  // Onglet actif : par defaut le dernier (le plus recent)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Auto-select : nouvelle notif → devient active. Si l'active disparait, fallback sur la derniere.
  useEffect(() => {
    if (notifications.length === 0) {
      if (activeId !== null) setActiveId(null)
      return
    }
    if (!activeId || !notifications.some(n => n.id === activeId)) {
      setActiveId(notifications[notifications.length - 1].id)
    }
  }, [notifications, activeId])

  const activeNotif = useMemo(
    () => notifications.find(n => n.id === activeId) ?? null,
    [notifications, activeId]
  )

  // Notifie le parent de l'unite active pour le highlight plateau
  useEffect(() => {
    onActiveChange?.(activeNotif)
  }, [activeNotif, onActiveChange])

  if (notifications.length === 0) return null

  return (
    <div
      className="absolute bottom-[80px] right-3 w-[400px] max-w-[92vw] z-40 pointer-events-auto animate-slide-up"
      role="dialog"
      aria-live="polite"
    >
      <div className="bg-[rgba(8,12,24,0.95)] backdrop-blur-[6px] border border-tactica-amber rounded-[2px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* Bandeau onglets */}
        <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1 border-b border-[rgba(226,232,240,0.10)]">
          <div className="flex flex-wrap gap-1 min-w-0 flex-1">
            {notifications.map(n => (
              <Tab
                key={n.id}
                notif={n}
                active={n.id === activeId}
                onSelect={() => setActiveId(n.id)}
                onRemove={() => onRemove(n.id)}
              />
            ))}
          </div>
          <button
            onClick={onClear}
            aria-label="Tout fermer"
            className="shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-[rgba(239,68,68,0.10)] rounded-[2px] transition-colors text-[16px] leading-none"
            title="Tout fermer"
          >
            ✕
          </button>
        </div>

        {/* Contenu de l'onglet actif */}
        {activeNotif && <ReportContent notif={activeNotif} onFocusUnit={onFocusUnit} />}
      </div>
    </div>
  )
}

function Tab({
  notif,
  active,
  onSelect,
  onRemove,
}: {
  notif: CombatNotification
  active: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const teamColor = notif.isMyAttack ? TEAM_COLOR[notif.attackerTeam] : TEAM_COLOR[notif.defenderTeam]
  const icon = notif.kind === 'melee' ? '⚔' : '🏹'
  const tabLabel = `T${notif.turn} · ${notif.kind === 'melee' ? 'Charge' : 'Tir'}`

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-[3px] rounded-[2px] cursor-pointer transition-colors text-[10px] uppercase tracking-[0.06em]',
        active
          ? 'border'
          : 'bg-[rgba(226,232,240,0.04)] hover:bg-[rgba(226,232,240,0.08)] border border-transparent'
      )}
      style={
        active
          ? { borderColor: teamColor, background: `${teamColor}1A`, color: teamColor }
          : { color: '#94a3b8' }
      }
      onClick={onSelect}
    >
      <span aria-hidden className="text-[12px] leading-none">
        {icon}
      </span>
      <span className="font-semibold">{tabLabel}</span>
      <button
        onClick={e => {
          e.stopPropagation()
          onRemove()
        }}
        aria-label={`Fermer ${tabLabel}`}
        className="ml-1 w-4 h-4 flex items-center justify-center hover:bg-[rgba(239,68,68,0.20)] hover:text-destructive rounded-[1px] text-[12px] leading-none"
      >
        ✕
      </button>
    </div>
  )
}

function ReportContent({ notif, onFocusUnit }: { notif: CombatNotification; onFocusUnit?: (unitId: string) => void }) {
  const actionLabel = notif.kind === 'melee' ? 'Charge' : 'Tir'
  const titleColor = notif.isMyAttack ? TEAM_COLOR[notif.attackerTeam] : TEAM_COLOR[notif.defenderTeam]

  const titleSummary = notif.isMyAttack
    ? `${actionLabel} : ${notif.attackerKindLabel} ${TEAM_NAME[notif.attackerTeam]} vs ${notif.defenderKindLabel} ${TEAM_NAME[notif.defenderTeam]}`
    : `${actionLabel} subi : ${notif.attackerKindLabel} ${TEAM_NAME[notif.attackerTeam]} attaque votre ${notif.defenderKindLabel}`

  // Mon unité dans ce combat = l'attaquant si j'ai attaqué, sinon le défenseur
  const myUnitId = notif.isMyAttack ? notif.attackerId : notif.defenderId
  const myUnitLabel = notif.isMyAttack ? notif.attackerKindLabel : notif.defenderKindLabel

  return (
    <>
      {/* Sous-titre engagement + bouton centrer */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
        <div
          className="text-[12px] font-semibold uppercase tracking-[0.04em] leading-tight flex-1 min-w-0"
          style={{ color: titleColor }}
        >
          {titleSummary}
        </div>
        {onFocusUnit && (
          <button
            onClick={() => onFocusUnit(myUnitId)}
            title={`Centrer la vue sur ma ${myUnitLabel}`}
            aria-label={`Centrer la vue sur ma ${myUnitLabel}`}
            className="shrink-0 px-2 py-1 text-[10px] uppercase tracking-[0.06em] bg-tactica-amber/10 hover:bg-tactica-amber/20 border border-tactica-amber/40 hover:border-tactica-amber text-tactica-amber rounded-[2px] transition-colors flex items-center gap-1 leading-none"
          >
            <span aria-hidden>📍</span>
            Centrer
          </button>
        )}
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
    </>
  )
}

interface LossesBlockProps {
  team: Team
  unitLabel: string
  losses: { killed: number; woundedAdd: number; hpAfter: number; isKilled: boolean; isRouted: boolean }
  showFullDetail: boolean
  isRiposte?: boolean
}

function LossesBlock({ team, unitLabel, losses, showFullDetail, isRiposte }: LossesBlockProps) {
  const teamColor = TEAM_COLOR[team]
  const teamName = TEAM_NAME[team]
  const headerLabel = isRiposte ? 'Riposte' : 'Pertes'

  if (losses.killed === 0 && losses.woundedAdd === 0 && !losses.isKilled) {
    return (
      <div className="px-4 py-3 border-t border-[rgba(226,232,240,0.06)]">
        <div className="text-[9px] uppercase tracking-[0.16em] mb-1" style={{ color: teamColor }}>
          {headerLabel} · {unitLabel} {teamName}
        </div>
        <div className="text-[11px] text-muted-foreground italic">Aucune perte</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 border-t border-[rgba(226,232,240,0.06)]">
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
