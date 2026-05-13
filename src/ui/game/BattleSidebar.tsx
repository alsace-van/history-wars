// v1.9 (13/05/2026) — Phase 3.2-bis : refonte UX sidebar — cartouche allégée (Tour N + joueur actif + récap unités MON camp seulement) + ParticipantsPanel collapsible
// v1.8 (13/05/2026) — Phase 3.2 C2 : OrdersPanel intégré sous UnitInspector
// v1.7 (12/05/2026) — QW2 : prop inspectedEnemy → EnemyUnitPanel (priorité selectedUnit > inspectedEnemy > fallback)
// v1.6 (12/05/2026) — UX : propage mergeMode + handlers à Inspector (fusion par clic map)
import type { Team } from '@/types/game'
import type { CohesionState, SupportCount } from '@engine/cohesion'
import type { UnitState, SplitRatio } from '@engine/units'
import { computeOrdinalLabels } from '@engine/units'
import type { SlotData } from '@ui/game/TeamPanel'
import { ParticipantsPanel } from '@ui/game/ParticipantsPanel'
import { UnitInspector } from '@ui/game/UnitInspector'
import { EnemyUnitPanel, type EnemyEngagementInfo } from '@ui/game/EnemyUnitPanel'
import { OrdersPanel } from '@ui/game/OrdersPanel'
import type { UnitOrderRow, SubmitOrdersOp } from '@hooks/usePreOrders'

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
  // v1.6 — mergeMode (sélection cible alliée sur la map, adjacent ou distant via move auto)
  mergeActive?: boolean
  mergeAvailableTargets?: number
  onEnterMergeMode?: () => void
  onExitMergeMode?: () => void
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
  // -------- QW2 : inspection unité ennemie (read-only, prioritaire seulement si pas de selectedUnit) --------
  inspectedEnemy?: UnitState | null
  /** Cohésion de l'ennemi inspecté (lookup côté parent dans cohesionStateMap). */
  inspectedEnemyCohesion?: CohesionState
  /** Engagements de l'ennemi inspecté (lookup côté parent dans engagementsByUnit). */
  inspectedEnemyEngagements?: ReadonlyArray<EnemyEngagementInfo>
  // -------- Phase 3.2 C : ordres conditionnels (pré-postures) de l'unité sélectionnée --------
  orders?: UnitOrderRow[]
  ordersBusy?: boolean
  ordersError?: string | null
  onCreateOrder?: (trigger: SubmitOrdersOp['trigger'], action: SubmitOrdersOp['action']) => Promise<boolean>
  onUpdateOrder?: (orderId: string, patch: Omit<SubmitOrdersOp, 'op' | 'order_id'>) => Promise<boolean>
  onDeleteOrder?: (orderId: string) => Promise<boolean>
  onReorderOrder?: (orderId: string, newPriority: number) => Promise<boolean>
  blueSlots: SlotData[]
  redSlots: SlotData[]
  hostUserId: string
  currentUserId: string
  /** Phase 3.2-bis : clic sur un pion de la liste effectif → recentre caméra. */
  onFocusUnit?: (unitId: string) => void
  /** Phase 3.2-bis : set des unitId engagés (pour icône mouvement orange). */
  engagedUnitIds?: Set<string>
}

