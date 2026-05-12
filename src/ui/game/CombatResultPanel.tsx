// v4.0 (12/05/2026) — UX : liste scrollable verticale sous le bouton TopBar, plus d'onglets, croix par rapport
// v3.4 (12/05/2026) — UX : bouton réduire ── (ferme sans vider) + monté seulement quand panel ouvert
// v3.3 (12/05/2026) — Fog of war fix : effectif AVANT visible uniquement côté joueur (sinon déduction triviale)
// v3.2 (12/05/2026) — Sprint UX : fix auto-select (useRef length) + effectif AVANT + tailles texte
import type { Team } from '@/types/game'
import type { CombatNotification } from '@hooks/useCombatNotifications'

interface CombatResultPanelProps {
  notifications: ReadonlyArray<CombatNotification>
  /** Callback quand le hover/focus change → Game.tsx en dérive les unitéIds à highlighter sur le plateau. */
  onActiveChange?: (notif: CombatNotification | null) => void
  /** Retire une notification (croix de la carte). */
  onRemove: (id: string) => void
  /** Vide toutes les notifications (X global). */
  onClear: () => void
  /** Ferme le panel sans vider la liste (─). */
  onClose?: () => void
  /** Centre la caméra sur une unité (bouton 📍 par carte). */
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

/**
 * Panel "Journal des combats" — v4.0 (refonte UX).
 *
 * - Ancré en haut à droite, sous le bouton "Rapports" du TopBar.
 * - Liste scrollable verticale. Le plus récent en haut.
 * - Chaque rapport est une carte complète avec son propre bouton "✕".
 * - Hover sur une carte → highlight des unités du combat sur le plateau.
 */
export function CombatResultPanel({
  notifications,
  onActiveChange,
  onRemove,
  onClear,
  onClose,
  onFocusUnit,
}: CombatResultPanelProps) {
  if (notifications.length === 0) return null

  // Plus récent en haut (la liste arrive en ordre d'arrivée, on inverse pour l'affichage).
  const ordered = [...notifications].reverse()

  return (
    <div
      className="absolute top-3 right-3 w-[420px] max-w-[92vw] z-40 pointer-events-auto"
      role="dialog"
      aria-label="Journal des combats"
      aria-live="polite"
    >
      <div className="bg-[rgba(8,12,24,0.96)] backdrop-blur-[6px] border border-tactica-amber rounded-[2px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col max-h-[calc(100vh-100px)]">
        {/* Header sticky */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[rgba(226,232,240,0.10)] shrink-0">
          <div className="text-[13px] uppercase tracking-[0.12em] font-semibold text-tactica-amber flex items-center gap-2">
            <span aria-hidden>⚔</span>
            <span>Journal des combats</span>
            <span className="text-muted-foreground tabular-nums font-normal text-[12px]">
              ({notifications.length})
            </span>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Réduire"
                title="Réduire (garder l'historique)"
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-tactica-amber hover:bg-tactica-amber/10 rounded-[2px] transition-colors text-[18px] leading-none"
              >
                ─
              </button>
            )}
            <button
              onClick={onClear}
              aria-label="Tout vider"
              title="Tout vider et fermer"
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-[rgba(239,68,68,0.10)] rounded-[2px] transition-colors text-[16px] leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Liste scrollable */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {ordered.map(n => (
            <ReportCard
              key={n.id}
              notif={n}
              onRemove={() => onRemove(n.id)}
              onHoverEnter={() => onActiveChange?.(n)}
              onHoverLeave={() => onActiveChange?.(null)}
              onFocusUnit={onFocusUnit}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ReportCard({
  notif,
  onRemove,
  onHoverEnter,
  onHoverLeave,
  onFocusUnit,
}: {
  notif: CombatNotification
  onRemove: () => void
  onHoverEnter: () => void
  onHoverLeave: () => void
  onFocusUnit?: (unitId: string) => void
}) {
  const icon = notif.kind === 'charge' ? '🐎' : notif.kind === 'melee' ? '⚔' : '🏹'
  const phaseLabel = notif.kind === 'charge' ? 'Charge cav' : notif.kind === 'melee' ? 'Mêlée' : 'Tir'
  const actionLabel = notif.kind === 'charge' ? 'Charge cavalerie' : notif.kind === 'melee' ? 'Mêlée' : 'Tir'
  const titleColor = notif.isMyAttack ? TEAM_COLOR[notif.attackerTeam] : TEAM_COLOR[notif.defenderTeam]

  const titleSummary = notif.isMyAttack
    ? `${actionLabel} : ${notif.attackerKindLabel} ${TEAM_NAME[notif.attackerTeam]} vs ${notif.defenderKindLabel} ${TEAM_NAME[notif.defenderTeam]}`
    : `${actionLabel} subi : ${notif.attackerKindLabel} ${TEAM_NAME[notif.attackerTeam]} attaque votre ${notif.defenderKindLabel}`

  const myUnitId = notif.isMyAttack ? notif.attackerId : notif.defenderId
  const myUnitLabel = notif.isMyAttack ? notif.attackerKindLabel : notif.defenderKindLabel

  return (
    <div
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      className="border-b border-[rgba(226,232,240,0.06)] last:border-b-0 hover:bg-tactica-amber/[0.04] transition-colors"
    >
      {/* Bandeau carte : phase + tour + croix */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <span aria-hidden className="text-[15px] leading-none">{icon}</span>
        <span
          className="text-[12px] uppercase tracking-[0.06em] font-semibold tabular-nums"
          style={{ color: titleColor }}
        >
          T{notif.turn} · {phaseLabel}
        </span>
        <span className="flex-1" />
        {onFocusUnit && (
          <button
            type="button"
            onClick={() => onFocusUnit(myUnitId)}
            title={`Centrer la vue sur ma ${myUnitLabel}`}
            aria-label={`Centrer la vue sur ma ${myUnitLabel}`}
            className="shrink-0 px-2 py-[3px] text-[11px] uppercase tracking-[0.05em] bg-tactica-amber/10 hover:bg-tactica-amber/20 border border-tactica-amber/40 hover:border-tactica-amber text-tactica-amber rounded-[2px] transition-colors flex items-center gap-1 leading-none"
          >
            <span aria-hidden>📍</span>
            Centrer
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Fermer ce rapport"
          title="Fermer ce rapport"
          className="shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-[rgba(239,68,68,0.10)] rounded-[2px] transition-colors text-[14px] leading-none"
        >
          ✕
        </button>
      </div>

      {/* Sous-titre engagement */}
      <div className="px-3 pb-2">
        <div
          className="text-[13px] font-semibold uppercase tracking-[0.03em] leading-tight"
          style={{ color: titleColor }}
        >
          {titleSummary}
        </div>
      </div>

      {/* Bloc pertes défenseur */}
      <LossesBlock
        team={notif.defenderTeam}
        unitLabel={notif.defenderKindLabel}
        losses={notif.defenderLosses}
        showFullDetail={notif.isMyDefense}
      />

      {/* Bloc pertes attaquant si riposte (mêlée défenseur survivant) */}
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
  )
}

interface LossesBlockProps {
  team: Team
  unitLabel: string
  losses: { killed: number; woundedAdd: number; effectiveBefore: number; effectiveAfter: number; isKilled: boolean; isRouted: boolean }
  showFullDetail: boolean
  isRiposte?: boolean
}

function LossesBlock({ team, unitLabel, losses, showFullDetail, isRiposte }: LossesBlockProps) {
  const teamColor = TEAM_COLOR[team]
  const teamName = TEAM_NAME[team]
  const headerLabel = isRiposte ? 'Riposte' : 'Pertes'

  if (losses.killed === 0 && losses.woundedAdd === 0 && !losses.isKilled) {
    return (
      <div className="px-3 py-2 border-t border-[rgba(226,232,240,0.06)]">
        <div className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ color: teamColor }}>
          {headerLabel} · {unitLabel} {teamName}
        </div>
        <div className="text-[13px] text-muted-foreground italic">Aucune perte</div>
      </div>
    )
  }

  return (
    <div className="px-3 py-2 border-t border-[rgba(226,232,240,0.06)]">
      <div className="text-[11px] uppercase tracking-[0.14em] mb-2 flex items-center gap-2 flex-wrap" style={{ color: teamColor }}>
        <span>{headerLabel} · {unitLabel} {teamName}</span>
        {losses.isKilled && (
          <span className="text-[10px] px-2 py-[1px] bg-[rgba(239,68,68,0.15)] border border-red-500/40 text-red-400 rounded-[2px] tracking-[0.08em]">
            Décimée
          </span>
        )}
        {!losses.isKilled && losses.isRouted && (
          <span className="text-[10px] px-2 py-[1px] bg-[rgba(251,146,60,0.15)] border border-orange-500/40 text-orange-400 rounded-[2px] tracking-[0.08em]">
            En déroute
          </span>
        )}
      </div>

      <div className="space-y-1 text-[13px] tabular-nums">
        {/* Effectif AVANT visible UNIQUEMENT côté joueur (showFullDetail).
            Sinon déduction triviale (before - killed = after) → trou de fog of war. */}
        {showFullDetail && (
          <Row icon="◐" label="Soldats avant" value={losses.effectiveBefore} color="#94a3b8" />
        )}
        <Row icon="⚰" label="Morts au combat" value={losses.killed} color="#ef4444" />
        {showFullDetail && (
          <>
            <Row icon="🩹" label="Blessés (récupérables)" value={losses.woundedAdd} color="#fb923c" />
            {!losses.isKilled && (
              <Row icon="◯" label="Soldats restants" value={losses.effectiveAfter} color="#22c55e" />
            )}
          </>
        )}
        {!showFullDetail && !losses.isKilled && (
          <div className="text-[12px] italic text-muted-foreground/70 pt-[2px]">
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
