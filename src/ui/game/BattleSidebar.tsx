// v1.0 (10/05/2026) — P1-REFACTOR-01 : extraction depuis Game.tsx (panneau lateral en bataille)
import type { Team } from '@/types/game'
import type { UnitState } from '@engine/units'
import { TeamPanel, type SlotData } from '@ui/game/TeamPanel'
import { UnitInspector } from '@ui/game/UnitInspector'

export interface BattleSidebarProps {
  turn: number
  activeTeam: Team
  myTeam: Team | null
  isMyTurn: boolean
  selectedUnit: UnitState | null
  blueSlots: SlotData[]
  redSlots: SlotData[]
  hostUserId: string
  currentUserId: string
}

export function BattleSidebar({
  turn,
  activeTeam,
  myTeam,
  isMyTurn,
  selectedUnit,
  blueSlots,
  redSlots,
  hostUserId,
  currentUserId,
}: BattleSidebarProps) {
  const activeLabel = activeTeam === 'blue' ? 'Bleus' : 'Rouges'
  const activeColor = activeTeam === 'blue' ? '#3b82f6' : '#ef4444'

  return (
    <div className="space-y-4">
      <div
        className="relative px-3 py-3 border rounded-[2px]"
        style={{
          borderColor: activeColor,
          background: `linear-gradient(180deg, ${activeColor}22 0%, transparent 100%)`,
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
          Tour {turn}
        </div>
        <div
          className="text-[14px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: activeColor }}
        >
          {isMyTurn ? 'À toi de jouer' : `Tour des ${activeLabel}`}
        </div>
        {myTeam && (
          <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-[0.08em]">
            Ton camp : {myTeam === 'blue' ? 'Bleus' : 'Rouges'}
          </div>
        )}
      </div>

      {selectedUnit ? (
        <UnitInspector
          unit={selectedUnit}
          isMyUnit={selectedUnit.team === myTeam}
          isMyTurn={isMyTurn}
        />
      ) : (
        <div className="px-3 py-3 text-[10px] uppercase tracking-[0.08em] text-muted-foreground border border-[rgba(226,232,240,0.10)] rounded-[2px]">
          {isMyTurn
            ? 'Clique sur une de tes unités pour voir ses ordres.'
            : 'En attente du camp adverse. Tu peux inspecter une unité en la cliquant.'}
        </div>
      )}

      <TeamPanel
        team="blue"
        slots={blueSlots}
        hostUserId={hostUserId}
        currentUserId={currentUserId}
        canKick={false}
        onKick={() => undefined}
        compact
      />
      <TeamPanel
        team="red"
        slots={redSlots}
        hostUserId={hostUserId}
        currentUserId={currentUserId}
        canKick={false}
        onKick={() => undefined}
        compact
      />
    </div>
  )
}
