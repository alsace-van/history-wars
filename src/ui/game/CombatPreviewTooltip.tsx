// v2.0 (10/05/2026) — Phase 2 2D.2 : refonte preview v2 (breakdown ligne par ligne + hommes engages + saturation)
// v1.2 (10/05/2026) — Phase 1.5 P1.5-PREV-01 : ajout split tués/blessés sous les dégâts
// v1.0 (10/05/2026) — P1-L1C4-01 : tooltip DOM ancré écran, preview combat (mêlée/tir)
import { previewCombatV2, type AttackPhase } from '@engine/combat/v2'
import { cubeDistance } from '@engine/hex'
import type { UnitState } from '@engine/units'
import type { TerrainType } from '@engine/terrain'
import { DEFAULT_TERRAIN } from '@engine/terrain'

interface CombatPreviewTooltipProps {
  attacker: UnitState
  defender: UnitState
  /** Position en pixels dans le conteneur parent (relative). */
  screenPos: { x: number; y: number }
  /** Phase 2 : terrain sous attaquant. Defaut plaine_standard. */
  attackerTerrain?: TerrainType
  /** Phase 2 : terrain sous defenseur. Defaut plaine_standard. */
  defenderTerrain?: TerrainType
}

const KIND_LABEL: Record<string, string> = {
  I: 'Infanterie',
  C: 'Cavalerie',
  A: 'Artillerie',
}

export function CombatPreviewTooltip({
  attacker,
  defender,
  screenPos,
  attackerTerrain = DEFAULT_TERRAIN,
  defenderTerrain = DEFAULT_TERRAIN,
}: CombatPreviewTooltipProps) {
  const distance = cubeDistance(attacker.position, defender.position)
  // MVP Phase 2 : phase determinee par distance. Charge cav non previewable (path inconnu cote UI).
  const phase: AttackPhase = distance > 1 ? 'ranged' : 'melee'

  const preview = previewCombatV2({
    attacker, defender, phase,
    attackerTerrain, defenderTerrain,
    distance,
    chargeMult: 1.0,
  })

  const teamColor = attacker.team === 'blue' ? '#3b82f6' : '#ef4444'
  const phaseLabel = phase === 'ranged' ? 'TIR' : 'MÊLÉE'
  const actionLabel = phase === 'ranged' ? 'Tirer sur' : 'Charger'
  const defenderLabel = KIND_LABEL[defender.kind] ?? defender.kind

  // Issue probable : selon menLost vs effective_min defenseur
  const lostMax = preview.estimatedDamageMax
  const willKill = lostMax >= defender.effective - defender.effectiveMin
  const issueLabel = willKill ? 'Peut tuer le pion' : lostMax > 0 ? 'Affaiblit' : 'Inefficace'
  const issueColor = willKill ? '#ef4444' : lostMax > 0 ? '#fb923c' : '#94a3b8'

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
        className="bg-[rgba(8,12,24,0.95)] backdrop-blur-[6px] border px-3 py-2 rounded-[2px] min-w-[260px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        style={{ borderColor: teamColor }}
      >
        <div className="flex items-center justify-between mb-[2px]">
          <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            {actionLabel}
          </span>
          <span
            className="text-[8px] uppercase tracking-[0.12em] px-[6px] py-[1px] border rounded-[2px]"
            style={{ borderColor: teamColor, color: teamColor }}
          >
            {phaseLabel}
          </span>
        </div>
        <div
          className="text-[13px] font-semibold uppercase tracking-[0.06em] leading-tight mb-[6px]"
          style={{ color: teamColor }}
        >
          {defenderLabel}
        </div>

        {/* Hommes engages (cap terrain) */}
        <div className="grid grid-cols-2 gap-2 mt-1 text-[9px] tabular-nums">
          <div className="px-1 py-[2px] bg-[rgba(15,23,42,0.6)] rounded-[1px]">
            <div className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground">Att engagés</div>
            <div className="text-foreground">
              {preview.menEngagedAttacker}/{attacker.effective}
            </div>
          </div>
          <div className="px-1 py-[2px] bg-[rgba(15,23,42,0.6)] rounded-[1px]">
            <div className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground">Déf engagés</div>
            <div className="text-foreground">
              {preview.menEngagedDefender}/{defender.effective}
            </div>
          </div>
        </div>
        <div className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground mt-[2px]">
          Cap terrain : {preview.contactCap} hommes
        </div>

        {/* Breakdown ligne par ligne */}
        <div className="mt-2 pt-1 border-t border-[rgba(226,232,240,0.10)] space-y-[1px]">
          {preview.bonusBreakdown.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-[9px] tabular-nums">
              <span
                className={
                  b.appliedTo === 'attacker'
                    ? 'text-tactica-amber/90'
                    : 'text-blue-300/90'
                }
              >
                {b.label}
              </span>
              <span className="text-foreground">×{b.multiplier.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Resultat estime */}
        <div className="mt-2 pt-1 border-t border-[rgba(226,232,240,0.10)] flex items-center justify-between gap-3">
          <div>
            <div className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
              Pertes ennemi
            </div>
            <div className="text-[14px] font-semibold text-tactica-amber tabular-nums leading-tight">
              {preview.estimatedDamageMin}–{preview.estimatedDamageMax} hommes
            </div>
            <div className="text-[9px] text-muted-foreground tabular-nums mt-[2px] leading-tight">
              <span style={{ color: '#ef4444' }}>≈{preview.estimatedKilledMin}–{preview.estimatedKilledMax} tués</span>
              <span className="opacity-50"> · </span>
              <span style={{ color: '#fb923c' }}>≈{preview.estimatedWoundedMin}–{preview.estimatedWoundedMax} blessés</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
              Issue
            </div>
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.04em]"
              style={{ color: issueColor }}
            >
              {issueLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
