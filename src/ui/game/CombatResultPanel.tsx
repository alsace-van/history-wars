// v4.3 (14/05/2026) — Phase 4 : titre clarifié (AO1 → I1 colorés équipe, ⚔ couleur attaquant, badge Bot)
// v4.2 (13/05/2026) — Phase 3.3 : ligne "Contact" cap terrain + mes hommes engagés (clarté Thermopyles)
// v4.1 (12/05/2026) — Fix positionnement : fixed sous le bouton TopBar (top-[68px]), couvre la sidebar quand ouvert
// v4.0 (12/05/2026) — UX : liste scrollable verticale sous le bouton TopBar, plus d'onglets, croix par rapport
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
      className="fixed top-[68px] right-3 w-[420px] max-w-[92vw] z-50 pointer-events-auto"
      role="dialog"
      aria-label="Journal des combats"
      aria-live="polite"
    >
      <div className="bg-[rgba(8,12,24,0.96)] backdrop-blur-[6px] border border-tactica-amber rounded-[2px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col max-h-[calc(100vh-80px)]">
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
  const phaseLabel = notif.kind === 'charge' ? 'Charge cav' : notif.kind === 'melee' ? 'Mêlée' : 'Tir'
  // Icône principale = double épée pour mêlée/charge, arc pour tir.
  const phaseIcon = notif.kind === 'ranged' ? '🏹' : '⚔'
  const attackerColor = TEAM_COLOR[notif.attackerTeam]
  const defenderColor = TEAM_COLOR[notif.defenderTeam]

  const myUnitId = notif.isMyAttack ? notif.attackerId : notif.defenderId
  const myUnitLabel = notif.isMyAttack ? notif.attackerKindLabel : notif.defenderKindLabel

  return (
    <div
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      className="border-b border-[rgba(226,232,240,0.06)] last:border-b-0 hover:bg-tactica-amber/[0.04] transition-colors"
    >
      {/* Bandeau carte : icône phase couleur attaquant + tour/phase + actions */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <span
          aria-hidden
          className="text-[16px] leading-none"
          style={{ color: attackerColor }}
          title={`Attaquant : ${TEAM_NAME[notif.attackerTeam]}${notif.attackerIsBot ? ' (Bot)' : ''}`}
        >
          {phaseIcon}
        </span>
        <span className="text-[12px] uppercase tracking-[0.06em] font-semibold tabular-nums text-muted-foreground">
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

      {/* Titre directionnel : [AO1 rouge] ⚔ → [I1 bleu]  +  badge Bot si attaquant=bot */}
      <div className="px-3 pb-2 flex items-center gap-2 flex-wrap">
        <span
          className="font-bold text-[15px] tabular-nums"
          style={{ color: attackerColor }}
          title={`${notif.attackerKindLabel} ${TEAM_NAME[notif.attackerTeam]}`}
        >
          {notif.attackerShortLabel}
        </span>
        {notif.attackerIsBot && (
          <span
            className="text-[9px] px-[5px] py-[1px] uppercase tracking-[0.08em] rounded-[2px] border font-semibold leading-none"
            style={{ color: attackerColor, borderColor: attackerColor + '66' }}
            title="Action décidée par l'IA"
          >
            Bot
          </span>
        )}
        <span aria-hidden className="text-[14px]" style={{ color: attackerColor }}>→</span>
        <span
          className="font-bold text-[15px] tabular-nums"
          style={{ color: defenderColor }}
          title={`${notif.defenderKindLabel} ${TEAM_NAME[notif.defenderTeam]}`}
        >
          {notif.defenderShortLabel}
        </span>
        <span className="text-muted-foreground text-[12px] italic ml-auto">
          {notif.isMyAttack ? '(votre attaque)' : notif.isMyDefense ? '(subi)' : '(spectateur)'}
        </span>
      </div>

      {/* Phase 3.3 — ligne "Contact" : explique pourquoi 750 vs 450 sur plaine font les mêmes dégâts.
          Affiché pour mêlée/charge uniquement (tir : pas de plafond Thermopyles). Fog of war :
          on n'affiche QUE le cap (terrain public) + mes hommes engagés. L'ennemi reste opaque. */}
      {notif.contact && notif.kind !== 'ranged' && (
        <ContactRow
          cap={notif.contact.cap}
          myEngaged={notif.isMyAttack ? notif.contact.attackerEngaged : notif.contact.defenderEngaged}
        />
      )}

      {/* Bloc pertes défenseur */}
      <LossesBlock
        team={notif.defenderTeam}
        unitLabel={notif.defenderKindLabel}
        shortLabel={notif.defenderShortLabel}
        losses={notif.defenderLosses}
        showFullDetail={notif.isMyDefense}
      />

      {/* Bloc pertes attaquant si riposte (mêlée défenseur survivant) */}
      {notif.attackerLosses && (
        <LossesBlock
          team={notif.attackerTeam}
          unitLabel={notif.attackerKindLabel}
          shortLabel={notif.attackerShortLabel}
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
  shortLabel: string
  losses: { killed: number; woundedAdd: number; effectiveBefore: number; effectiveAfter: number; isKilled: boolean; isRouted: boolean }
  showFullDetail: boolean
  isRiposte?: boolean
}

function LossesBlock({ team, unitLabel, shortLabel, losses, showFullDetail, isRiposte }: LossesBlockProps) {
  const teamColor = TEAM_COLOR[team]
  const teamName = TEAM_NAME[team]
  const headerLabel = isRiposte ? 'Riposte' : 'Pertes'

  if (losses.killed === 0 && losses.woundedAdd === 0 && !losses.isKilled) {
    return (
      <div className="px-3 py-2 border-t border-[rgba(226,232,240,0.06)]">
        <div className="text-[11px] uppercase tracking-[0.14em] mb-1 flex items-center gap-2" style={{ color: teamColor }}>
          <span className="font-bold tabular-nums">{shortLabel}</span>
          <span className="opacity-60">·</span>
          <span>{headerLabel} · {unitLabel} {teamName}</span>
        </div>
        <div className="text-[13px] text-muted-foreground italic">Aucune perte</div>
      </div>
    )
  }

  return (
    <div className="px-3 py-2 border-t border-[rgba(226,232,240,0.06)]">
      <div className="text-[11px] uppercase tracking-[0.14em] mb-2 flex items-center gap-2 flex-wrap" style={{ color: teamColor }}>
        <span className="font-bold tabular-nums">{shortLabel}</span>
        <span className="opacity-60">·</span>
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

/**
 * Phase 3.3 — ligne explicative du cap terrain.
 * "🛡 Contact terrain · cap 200 hommes · mes hommes engagés 200"
 * Si myEngaged === cap : muscle visuel "Cohorte saturée" pour souligner le plafond actif.
 */
function ContactRow({ cap, myEngaged }: { cap: number; myEngaged: number }) {
  const saturated = myEngaged >= cap
  return (
    <div className="px-3 pb-2">
      <div
        className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] tabular-nums px-2 py-[5px] bg-[rgba(15,23,42,0.6)] border border-[rgba(226,232,240,0.10)] rounded-[2px]"
        title={saturated
          ? `Le terrain plafonne le contact à ${cap} hommes. Vos renforts arrière restent en réserve.`
          : `Le terrain autorise jusqu'à ${cap} hommes au contact. Vous n'avez que ${myEngaged} engagés.`}
      >
        <span aria-hidden className="text-[12px] leading-none opacity-70">🛡</span>
        <span className="text-muted-foreground">Contact terrain</span>
        <span className="flex-1" />
        <span className="text-muted-foreground">cap</span>
        <span className="font-semibold text-slate-200">{cap}</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground">engagés</span>
        <span className={saturated ? 'font-semibold text-tactica-amber' : 'font-semibold text-slate-200'}>
          {myEngaged}
        </span>
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
