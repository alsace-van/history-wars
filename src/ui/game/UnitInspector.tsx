// v2.5 (12/05/2026) — Sprint UX : tailles texte 8-11px → 11-13px (lisibilité Inspector)
// v2.4 (11/05/2026) — Phase 2.6 C : section "Engagé en mêlée" + bouton "Rompre le combat"
// v2.3 (11/05/2026) — Phase 2.5 fix UX : affiche cohésion + soutien en permanence (lisibilité temps réel)
// v2.2 (11/05/2026) — Phase 2.5 C : section "État critique" pour Brisé (Retraite / Reddition / Suicide)
import { useEffect, useMemo, useState } from 'react'
import { computeCohesion, type CohesionState, type SupportCount } from '@engine/cohesion'
import type { UnitState, SplitRatio } from '@engine/units'
import { resolveUnitStatsV2 } from '@engine/units'
import { useUnitSizing } from '@hooks/useUnitSizing'
import type { Team } from '@/types/game'

interface UnitInspectorProps {
  unit: UnitState
  isMyUnit: boolean
  isMyTurn: boolean
  /** Phase 2 : pour appel EF split/merge. Si null, actions desactivees. */
  gameId: string | null
  /** Phase 2 : tous les pions sur la carte, pour calculer adjacence/cibles fusion. */
  allUnits: ReadonlyArray<UnitState>
  /**
   * Phase 2 2D.6 : true si on est actuellement en mode "choisir la case cible split"
   * (les hex adjacents s'illuminent sur la grille). Inspector affiche un message d'attente.
   */
  splitActive: boolean
  /** Phase 2 2D.6 : appelé quand l'utilisateur valide le ratio et passe en mode sélection grille. */
  onEnterSplitMode: (ratio: SplitRatio) => void
  /** Phase 2 2D.6 : annuler le mode sélection grille (revient à l'inspector normal). */
  onExitSplitMode: () => void
  // -------- Phase 2.5 C : état critique unité Brisée --------
  /** État de cohésion calculé par useTacticalSelection. Si 'broken' → panneau "État critique". */
  cohesionState?: CohesionState
  /** Phase 2.5 v2.3 — décompte soutien (alliés rayon 1+2) pour affichage temps réel. */
  support?: SupportCount
  /** True si au moins 1 voisin libre adjacent (sinon retraite désactivée). */
  canRetreat?: boolean
  /** True si encerclée totalement ET ratio camp ≥ 25% (sinon suicide désactivé). */
  canSuicide?: boolean
  /** True si on est en mode "choisir la direction retraite". */
  retreatActive?: boolean
  /** True si on est en mode "choisir la cible suicide". */
  suicideActive?: boolean
  onEnterRetreatMode?: () => void
  onExitRetreatMode?: () => void
  onEnterSuicideMode?: () => void
  onExitSuicideMode?: () => void
  onSurrender?: () => void
  // -------- Phase 2.6 C : engagement persistant --------
  /**
   * Engagements actifs impliquant cette unité (multi-engagement possible).
   * Chaque entrée pointe vers l'opponent (ennemi de l'autre côté de la paire).
   * Si tableau vide ou undefined → unité non engagée, section masquée.
   */
  engagements?: ReadonlyArray<{
    id: string
    opponentId: string
    opponentKind: string
    opponentTeam: Team
    startedTurn: number
  }>
  /** Numéro du tour courant (pour calculer "Engagé depuis T<N>"). */
  currentTurn?: number
  /** Handler "Rompre le combat" (coût 10% effective, action consommée). */
  onBreakCombat?: () => void
  /** Désactive le bouton Rompre (busy ou action en cours). */
  breakCombatDisabled?: boolean
}

const KIND_LABEL: Record<string, string> = {
  I: 'Infanterie',
  C: 'Cavalerie',
  A: 'Artillerie',
}

const RATIO_LABEL: Record<SplitRatio, string> = {
  half: '50/50',
  three_quarter: '75/25',
  nine_one: '90/10',
}

type Manoeuvre = 'none' | 'split' | 'merge'

