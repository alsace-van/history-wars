// v1.0 (12/05/2026) — QW2 : panel read-only inspection unité ennemie (stats publiques uniquement)
import type { Team } from '@/types/game'
import type { CohesionState } from '@engine/cohesion'
import type { UnitState } from '@engine/units'

const KIND_LABEL: Record<string, string> = {
  I: 'Infanterie',
  C: 'Cavalerie',
  A: 'Artillerie',
}

const COHESION_LABEL: Record<CohesionState, string> = {
  nominal: 'Nominal',
  shaken: 'Ébranlé',
  broken: 'Brisé',
}

/**
 * Catégorise un effectif en tranche publique (pas de valeur exacte révélée).
 * Préfigure les bandes brouillard de Phase 3.1 (silhouette → identification).
 */
export function effectiveCategory(effective: number): string {
  if (effective < 100) return '< 100'
  if (effective < 300) return '100 – 300'
  if (effective < 600) return '300 – 600'
  return '600+'
}

export interface EnemyEngagementInfo {
  id: string
  opponentTeam: Team
  startedTurn: number
}

interface EnemyUnitPanelProps {
  unit: UnitState
  /** Niveau d'identification (Phase 3.1) : 'spotted' = silhouette, 'identified' = détaillé. */
  visibilityLevel?: 'spotted' | 'identified'
  /** Phase 2.5 — cohésion label (privé Phase 3.1 si 'spotted'). */
  cohesionState?: CohesionState
  /** Engagements actifs visibles publiquement (Phase 2.6). */
  engagements?: ReadonlyArray<EnemyEngagementInfo>
  /** Tour courant pour affichage "engagé depuis T<N>". */
  currentTurn?: number
}

export function EnemyUnitPanel({
  unit,
  visibilityLevel = 'identified',
  cohesionState,
  engagements,
  currentTurn,
}: EnemyUnitPanelProps) {
  const isSpotted = visibilityLevel === 'spotted'
  const teamColor = unit.team === 'blue' ? '#3b82f6' : '#ef4444'
  const teamLabel = unit.team === 'blue' ? 'Bleus' : 'Rouges'
  const kindLabel = KIND_LABEL[unit.kind] ?? unit.kind

  return (
    <div
      className="px-3 py-3 border rounded-[2px] space-y-2"
      style={{ borderColor: teamColor, background: `linear-gradient(180deg, ${teamColor}18 0%, transparent 100%)` }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
          Inspection ennemi
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.10em] px-2 py-[2px] rounded-[2px]"
          style={{ color: teamColor, borderColor: teamColor, borderWidth: 1 }}
        >
          {teamLabel}
        </span>
      </div>

      <div className="text-[14px] font-semibold tracking-[0.04em] text-foreground">
        {isSpotted ? 'Silhouette ennemie' : kindLabel}
      </div>

      {isSpotted ? (
        <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground italic">
          Identification incomplète — avance une unité pour reconnaître ses ordres.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-[12px] tabular-nums">
            <div className="px-2 py-1 border border-[rgba(226,232,240,0.18)] rounded-[2px] bg-[rgba(15,23,42,0.45)]">
              <span className="opacity-60 mr-1 uppercase tracking-[0.08em] text-[10px]">Effectif</span>
              <span>{effectiveCategory(unit.effective)}</span>
            </div>
            {cohesionState && (
              <div className="px-2 py-1 border border-[rgba(226,232,240,0.18)] rounded-[2px] bg-[rgba(15,23,42,0.45)]">
                <span className="opacity-60 mr-1 uppercase tracking-[0.08em] text-[10px]">Cohésion</span>
                <span>{COHESION_LABEL[cohesionState]}</span>
              </div>
            )}
          </div>

          {engagements && engagements.length > 0 && currentTurn !== undefined && (
            <div className="text-[11px] uppercase tracking-[0.08em] text-rose-300">
              {engagements.length === 1
                ? `Engagée depuis T${engagements[0].startedTurn}`
                : `${engagements.length} engagements actifs`}
            </div>
          )}

          {unit.routed && (
            <div className="text-[11px] uppercase tracking-[0.08em] text-amber-300">
              En déroute
            </div>
          )}
        </>
      )}
    </div>
  )
}
