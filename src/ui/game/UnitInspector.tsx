// v1.1 (10/05/2026) — Phase 1.5 P1.5-INSP-01 : barre HP multi-segment vert/orange + ligne blessés
// v1.0 (09/05/2026) — L1C.3 : panel inspector unite selectionnee (nom, hp, morale, actions dispo)
import type { UnitState } from '@engine/units'
import { getUnitStats } from '@engine/units'

interface UnitInspectorProps {
  unit: UnitState
  isMyUnit: boolean
  isMyTurn: boolean
}

const KIND_LABEL: Record<string, string> = {
  I: 'Infanterie',
  C: 'Cavalerie',
  A: 'Artillerie',
}

export function UnitInspector({ unit, isMyUnit, isMyTurn }: UnitInspectorProps) {
  const stats = getUnitStats(unit.kind)
  const hpPct = Math.max(0, Math.min(100, (unit.hp / unit.hpMax) * 100))
  const woundedPct = Math.max(0, Math.min(100 - hpPct, (unit.wounded / unit.hpMax) * 100))
  const killedCumul = Math.max(0, unit.hpMax - unit.hp - unit.wounded)
  const moralePct = Math.max(0, Math.min(100, (unit.morale / unit.moraleMax) * 100))

  const teamColor = unit.team === 'blue' ? '#3b82f6' : '#ef4444'
  const teamLabel = unit.team === 'blue' ? 'Bleus' : 'Rouges'

  const canMove = !unit.hasMoved && !unit.routed
  const canAttack = !unit.hasAttacked && !unit.routed

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
          </div>
          {unit.routed && (
            <span className="text-[9px] uppercase tracking-[0.12em] px-2 py-[2px] bg-red-900/40 border border-red-500/60 text-red-300 rounded-[2px]">
              En déroute
            </span>
          )}
        </div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1">
          Camp {teamLabel} · Cube q={unit.position.q} r={unit.position.r}
        </div>
      </div>

      {/* HP bar — 3 segments : actifs (vert), blessés (orange), morts cumul (sombre) */}
      <div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
          <span>Effectif</span>
          <span className="text-foreground tabular-nums">
            {unit.hp} / {unit.hpMax}
          </span>
        </div>
        <div className="h-[6px] bg-[rgba(15,23,42,0.6)] rounded-[1px] overflow-hidden flex">
          <div
            className="h-full transition-all"
            style={{
              width: `${hpPct}%`,
              background: hpPct > 60 ? '#22c55e' : hpPct > 30 ? '#eab308' : '#ef4444',
            }}
          />
          <div
            className="h-full transition-all"
            style={{ width: `${woundedPct}%`, background: '#fb923c' }}
          />
        </div>
        {(unit.wounded > 0 || killedCumul > 0) && (
          <div className="flex justify-between text-[9px] tabular-nums mt-[3px]">
            <span className="text-[#fb923c]">{unit.wounded} blessés</span>
            <span className="text-muted-foreground">{killedCumul} morts au combat</span>
          </div>
        )}
      </div>

      {/* Morale bar */}
      <div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
          <span>Moral</span>
          <span className="text-foreground tabular-nums">
            {unit.morale} / {unit.moraleMax}
          </span>
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

      {/* Stats compactes */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatCell label="Att" value={stats.attack} />
        <StatCell label="Déf" value={stats.defense} />
        <StatCell label="Mvt" value={stats.movement} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <StatCell label="Portée" value={stats.range} />
        <StatCell
          label="Type combat"
          value={stats.range === 1 ? 'Mêlée' : 'Tir'}
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
            soon
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

function ActionLine({
  label,
  available,
  done,
  soon,
}: {
  label: string
  available: boolean
  done: boolean
  soon?: boolean
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
      {soon && !done && available && (
        <span className="ml-auto text-[8px] uppercase tracking-[0.12em] text-muted-foreground/60">
          (L1C.4)
        </span>
      )}
    </li>
  )
}