export function UnitInspector({
  unit,
  isMyUnit,
  isMyTurn,
  gameId,
  allUnits,
  splitActive,
  onEnterSplitMode,
  onExitSplitMode,
  cohesionState,
  support,
  canRetreat = false,
  canSuicide = false,
  retreatActive = false,
  suicideActive = false,
  onEnterRetreatMode,
  onExitRetreatMode,
  onEnterSuicideMode,
  onExitSuicideMode,
  onSurrender,
  engagements,
  currentTurn,
  onBreakCombat,
  breakCombatDisabled = false,
}: UnitInspectorProps) {
  const stats = resolveUnitStatsV2(unit.kind, unit.subKind)
  const sizing = useUnitSizing({ gameId, unit, allUnits, isMyUnit, isMyTurn })
  const [manoeuvre, setManoeuvre] = useState<Manoeuvre>('none')
  const [selectedRatio, setSelectedRatio] = useState<SplitRatio>('half')

  // Phase 2.5 v2.3 : cohésion détaillée (score + breakdown) pour affichage temps réel.
  // Recalculée à chaque changement de support → l'utilisateur voit immédiatement
  // l'effet d'un renfort à proximité (avant fin de tour pour le moral chiffré).
  const cohesionScore = useMemo(() => {
    if (!support) return null
    return computeCohesion(unit, support)
  }, [unit, support])

  // Quand le splitMode global se ferme (validation ou annulation), on revient sur 'none'.
  // Quand il s'active, on force la sub-section sur 'split' (au cas où l'utilisateur ait fermé puis le parent l'a réouvert).
  useEffect(() => {
    if (splitActive) setManoeuvre('split')
  }, [splitActive])

  const effectivePct = Math.max(0, Math.min(100, (unit.effective / unit.effectiveMax) * 100))
  const woundedPct = Math.max(0, Math.min(100 - effectivePct, (unit.wounded / unit.effectiveMax) * 100))
  const moralePct = Math.max(0, Math.min(100, (unit.morale / unit.moraleMax) * 100))

  const teamColor = unit.team === 'blue' ? '#3b82f6' : '#ef4444'
  const teamLabel = unit.team === 'blue' ? 'Bleus' : 'Rouges'

  const canMove = !unit.hasMoved && !unit.routed
  const canAttack = !unit.hasAttacked && !unit.routed

  const freeAdjacentCount = sizing.splitTargets.filter(t => t.free).length

  const handleEnterSplit = () => {
    onEnterSplitMode(selectedRatio)
  }

  const handleCancelSplit = () => {
    onExitSplitMode()
    setManoeuvre('none')
  }

  const handleMergeClick = (otherId: string) => {
    sizing.performMerge(otherId).then(ok => {
      if (ok) setManoeuvre('none')
    })
  }

  return (
    <div
      className="border rounded-[2px] p-3 space-y-3"
      style={{
        borderColor: teamColor,
        background: `linear-gradient(180deg, ${teamColor}1A 0%, transparent 100%)`,
      }}
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div
            className="text-[14px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: teamColor }}
          >
            {KIND_LABEL[unit.kind] ?? unit.kind}
            {unit.subKind && (
              <span className="ml-2 text-[12px] opacity-60">({unit.subKind})</span>
            )}
          </div>
          {unit.routed && (
            <span className="text-[11px] uppercase tracking-[0.12em] px-2 py-[2px] bg-red-900/40 border border-red-500/60 text-red-300 rounded-[2px]">
              En déroute
            </span>
          )}
        </div>
        <div className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground mt-1">
          Camp {teamLabel} · q={unit.position.q} r={unit.position.r}
        </div>
      </div>

      {/* Effectif (Phase 2) — barre 3 segments : valides (vert), blesses (orange) ; min affiche separement */}
      <div>
        <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
          <span>Effectif</span>
          <span className="text-foreground tabular-nums">
            {unit.effective} / {unit.effectiveMax}
            <span className="text-muted-foreground ml-1">(min {unit.effectiveMin})</span>
          </span>
        </div>
        <div className="h-[6px] bg-[rgba(15,23,42,0.6)] rounded-[1px] overflow-hidden flex">
          <div
            className="h-full transition-all"
            style={{
              width: `${effectivePct}%`,
              background: effectivePct > 60 ? '#22c55e' : effectivePct > 30 ? '#eab308' : '#ef4444',
            }}
          />
          <div
            className="h-full transition-all"
            style={{ width: `${woundedPct}%`, background: '#fb923c' }}
          />
        </div>
        {(unit.wounded > 0 || unit.killed > 0) && (
          <div className="flex justify-between text-[11px] tabular-nums mt-[3px]">
            <span className="text-[#fb923c]">{unit.wounded} blessés</span>
            <span className="text-muted-foreground">{unit.killed} tués cumul</span>
          </div>
        )}
      </div>

      {/* Morale */}
      <div>
        <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
          <span>Moral</span>
          <span className="text-foreground tabular-nums">{unit.morale} / {unit.moraleMax}</span>
        </div>
        <div className="h-[6px] bg-[rgba(226,232,240,0.10)] rounded-[1px] overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${moralePct}%`,
              background: moralePct > 60 ? '#60a5fa' : moralePct > 30 ? '#eab308' : '#ef4444',
            }}
          />
        </div>
      </div>

      {/* Phase 2.5 v2.3 : Cohésion + Soutien (temps réel) */}
      {cohesionScore && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>Cohésion</span>
            <span className="tabular-nums flex items-center gap-2">
              <span className="text-foreground">{(cohesionScore.total * 100).toFixed(0)}%</span>
              <span
                className="px-[6px] py-[1px] text-[11px] uppercase tracking-[0.12em] rounded-[2px] border"
                style={{
                  color: cohesionScore.state === 'broken' ? '#dc2626' : cohesionScore.state === 'shaken' ? '#eab308' : '#22c55e',
                  borderColor: cohesionScore.state === 'broken' ? '#dc2626' : cohesionScore.state === 'shaken' ? '#eab308' : '#22c55e',
                  background: `${cohesionScore.state === 'broken' ? '#dc2626' : cohesionScore.state === 'shaken' ? '#eab308' : '#22c55e'}1A`,
                }}
              >
                {cohesionScore.state === 'broken' ? 'Brisé' : cohesionScore.state === 'shaken' ? 'Ébranlé' : 'Nominal'}
              </span>
            </span>
          </div>
          {support && (support.adjacent > 0 || support.nearby > 0) ? (
            <div className="text-[11px] text-blue-300 tabular-nums">
              Soutien : {support.adjacent} allié{support.adjacent > 1 ? 's' : ''} adj
              {support.nearby > 0 && `, ${support.nearby} rayon 2`}
              {' '}<span className="text-muted-foreground">(+{Math.round(support.adjacent + support.nearby * 0.5)} récup moral/tour, atténuation perte combat)</span>
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground italic">
              Isolée — aucun soutien adjacent
            </div>
          )}
        </div>
      )}

      {/* Stats compactes v2 — facteurs unitaires Phase 2 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatCell label="Att" value={stats.attack.toFixed(1)} />
        <StatCell label="Déf" value={stats.defense.toFixed(1)} />
        <StatCell label="Mvt" value={stats.movement} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <StatCell label="Portée" value={stats.range} />
        <StatCell
          label="Type combat"
          value={stats.range === 1 ? 'Mêlée' : stats.minRange > 0 ? 'Tir long' : 'Tir court'}
          small
        />
      </div>

      {/* Actions disponibles */}
      <div className="border-t border-[rgba(226,232,240,0.10)] pt-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
          {isMyUnit && isMyTurn ? 'Ordres disponibles' : 'Ordres'}
        </div>
        <ul className="space-y-1 text-[13px]">
          <ActionLine
            label="Se déplacer"
            available={canMove && isMyUnit && isMyTurn}
            done={unit.hasMoved}
          />
          <ActionLine
            label={stats.range === 1 ? 'Attaquer (mêlée)' : 'Tirer'}
            available={canAttack && isMyUnit && isMyTurn}
            done={unit.hasAttacked}
          />
        </ul>
        {!isMyUnit && (
          <div className="text-[12px] text-muted-foreground italic mt-2">
            Unité adverse — lecture seule
          </div>
        )}
        {isMyUnit && !isMyTurn && (
          <div className="text-[12px] text-muted-foreground italic mt-2">
            Attends ton tour pour agir
          </div>
        )}
      </div>

      {/* Manoeuvre Phase 2 : split + merge */}
      {isMyUnit && isMyTurn && (sizing.canSplit || sizing.canMerge) && (
        <div className="border-t border-[rgba(226,232,240,0.10)] pt-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
            Manœuvre
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!sizing.canSplit || sizing.busy}
              onClick={() => setManoeuvre(manoeuvre === 'split' ? 'none' : 'split')}
              className="flex-1 text-[13px] px-2 py-1 border rounded-[2px] uppercase tracking-[0.08em] disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-tactica-amber/20 transition"
              style={{ borderColor: '#eab308', color: sizing.canSplit ? '#eab308' : undefined }}
            >
              Scinder
            </button>
            <button
              type="button"
              disabled={!sizing.canMerge || sizing.busy}
              onClick={() => setManoeuvre(manoeuvre === 'merge' ? 'none' : 'merge')}
              className="flex-1 text-[13px] px-2 py-1 border rounded-[2px] uppercase tracking-[0.08em] disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-blue-400/20 transition"
              style={{ borderColor: '#60a5fa', color: sizing.canMerge ? '#60a5fa' : undefined }}
            >
              Fusionner
            </button>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 italic">
            1 tour d'inactivité offensive après l'opération.
          </div>

          {manoeuvre === 'split' && sizing.canSplit && !splitActive && (
            <div className="mt-3 space-y-3 p-3 bg-[rgba(15,23,42,0.6)] rounded-[2px] border border-[rgba(234,179,8,0.3)]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
                  Ratio
                </div>
                <div className="flex gap-1">
                  {(['half', 'three_quarter', 'nine_one'] as SplitRatio[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRatio(r)}
                      className={`flex-1 text-[13px] px-2 py-1.5 border rounded-[2px] tabular-nums transition ${
                        selectedRatio === r
                          ? 'bg-tactica-amber/30 border-tactica-amber text-tactica-amber'
                          : 'border-[rgba(226,232,240,0.20)] text-muted-foreground hover:bg-[rgba(234,179,8,0.10)]'
                      }`}
                    >
                      {RATIO_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleEnterSplit}
                disabled={freeAdjacentCount === 0 || sizing.busy}
                className="w-full text-[13px] font-semibold uppercase tracking-[0.08em] px-3 py-2 border-2 rounded-[2px] bg-tactica-amber/15 border-tactica-amber text-tactica-amber enabled:hover:bg-tactica-amber/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Sélectionner la case →
              </button>
              <div className="text-[11px] text-muted-foreground text-center italic">
                {freeAdjacentCount === 0
                  ? 'Aucune case adjacente libre.'
                  : `${freeAdjacentCount} case${freeAdjacentCount > 1 ? 's' : ''} adjacente${freeAdjacentCount > 1 ? 's' : ''} libre${freeAdjacentCount > 1 ? 's' : ''}.`}
              </div>
            </div>
          )}

          {splitActive && (
            <div className="mt-3 space-y-2 p-3 bg-tactica-amber/10 rounded-[2px] border-2 border-tactica-amber animate-pulse">
              <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-tactica-amber text-center">
                Ratio {RATIO_LABEL[selectedRatio]}
              </div>
              <div className="text-[12px] text-foreground text-center leading-relaxed">
                Clique sur une case <span className="text-tactica-amber font-semibold">ambre</span> de la carte pour positionner la nouvelle unité.
              </div>
              <button
                type="button"
                onClick={handleCancelSplit}
                className="w-full text-[12px] uppercase tracking-[0.08em] px-2 py-1.5 border border-muted-foreground/40 rounded-[2px] text-muted-foreground hover:bg-white/5 transition"
              >
                Annuler
              </button>
            </div>
          )}

          {manoeuvre === 'merge' && sizing.canMerge && (
            <div className="mt-3 space-y-2 p-2 bg-[rgba(15,23,42,0.6)] rounded-[2px] border border-[rgba(96,165,250,0.3)]">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Pion adjacent à fusionner
              </div>
              <div className="space-y-1">
                {sizing.mergeTargets.map(t => {
                  const dir = hexDirection(t.position.q - unit.position.q, t.position.r - unit.position.r)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={sizing.busy}
                      onClick={() => handleMergeClick(t.id)}
                      title={`${KIND_LABEL[t.kind]} à ${dir.label}, ${t.effective}/${t.effectiveMax} hommes`}
                      className="w-full flex items-center gap-2 text-[12px] px-2 py-1 border rounded-[2px] disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-blue-400/20 transition"
                      style={{ borderColor: '#60a5fa', color: '#60a5fa' }}
                    >
                      <span className="text-[14px] leading-none">{dir.arrow}</span>
                      <span className="flex-1 text-left">
                        {KIND_LABEL[t.kind]} · {dir.label}
                      </span>
                      <span className="tabular-nums opacity-80">{t.effective}/{t.effectiveMax}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase 2.6 C : section "Engagé en mêlée" + bouton "Rompre le combat" */}
      {isMyUnit && isMyTurn && engagements && engagements.length > 0 && cohesionState !== 'broken' && (
        <div className="border-t border-red-500/30 pt-3 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[14px]" role="img" aria-label="épées croisées">⚔</span>
            <div className="text-[12px] uppercase tracking-[0.16em] font-bold text-red-300">
              Engagement{engagements.length > 1 ? 's' : ''} de mêlée
            </div>
          </div>
          <ul className="space-y-1 mb-3">
            {engagements.map(e => {
              const turnsElapsed = currentTurn != null ? currentTurn - e.startedTurn + 1 : null
              const opLabel = KIND_LABEL[e.opponentKind] ?? e.opponentKind
              const opTeam = e.opponentTeam === 'blue' ? 'Bleus' : 'Rouges'
              return (
                <li key={e.id} className="flex items-center justify-between text-[12px] text-red-300/90 px-2 py-1 bg-red-500/10 rounded-[2px]">
                  <span>vs {opLabel} {opTeam}</span>
                  {turnsElapsed != null && (
                    <span className="text-[11px] text-red-300/60 tabular-nums">
                      T{e.startedTurn} (×{turnsElapsed} tour{turnsElapsed > 1 ? 's' : ''})
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            disabled={breakCombatDisabled}
            onClick={onBreakCombat}
            className="w-full text-[13px] font-semibold uppercase tracking-[0.08em] px-3 py-2 border-2 rounded-[2px] transition border-red-500 text-red-300 enabled:hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ⚠ Rompre le combat
          </button>
          <div className="text-[11px] text-muted-foreground italic text-center mt-1 leading-relaxed">
            Coût : ≈ {Math.max(1, Math.round(unit.effective * 0.1))} hommes laissés au front
            {engagements.length > 1 && ' · libère les '}{engagements.length > 1 && engagements.length}{engagements.length > 1 && ' engagements'}
            <br />
            Action consommée pour ce tour.
          </div>
        </div>
      )}

      {/* Phase 2.5 C : section "État critique" pour unité Brisée */}
      {isMyUnit && isMyTurn && cohesionState === 'broken' && (
        <div className="border-t border-red-500/40 pt-3 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[14px]" role="img" aria-label="drapeau blanc">🏳️</span>
            <div className="text-[12px] uppercase tracking-[0.16em] font-bold text-red-300">
              État critique — discipline rompue
            </div>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
            Cette unité ne peut plus attaquer en standard. Choisis une action critique.
          </p>
          <div className="space-y-2">
            {/* Retraite */}
            <button
              type="button"
              disabled={!canRetreat || retreatActive || suicideActive}
              onClick={retreatActive ? onExitRetreatMode : onEnterRetreatMode}
              className="w-full text-[13px] font-semibold uppercase tracking-[0.08em] px-3 py-2 border-2 rounded-[2px] transition disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                borderColor: retreatActive ? '#eab308' : canRetreat ? '#eab308' : '#475569',
                background: retreatActive ? 'rgba(234,179,8,0.20)' : 'transparent',
                color: canRetreat || retreatActive ? '#eab308' : undefined,
              }}
            >
              {retreatActive ? '✕ Annuler retraite' : '→ Battre en retraite'}
            </button>
            {!canRetreat && !retreatActive && (
              <div className="text-[11px] text-muted-foreground italic px-1">
                Aucune case adjacente libre. Capituler ou tenter un combat suicide.
              </div>
            )}

            {/* Combat suicide */}
            <button
              type="button"
              disabled={!canSuicide || retreatActive || suicideActive}
              onClick={suicideActive ? onExitSuicideMode : onEnterSuicideMode}
              className="w-full text-[13px] font-semibold uppercase tracking-[0.08em] px-3 py-2 border-2 rounded-[2px] transition disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                borderColor: suicideActive ? '#dc2626' : canSuicide ? '#dc2626' : '#475569',
                background: suicideActive ? 'rgba(220,38,38,0.20)' : 'transparent',
                color: canSuicide || suicideActive ? '#dc2626' : undefined,
              }}
            >
              {suicideActive ? '✕ Annuler suicide' : '⚔ Combat suicide (×1.5)'}
            </button>

            {/* Reddition */}
            <button
              type="button"
              disabled={retreatActive || suicideActive}
              onClick={onSurrender}
              className="w-full text-[13px] font-semibold uppercase tracking-[0.08em] px-3 py-2 border-2 rounded-[2px] transition disabled:opacity-30 disabled:cursor-not-allowed border-slate-500 text-slate-400 hover:bg-slate-500/10"
            >
              🏳 Se rendre
            </button>
          </div>

          {retreatActive && (
            <div className="mt-3 space-y-1 p-2 bg-amber-500/10 rounded-[2px] border-2 border-amber-500 animate-pulse">
              <div className="text-[12px] text-amber-300 text-center">
                Clique sur une case <span className="font-semibold">ambre</span> de la carte pour la direction de fuite.
              </div>
              <div className="text-[11px] text-muted-foreground italic text-center">
                Désertion appliquée si pertes ≥ 50 %.
              </div>
            </div>
          )}
          {suicideActive && (
            <div className="mt-3 space-y-1 p-2 bg-red-500/10 rounded-[2px] border-2 border-red-500 animate-pulse">
              <div className="text-[12px] text-red-300 text-center">
                Clique sur l'ennemi adjacent à attaquer. <span className="font-semibold">Sans retour.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCell({
  label,
  value,
  small,
}: {
  label: string
  value: string | number
  small?: boolean
}) {
  return (
    <div className="bg-[rgba(15,23,42,0.5)] border border-[rgba(226,232,240,0.10)] rounded-[2px] py-1 px-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          small
            ? 'text-[12px] font-semibold text-foreground'
            : 'text-[14px] font-semibold text-foreground tabular-nums'
        }
      >
        {value}
      </div>
    </div>
  )
}

// Convention TACTICA flat-top hex (cf. engine/hex/neighbors.ts HEX_DIRECTIONS)
function hexDirection(dq: number, dr: number): { arrow: string; label: string } {
  if (dq === +1 && dr ===  0) return { arrow: '→', label: 'Est' }
  if (dq === +1 && dr === -1) return { arrow: '↗', label: 'N-E' }
  if (dq ===  0 && dr === -1) return { arrow: '↖', label: 'N-O' }
  if (dq === -1 && dr ===  0) return { arrow: '←', label: 'Ouest' }
  if (dq === -1 && dr === +1) return { arrow: '↙', label: 'S-O' }
  if (dq ===  0 && dr === +1) return { arrow: '↘', label: 'S-E' }
  return { arrow: '·', label: `q${dq >= 0 ? '+' : ''}${dq} r${dr >= 0 ? '+' : ''}${dr}` }
}

function ActionLine({
  label,
  available,
  done,
}: {
  label: string
  available: boolean
  done: boolean
}) {
  let dot = '○'
  let cls = 'text-muted-foreground'
  if (done) {
    dot = '✓'
    cls = 'text-muted-foreground line-through opacity-60'
  } else if (available) {
    dot = '●'
    cls = 'text-tactica-amber'
  }
  return (
    <li className={`flex items-center gap-2 ${cls}`}>
      <span aria-hidden className="w-3 text-center">
        {dot}
      </span>
      <span>{label}</span>
    </li>
  )
}