export function BattleSidebar({
  turn,
  activeTeam,
  myTeam,
  isMyTurn,
  onFocusUnit,
  engagedUnitIds,
  selectedUnit,
  allUnits,
  gameId,
  splitActive,
  onEnterSplitMode,
  onExitSplitMode,
  mergeActive,
  mergeAvailableTargets,
  onEnterMergeMode,
  onExitMergeMode,
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
  inspectedEnemy,
  inspectedEnemyCohesion,
  inspectedEnemyEngagements,
  orders,
  ordersBusy,
  ordersError,
  onCreateOrder,
  onUpdateOrder,
  onDeleteOrder,
  onReorderOrder,
  blueSlots,
  redSlots,
  hostUserId,
  currentUserId,
}: BattleSidebarProps) {
  // v1.11 — voyant lumineux (couleur de l'équipe qui joue), récap effectif par pion (I.1, C.1...)
  // Cartouche fixée sur MON camp (FoW). Le voyant indique qui joue, sans texte ni fuite d'info.
  const myColor = myTeam === 'blue' ? '#3b82f6' : myTeam === 'red' ? '#ef4444' : '#94a3b8'
  const activeColor = activeTeam === 'blue' ? '#3b82f6' : '#ef4444'
  const mySlots = myTeam === 'blue' ? blueSlots : myTeam === 'red' ? redSlots : []
  const myPlayer =
    mySlots.find(s => s.role === 'general' && s.player !== null)?.player
    ?? mySlots.find(s => s.player !== null)?.player
    ?? null
  const myPlayerName = myPlayer?.username ?? 'Toi'

  // Récap MON camp pion par pion (I.1, I.2, C.1...). Ordre = ordre d'apparition
  // dans allUnits (= created_at côté useBattleUnits). Si une unité meurt, les n°
  // suivants se décalent (acceptable MVP, stabilisation backlog ultérieur).
  // Le label est calculé par le même helper que celui utilisé pour l'affichage 3D
  // au-dessus des pions (computeOrdinalLabels) → cohérence sidebar ↔ map garantie.
  const ordinalLabels = computeOrdinalLabels(allUnits)
  const myUnitRows: Array<{ unit: UnitState; label: string; engaged: boolean }> = []
  for (const u of allUnits) {
    if (u.team !== myTeam) continue
    myUnitRows.push({
      unit: u,
      label: ordinalLabels.get(u.id) ?? u.kind,
      engaged: engagedUnitIds?.has(u.id) ?? false,
    })
  }

  return (
    <div className="space-y-4">
      <div
        className="relative px-3 py-3 border rounded-[2px]"
        style={{
          borderColor: myColor,
          background: `linear-gradient(180deg, ${myColor}22 0%, transparent 100%)`,
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Tour {turn}
          </span>
          <span
            className="inline-block w-[10px] h-[10px] rounded-full shrink-0"
            style={{
              background: activeColor,
              boxShadow: isMyTurn
                ? `0 0 8px ${activeColor}, 0 0 2px ${activeColor}`
                : `0 0 4px ${activeColor}aa`,
            }}
            title={isMyTurn ? 'À toi de jouer' : 'Tour adverse'}
          />
        </div>
        <div
          className="text-[14px] font-semibold tracking-[0.04em] truncate"
          style={{ color: myColor }}
          title={myPlayerName}
        >
          {myPlayerName}
        </div>
        {myUnitRows.length > 0 && (
          <div className="mt-2 space-y-[2px]">
            {myUnitRows.map(({ unit, label, engaged }) => {
              const ratio = unit.effectiveMax > 0 ? unit.effective / unit.effectiveMax : 0
              const barColor = ratio > 0.6 ? '#22c55e' : ratio > 0.3 ? '#eab308' : '#ef4444'
              const atkColor = computeAttackIconColor(unit)
              const moveColor = computeMoveIconColor(unit, engaged)
              return (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => onFocusUnit?.(unit.id)}
                  className="w-full grid grid-cols-[42px_auto_1fr_auto] gap-2 items-center px-2 py-[3px] rounded-[2px] hover:bg-[rgba(226,232,240,0.06)] transition-colors text-left"
                  title={`Centrer la caméra sur ${label}`}
                >
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: myColor }}>
                    {label}
                  </span>
                  <span className="flex items-center gap-[3px] text-[11px] leading-none">
                    <span style={{ color: atkColor }} title="Attaque">⚔</span>
                    <span style={{ color: moveColor }} title="Mouvement">⬢</span>
                  </span>
                  <span className="h-[4px] bg-[rgba(15,23,42,0.6)] rounded-[1px] overflow-hidden">
                    <span
                      className="block h-full"
                      style={{ width: `${Math.round(ratio * 100)}%`, background: barColor }}
                    />
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground/90">
                    <span className="text-foreground">{unit.effective}</span>
                    <span className="opacity-50">/{unit.effectiveMax}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedUnit && orders !== undefined && onCreateOrder && onDeleteOrder && onReorderOrder && (
        <OrdersPanel
          isMyUnit={selectedUnit.team === myTeam}
          orders={orders}
          busy={!!ordersBusy}
          error={ordersError ?? null}
          onCreate={onCreateOrder}
          onUpdate={onUpdateOrder ?? (async () => false)}
          onDelete={onDeleteOrder}
          onReorder={onReorderOrder}
        />
      )}

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
          mergeActive={mergeActive}
          mergeAvailableTargets={mergeAvailableTargets}
          onEnterMergeMode={onEnterMergeMode}
          onExitMergeMode={onExitMergeMode}
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
      ) : inspectedEnemy ? (
        <EnemyUnitPanel
          unit={inspectedEnemy}
          cohesionState={inspectedEnemyCohesion}
          engagements={inspectedEnemyEngagements}
          currentTurn={currentTurn}
        />
      ) : (
        <div className="px-3 py-3 text-[12px] uppercase tracking-[0.08em] text-muted-foreground border border-[rgba(226,232,240,0.10)] rounded-[2px]">
          {isMyTurn
            ? 'Clique sur une de tes unités pour voir ses ordres. Clique un ennemi pour l’inspecter.'
            : 'En attente du camp adverse. Clique une unité (alliée ou ennemie) pour l’inspecter.'}
        </div>
      )}

      <ParticipantsPanel
        blueSlots={blueSlots}
        redSlots={redSlots}
        hostUserId={hostUserId}
        currentUserId={currentUserId}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Phase 3.2-bis — couleurs icônes d'état (cohérent avec UnitPlaceholder.resolve*).
// ---------------------------------------------------------------------------
function computeAttackIconColor(unit: UnitState): string {
  if (unit.routed || unit.hasAttacked) return '#ef4444'
  return '#22c55e'
}

function computeMoveIconColor(unit: UnitState, engaged: boolean): string {
  if (unit.hasMoved) return '#ef4444'
  if (unit.routed) return '#fb923c'
  if (engaged) return '#fb923c'
  return '#22c55e'
}
