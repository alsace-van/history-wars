// v2.0a (10/05/2026) — split/merge UX : direction (flèches + N/S/E/O) au lieu de q/r bruts
// v2.0 (10/05/2026) — Phase 2 2D.1 : effectif elastique + boutons split/merge + selection ratio/case adjacente
// v1.1 (10/05/2026) — Phase 1.5 P1.5-INSP-01 : barre HP multi-segment vert/orange + ligne blessés
// v1.0 (09/05/2026) — L1C.3 : panel inspector unite selectionnee (nom, hp, morale, actions dispo)
import { useState } from 'react'
import type { UnitState, SplitRatio } from '@engine/units'
import { resolveUnitStatsV2 } from '@engine/units'
import { useUnitSizing } from '@hooks/useUnitSizing'

interface UnitInspectorProps {
  unit: UnitState
  isMyUnit: boolean
  isMyTurn: boolean
  /** Phase 2 : pour appel EF split/merge. Si null, actions desactivees. */
  gameId: string | null
  /** Phase 2 : tous les pions sur la carte, pour calculer adjacence/cibles fusion. */
  allUnits: ReadonlyArray<UnitState>
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

export function UnitInspector({ unit, isMyUnit, isMyTurn, gameId, allUnits }: UnitInspectorProps) {
  const stats = resolveUnitStatsV2(unit.kind, unit.subKind)
  const sizing = useUnitSizing({ gameId, unit, allUnits, isMyUnit, isMyTurn })
  const [manoeuvre, setManoeuvre] = useState<Manoeuvre>('none')
  const [selectedRatio, setSelectedRatio] = useState<SplitRatio>('half')

  const effectivePct = Math.max(0, Math.min(100, (unit.effective / unit.effectiveMax) * 100))
  const woundedPct = Math.max(0, Math.min(100 - effectivePct, (unit.wounded / unit.effectiveMax) * 100))
  const moralePct = Math.max(0, Math.min(100, (unit.morale / unit.moraleMax) * 100))

  const teamColor = unit.team === 'blue' ? '#3b82f6' : '#ef4444'
  const teamLabel = unit.team === 'blue' ? 'Bleus' : 'Rouges'

  const canMove = !unit.hasMoved && !unit.routed
  const canAttack = !unit.hasAttacked && !unit.routed

  const handleSplitClick = (ratio: SplitRatio, target: { q: number; r: number }) => {
    sizing.performSplit(ratio, target).then(ok => {
      if (ok) setManoeuvre('none')
    })
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
              <span className="ml-2 text-[10px] opacity-60">({unit.subKind})</span>
            )}
          </div>
          {unit.routed && (
            <span className="text-[9px] uppercase tracking-[0.12em] px-2 py-[2px] bg-red-900/40 border border-red-500/60 text-red-300 rounded-[2px]">
              En déroute
            </span>
          )}
        </div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1">
          Camp {teamLabel} · q={unit.position.q} r={unit.position.r}
        </div>
      </div>

      {/* Effectif (Phase 2) — barre 3 segments : valides (vert), blesses (orange) ; min affiche separement */}
      <div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
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
          <div className="flex justify-between text-[9px] tabular-nums mt-[3px]">
            <span className="text-[#fb923c]">{unit.wounded} blessés</span>
            <span className="text-muted-foreground">{unit.killed} tués cumul</span>
          </div>
        )}
      </div>

      {/* Morale */}
      <div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
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
        <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
          {isMyUnit && isMyTurn ? 'Ordres disponibles' : 'Ordres'}
        </div>
        <ul className="space-y-1 text-[11px]">
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
          <div className="text-[10px] text-muted-foreground italic mt-2">
            Unité adverse — lecture seule
          </div>
        )}
        {isMyUnit && !isMyTurn && (
          <div className="text-[10px] text-muted-foreground italic mt-2">
            Attends ton tour pour agir
          </div>
        )}
      </div>

      {/* Manoeuvre Phase 2 : split + merge */}
      {isMyUnit && isMyTurn && (sizing.canSplit || sizing.canMerge) && (
        <div className="border-t border-[rgba(226,232,240,0.10)] pt-2">
          <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
            Manœuvre
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!sizing.canSplit || sizing.busy}
              onClick={() => setManoeuvre(manoeuvre === 'split' ? 'none' : 'split')}
              className="flex-1 text-[11px] px-2 py-1 border rounded-[2px] uppercase tracking-[0.08em] disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-tactica-amber/20 transition"
              style={{ borderColor: '#eab308', color: sizing.canSplit ? '#eab308' : undefined }}
            >
              Scinder
            </button>
            <button
              type="button"
              disabled={!sizing.canMerge || sizing.busy}
              onClick={() => setManoeuvre(manoeuvre === 'merge' ? 'none' : 'merge')}
              className="flex-1 text-[11px] px-2 py-1 border rounded-[2px] uppercase tracking-[0.08em] disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-blue-400/20 transition"
              style={{ borderColor: '#60a5fa', color: sizing.canMerge ? '#60a5fa' : undefined }}
            >
              Fusionner
            </button>
          </div>
          <div className="text-[9px] text-muted-foreground mt-1 italic">
            1 tour d'inactivité offensive après l'opération.
          </div>

          {manoeuvre === 'split' && sizing.canSplit && (
            <div className="mt-3 space-y-2 p-2 bg-[rgba(15,23,42,0.6)] rounded-[2px] border border-[rgba(234,179,8,0.3)]">
              <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                Ratio
              </div>
              <div className="flex gap-1">
                {(['half', 'three_quarter', 'nine_one'] as SplitRatio[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRatio(r)}
                    className={`flex-1 text-[10px] px-2 py-1 border rounded-[2px] tabular-nums transition ${
                      selectedRatio === r
                        ? 'bg-tactica-amber/30 border-tactica-amber text-tactica-amber'
                        : 'border-[rgba(226,232,240,0.20)] text-muted-foreground hover:bg-[rgba(234,179,8,0.10)]'
                    }`}
                  >
                    {RATIO_LABEL[r]}
                  </button>
                ))}
              </div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                Case cible
              </div>
              <div className="grid grid-cols-2 gap-1">
                {sizing.splitTargets.map(t => {
                  const dir = hexDirection(t.q - unit.position.q, t.r - unit.position.r)
                  return (
                    <button
                      key={`${t.q}_${t.r}`}
                      type="button"
                      disabled={!t.free || sizing.busy}
                      onClick={() => handleSplitClick(selectedRatio, { q: t.q, r: t.r })}
                      title={t.free ? `Vers ${dir.label}` : `${dir.label} — case occupée`}
                      className="flex items-center justify-center gap-1.5 text-[10px] px-2 py-1 border rounded-[2px] disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-tactica-amber/20 transition"
                      style={{ borderColor: t.free ? '#eab308' : '#475569', color: t.free ? '#eab308' : '#64748b' }}
                    >
                      <span className="text-[14px] leading-none">{dir.arrow}</span>
                      <span>{dir.label}</span>
                      <span className="opacity-70">{t.free ? '✓' : '×'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {manoeuvre === 'merge' && sizing.canMerge && (
            <div className="mt-3 space-y-2 p-2 bg-[rgba(15,23,42,0.6)] rounded-[2px] border border-[rgba(96,165,250,0.3)]">
              <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
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
                      className="w-full flex items-center gap-2 text-[10px] px-2 py-1 border rounded-[2px] disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-blue-400/20 transition"
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
      <div className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          small
            ? 'text-[10px] font-semibold text-foreground'
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
