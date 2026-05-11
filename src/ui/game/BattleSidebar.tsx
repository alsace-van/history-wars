// v1.4 (11/05/2026) — Phase 2.6 C : propage engagements + currentTurn + onBreakCombat à Inspector
// v1.3 (11/05/2026) — Phase 2.5 C : propage cohesionState + actions critiques (retraite/reddition/suicide) à Inspector
// v1.2 (10/05/2026) — Phase 2 2D.6 : propagation splitActive/onEnterSplitMode/onExitSplitMode a Inspector
// v1.1 (10/05/2026) — Phase 2 2D.4 : effectif total par camp + propagation gameId/allUnits a Inspector
import type { Team } from '@/types/game'
import type { CohesionState, SupportCount } from '@engine/cohesion'
import type { UnitState, SplitRatio } from '@engine/units'
import { TeamPanel, type SlotData } from '@ui/game/TeamPanel'
import { UnitInspector } from '@ui/game/UnitInspector'

export interface BattleSidebarProps {
  turn: number
  activeTeam: Team
  myTeam: Team | null
  isMyTurn: boolean
  selectedUnit: UnitState | null
  /** Phase 2 : tous les pions sur la carte (pour adjacence split/merge + total effectif). */
  allUnits: ReadonlyArray<UnitState>
  /** Phase 2 : pour appel EF resolve_action depuis Inspector. */
  gameId: string | null
  /** Phase 2 2D.6 : true si l'utilisateur est en cours de choix de case split sur la grille. */
  splitActive: boolean
  /** Phase 2 2D.6 : entre en mode "choisir case split" (parent active highlight grille). */
  onEnterSplitMode: (ratio: SplitRatio) => void
  /** Phase 2 2D.6 : sort du mode split (parent éteint highlight). */
  onExitSplitMode: () => void
  // -------- Phase 2.5 C : panneau État critique (cohésion broken) --------
  cohesionState?: CohesionState
  /** Phase 2.5 v2.3 : décompte soutien pour affichage temps réel. */
  support?: SupportCount
  canRetreat?: boolean
  canSuicide?: boolean
  retreatActive?: boolean
  suicideActive?: boolean
  onEnterRetreatMode?: () => void
  onExitRetreatMode?: () => void
  onEnterSuicideMode?: () => void
  onExitSuicideMode?: () => void
  onSurrender?: () => void
  // -------- Phase 2.6 C : engagement persistant --------
  engagements?: ReadonlyArray<{
    id: string
    opponentId: string
    opponentKind: string
    opponentTeam: Team
    startedTurn: number
  }>
  /** Phase 2.6 : utilisé pour calculer "Engagé depuis T<N>". */
  currentTurn?: number
  onBreakCombat?: () => void
  breakCombatDisabled?: boolean
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
  allUnits,
  gameId,
  splitActive,
  onEnterSplitMode,
  onExitSplitMode,
  cohesionState,
  support,
  canRetreat,
  canSuicide,
  retreatActive,
  suicideActive,
  onEnterRetreatMode,
  onExitRetreatMode,
  onEnterSuicideMode,
  onExitSuicideMode,
  onSurrender,
  engagements,
  currentTurn,
  onBreakCombat,
  breakCombatDisabled,
  blueSlots,
  redSlots,
  hostUserId,
  currentUserId,
}: BattleSidebarProps) {
  const activeLabel = activeTeam === 'blue' ? 'Bleus' : 'Rouges'
  const activeColor = activeTeam === 'blue' ? '#3b82f6' : '#ef4444'

  // Phase 2 : effectif total cumule par camp (somme des effective vivants)
  let blueEffectiveTotal = 0
  let redEffectiveTotal = 0
  for (const u of allUnits) {
    if (u.team === 'blue') blueEffectiveTotal += u.effective
    else if (u.team === 'red') redEffectiveTotal += u.effective
  }

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
        {/* Phase 2 : effectifs totaux */}
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] tabular-nums">
          <div className="px-2 py-1 border border-blue-400/40 rounded-[2px] bg-blue-400/10 text-blue-300">
            <span className="opacity-70 mr-1">Bleus</span>{blueEffectiveTotal}
          </div>
          <div className="px-2 py-1 border border-red-400/40 rounded-[2px] bg-red-400/10 text-red-300">
            <span className="opacity-70 mr-1">Rouges</span>{redEffectiveTotal}
          </div>
        </div>
      </div>

      {selectedUnit ? (
        <UnitInspector
          unit={selectedUnit}
          isMyUnit={selectedUnit.team === myTeam}
          isMyTurn={isMyTurn}
          gameId={gameId}
          allUnits={allUnits}
          splitActive={splitActive}
          onEnterSplitMode={onEnterSplitMode}
          onExitSplitMode={onExitSplitMode}
          cohesionState={cohesionState}
          support={support}
          canRetreat={canRetreat}
          canSuicide={canSuicide}
          retreatActive={retreatActive}
          suicideActive={suicideActive}
          onEnterRetreatMode={onEnterRetreatMode}
          onExitRetreatMode={onExitRetreatMode}
          onEnterSuicideMode={onEnterSuicideMode}
          onExitSuicideMode={onExitSuicideMode}
          onSurrender={onSurrender}
          engagements={engagements}
          currentTurn={currentTurn}
          onBreakCombat={onBreakCombat}
          breakCombatDisabled={breakCombatDisabled}
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
