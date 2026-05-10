// v1.0 (10/05/2026) — P1-L1C4-01 : tooltip DOM ancré écran, preview combat (mêlée/tir)
import { previewMelee, previewRanged, type CombatModifiers } from '@engine/combat'
import { getUnitStats, type UnitState } from '@engine/units'

interface CombatPreviewTooltipProps {
  attacker: UnitState
  defender: UnitState
  /** Position en pixels dans le conteneur parent (relative). */
  screenPos: { x: number; y: number }
  /** Modificateurs (flanc, terrain). Defaut : aucun. */
  modifiers?: CombatModifiers
}

const KIND_LABEL: Record<string, string> = {
  I: 'Infanterie',
  C: 'Cavalerie',
  A: 'Artillerie',
}

const DEFAULT_MODS: CombatModifiers = { flanked: false, terrainDefBonus: 0 }

export function CombatPreviewTooltip({
  attacker,
  defender,
  screenPos,
  modifiers = DEFAULT_MODS,
}: CombatPreviewTooltipProps) {
  const atkStats = getUnitStats(attacker.kind)
  const isRanged = atkStats.range > 1
  const preview = isRanged
    ? previewRanged(attacker, defender, modifiers)
    : previewMelee(attacker, defender, modifiers)

  const teamColor = attacker.team === 'blue' ? '#3b82f6' : '#ef4444'
  const actionLabel = isRanged ? 'Tirer sur' : 'Charger'
  const defenderLabel = KIND_LABEL[defender.kind] ?? defender.kind

  // Probabilite de kill : 1 = sur, 0.5 = possible, 0 = improbable
  const killLabel =
    preview.killProbability >= 1
      ? 'Tue à coup sûr'
      : preview.killProbability > 0
        ? 'Tue possible'
        : 'Affaiblit'
  const killColor =
    preview.killProbability >= 1
      ? '#ef4444'
      : preview.killProbability > 0
        ? '#fb923c'
        : '#94a3b8'

  return (
    <div
      role="tooltip"
      aria-live="polite"
      className="absolute pointer-events-none z-30 select-none"
      style={{
        left: screenPos.x,
        top: screenPos.y,
        transform: 'translate(12px, -100%)',
      }}
    >
      <div
        className="bg-[rgba(8,12,24,0.95)] backdrop-blur-[6px] border px-3 py-2 rounded-[2px] min-w-[180px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        style={{ borderColor: teamColor }}
      >
        <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-[2px]">
          {actionLabel}
        </div>
        <div
          className="text-[13px] font-semibold uppercase tracking-[0.06em] leading-tight"
          style={{ color: teamColor }}
        >
          {defenderLabel}
        </div>
        <div className="text-[10px] text-muted-foreground mt-[2px]">
          PV ennemi : <span className="text-foreground tabular-nums">{defender.hp} / {defender.hpMax}</span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
              Dégâts
            </div>
            <div className="text-[14px] font-semibold text-tactica-amber tabular-nums">
              {preview.damageMin}–{preview.damageMax}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
              Issue
            </div>
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.04em]"
              style={{ color: killColor }}
            >
              {killLabel}
            </div>
          </div>
        </div>

        {modifiers.flanked && !isRanged && (
          <div className="mt-2 pt-1 border-t border-[rgba(226,232,240,0.10)] text-[9px] uppercase tracking-[0.12em] text-tactica-amber">
            ⚔ Flanc — bonus +10
          </div>
        )}
      </div>
    </div>
  )
}
