// v3.26 (12/05/2026) — Phase 3.1-C : useVisionMap câblé + tileVisibility + enemyVisibility propagés
// v3.25 (12/05/2026) — QW1 : extraction useGameLifecycle + useCombatToastFeed + BattleHeader/Footer
// v3.24 (12/05/2026) — UX manœuvres : mergeMode global + clic cible map (move+merge) + scinder simplifié
// v3.23 (12/05/2026) — UX : journal rapports combat replié par défaut + toast sur nouveau combat + bouton Topbar
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useRequireAuth } from '@hooks/useRequireAuth'
import { useGame } from '@hooks/useGame'
import { useGameRealtime } from '@hooks/useGameRealtime'
import { useOnlineStatus } from '@hooks/useOnlineStatus'
import { useBattleUnits } from '@hooks/useBattleUnits'
import { useCombatActions } from '@hooks/useCombatActions'
import { useTacticalSelection } from '@hooks/useTacticalSelection'
import { useCombatNotifications } from '@hooks/useCombatNotifications'
import { useCombatAnimator } from '@hooks/useCombatAnimator'
import { useSettings } from '@hooks/useSettings'
import { useUnitCriticalActions } from '@hooks/useUnitCriticalActions'
import { useBattleClickHandlers } from '@hooks/useBattleClickHandlers'
import { useEngagement } from '@hooks/useEngagement'
import { useUnitSizing } from '@hooks/useUnitSizing'
import { useGameLifecycle } from '@hooks/useGameLifecycle'
import { useCombatToastFeed } from '@hooks/useCombatToastFeed'
import { useEnemyHoverTooltip } from '@hooks/useEnemyHoverTooltip'
import { useUnitPathAnimation } from '@hooks/useUnitPathAnimation'
import { useEngagementDerivations } from '@hooks/useEngagementDerivations'
import { useVisionMap } from '@hooks/useVisionMap'
import {
  isHost,
  isPlayerInGame,
  deriveSlotAssignment,
  type Team,
} from '@/types/game'
import { PageBackground } from '@ui/layout/PageBackground'
import { TeamPanel, type SlotData } from '@ui/game/TeamPanel'
import { BattleSidebar } from '@ui/game/BattleSidebar'
import { GameHUD } from '@ui/game/GameHUD'
import { GameTopBar } from '@ui/game/GameTopBar'
import { BattleHeader } from '@ui/game/BattleHeader'
import { BattleSidebarFooter } from '@ui/game/BattleSidebarFooter'
import { getScaleLabel, getStatusLabel } from '@ui/game/gameLabels'
import { BattleModals } from '@ui/game/BattleModals'
import { CombatPreviewTooltip } from '@ui/game/CombatPreviewTooltip'
import { CombatResultPanel } from '@ui/game/CombatResultPanel'
import type { CombatNotification } from '@hooks/useCombatNotifications'
import { TacticalScene, buildMvpUnitPlacement } from '@/render'
import { unitRowsToInstances, unitRowsToStates } from '@render/_data/unitAdapter'
import { spiral, cubeKey, type Cube } from '@engine/hex'
import { type UnitState, type SplitRatio } from '@engine/units'

// v3.22 : board cubes derives a runtime depuis tactical.boardRadius (cf. useMemo dans le composant).
// La valeur de fallback ci-dessous sert au rendu pre-bataille (lobby) ou si state encore null.
const DEFAULT_TACTICAL_RADIUS = 7

interface TacticalStateView {
  phase?: string
  boardRadius?: number
  currentTurn?: number
  activeTeam?: Team
  scenarioId?: string
  winner?: Team | null
}

export function Game() {
  const { id: gameId } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useRequireAuth()
  const navigate = useNavigate()

  const { game, players, loading, notFound, refresh, leaveGame, kickPlayer, deleteGame } =
    useGame(gameId, user?.id ?? null)

  const [busy, setBusy] = useState(false)

  useGameRealtime({
    gameId,
    enabled: !!user,
    onGameUpdate: () => void refresh(),
    onGameDelete: () => {
      toast.error("L'hôte a dissous la partie.")
      navigate('/lobby')
    },
    onPlayersChange: () => void refresh(),
  })

  useEffect(() => {
    if (loading || authLoading || !user) return
    if (notFound) {
      toast.error('Partie introuvable.')
      navigate('/lobby')
      return
    }
    if (game && !isHost(game, user.id) && !isPlayerInGame(players, user.id)) {
      toast.error("Tu n'es pas dans cette partie. Reviens depuis le lobby pour la rejoindre.")
      navigate('/lobby')
    }
  }, [loading, authLoading, user, notFound, game, players, navigate])

  const slots = useMemo<SlotData[]>(() => {
    if (!game) return []
    const out: SlotData[] = []
    for (let i = 0; i < game.max_players; i++) {
      const { team, role } = deriveSlotAssignment(i)
      const player = players.find(p => p.slot_index === i) ?? null
      out.push({ index: i, team, role, player })
    }
    return out
  }, [game, players])

  const blueSlots = useMemo(() => slots.filter(s => s.team === 'blue'), [slots])
  const redSlots = useMemo(() => slots.filter(s => s.team === 'red'), [slots])

  const inProgress = game?.status === 'in_progress'
  const finished = game?.status === 'finished'
  const showBattle = inProgress || finished

  const { units: dbUnits, loading: unitsLoading } = useBattleUnits(gameId, showBattle)

  const factoryUnits = useMemo(() => buildMvpUnitPlacement(), [])

  const renderUnits = useMemo(() => {
    if (showBattle) return unitRowsToInstances(dbUnits)
    return factoryUnits
  }, [showBattle, dbUnits, factoryUnits])

  const unitStates = useMemo<UnitState[]>(
    () => (showBattle ? unitRowsToStates(dbUnits) : []),
    [showBattle, dbUnits]
  )

  const { busy: actionsBusy, startBattle, submitAction, endTurn } = useCombatActions()

  const online = useOnlineStatus()

  const iAmHost = !!game && isHost(game, user?.id ?? null)
  const iAmIn = isPlayerInGame(players, user?.id ?? null)

  const tactical: TacticalStateView | null = useMemo(() => {
    if (!game) return null
    const s = game.state as { tactical?: TacticalStateView } | null | undefined
    return s?.tactical ?? null
  }, [game])

  // v3.22 : board derive de state.tactical.boardRadius (compatible parties existantes radius=5
  // grâce au stockage en state — nouvelle partie = 7 via DEFAULT_BOARD_RADIUS EF).
  // Calcul direct sans useMemo pour respecter la regle hooks "ajout en queue uniquement"
  // (passe ces valeurs aux hooks de selection/critical en aval).
  const boardRadius = tactical?.boardRadius ?? DEFAULT_TACTICAL_RADIUS
  const mvpCubes: Cube[] = spiral({ q: 0, r: 0, s: 0 }, boardRadius)
  const mvpBoardKeys = new Set(mvpCubes.map(cubeKey))

  const occupiedPlayers = useMemo(() => players.filter(p => p.user_id !== null), [players])
  const blueOccupied = occupiedPlayers.some(p => p.team === 'blue')
  const redOccupied = occupiedPlayers.some(p => p.team === 'red')
  const canStart =
    iAmHost &&
    game?.status === 'lobby' &&
    occupiedPlayers.length >= 2 &&
    blueOccupied &&
    redOccupied

  const startTooltip = useMemo(() => {
    if (!iAmHost) return "Seul l'hôte peut engager la bataille."
    if (game?.status !== 'lobby') return 'Bataille déjà engagée.'
    if (occupiedPlayers.length < 2) return 'Il faut au moins 2 officiers.'
    if (!blueOccupied || !redOccupied) return 'Chaque camp doit avoir au moins 1 officier.'
    return null
  }, [iAmHost, game?.status, occupiedPlayers.length, blueOccupied, redOccupied])

  const activeTeam: Team = tactical?.activeTeam ?? 'blue'
  const myTeam = useMemo(
    () => players.find(p => p.user_id === user?.id)?.team ?? null,
    [players, user?.id]
  )
  const isMyTurn = inProgress && myTeam === activeTeam

  // Lookup actor_user_id → team pour useCombatNotifications (toasts asymetriques)
  const playerTeams = useMemo<Map<string, Team>>(() => {
    const map = new Map<string, Team>()
    for (const p of players) {
      if (p.user_id && p.team) map.set(p.user_id, p.team)
    }
    return map
  }, [players])

  const [splitMode, setSplitMode] = useState<SplitRatio | null>(null)
  // v3.24 — mode "choisir cible fusion sur la map" (toggle via Inspector ou clic sur unité cible)
  const [mergeMode, setMergeMode] = useState(false)
  // Phase 2.5 C — modes UI actions critiques
  const [retreatMode, setRetreatMode] = useState(false)
  const [suicideMode, setSuicideMode] = useState(false)
  const [pendingShakenAttack, setPendingShakenAttack] = useState<{ targetId: string } | null>(null)

  // Phase 2.6 C — engagements actifs (table engagements migration 017 + Realtime).
  const { engagements: engagementRows, engagedUnitIds, engagementsByUnit } = useEngagement(gameId, showBattle)

  // Phase 3.1-C : fog client (vision range + LoS). Doit être appelé AVANT useTacticalSelection
  // car ses outputs alimentent visibleTileKeys + enemyVisibility (filtre reachable/targetable).
  const { visibleTileMap, enemyVisibility, visibleEnemyIds, visibleTileKeys } = useVisionMap({
    myTeam: showBattle ? myTeam : null,
    unitStates,
    boardKeys: mvpBoardKeys,
    activeTeam,
  })

  const {
    selectedUnitId,
    selectedUnit,
    reachableMap,
    targetableUnitIds,
    tileStates,
    exhaustedUnitIds,
    splitTargetKeys,
    cohesionStateMap,
    supportMap,
    retreatTargetKeys,
    suicideTargetIds,
    inspectedEnemy,
    handleUnitClick: hookHandleUnitClick,
    clearSelection,
  } = useTacticalSelection({
    inProgress, isMyTurn, myTeam, activeTeam, unitStates,
    boardKeys: mvpBoardKeys,
    splitMode: splitMode !== null,
    retreatMode,
    suicideMode,
    engagedUnitIds,
    visibleTileKeys: inProgress && myTeam ? visibleTileKeys : undefined,
    enemyVisibility: inProgress && myTeam ? enemyVisibility : undefined,
  })

  const critical = useUnitCriticalActions({
    gameId: gameId ?? null,
    selectedUnit,
    unitStates,
    boardKeys: mvpBoardKeys,
    onActionCompleted: () => {
      setRetreatMode(false)
      setSuicideMode(false)
      setPendingShakenAttack(null)
      clearSelection()
      // Phase 2.5 fix : refresh manuel après action critique (Realtime peut décrocher).
      void refresh()
    },
  })

  useEffect(() => {
    setSplitMode(null)
    setRetreatMode(false)
    setSuicideMode(false)
    setPendingShakenAttack(null)
  }, [selectedUnitId, isMyTurn])

  const selectedCohesionState = selectedUnit ? cohesionStateMap.get(selectedUnit.id) : undefined
  const selectedSupport = selectedUnit ? supportMap.get(selectedUnit.id) : undefined

  // v3.24 — Hook sizing centralisé pour exposer mergeTargets au plateau (highlights bleus)
  // ET fournir performMerge utilisé par le click handler en mergeMode. Inspector instancie
  // son propre useUnitSizing — la double instanciation est OK (les résultats sont identiques).
  const sizing = useUnitSizing({
    gameId: gameId ?? null,
    unit: selectedUnit,
    allUnits: unitStates,
    isMyUnit: !!selectedUnit && selectedUnit.team === myTeam,
    isMyTurn,
  })
  const mergeTargetUnitIds = useMemo<Set<string>>(() => {
    if (!mergeMode) return new Set()
    return new Set(sizing.mergeTargets.map(t => t.id))
  }, [mergeMode, sizing.mergeTargets])
  // Reset mergeMode si l'unité courante change / si la liste de cibles devient vide / si fin de tour.
  useEffect(() => {
    if (!mergeMode) return
    if (!selectedUnit || sizing.mergeTargets.length === 0 || !isMyTurn) setMergeMode(false)
  }, [mergeMode, selectedUnit, sizing.mergeTargets.length, isMyTurn])

  const { enginePairs, engagementsForSelected, engagementsForInspected } = useEngagementDerivations({
    unitStates, engagementRows, engagementsByUnit, selectedUnit, inspectedEnemy,
  })

  const inspectedEnemyCohesion = inspectedEnemy ? cohesionStateMap.get(inspectedEnemy.id) : undefined

  // ---- Notifications combat en onglets (cf piège #52) ----
  const { notifications: combatNotifs, removeNotification: removeCombatNotif, clear: clearCombatNotifs } =
    useCombatNotifications({
      gameId: gameId ?? null,
      viewerTeam: showBattle ? myTeam : null,
      enabled: showBattle,
      playerTeams,
      units: unitStates,
    })

  const { settings: uiSettings, setSkipShakenWarning, animationDurationMs } = useSettings()
  const { floaters: damageFloaters, removeFloater } = useCombatAnimator({ notifications: combatNotifs, unitStates, animationDurationMs, enabled: showBattle })

  // Highlight unitéIds = mon unité + ennemi du rapport actif (ennemi filtré par fog of war : LoS depuis n'importe laquelle de mes unités).
  const [activeCombatNotif, setActiveCombatNotif] = useState<CombatNotification | null>(null)
  const highlightedUnitIds = useMemo<Set<string>>(() => {
    if (!activeCombatNotif) return new Set()
    const out = new Set<string>()
    const myUnitId = activeCombatNotif.isMyAttack ? activeCombatNotif.attackerId : activeCombatNotif.defenderId
    const enemyUnitId = activeCombatNotif.isMyAttack ? activeCombatNotif.defenderId : activeCombatNotif.attackerId
    out.add(myUnitId)
    // Fog of war : l'ennemi ne s'illumine que s'il est observé par AU MOINS une de mes unités
    if (visibleEnemyIds.has(enemyUnitId)) {
      out.add(enemyUnitId)
    }
    return out
  }, [activeCombatNotif, visibleEnemyIds])

  // Phase 1.5 : focus camera sur une unité depuis le bouton "Centrer" de CombatResultPanel
  const [cameraFocusCube, setCameraFocusCube] = useState<Cube | null>(null)
  const handleFocusUnit = useCallback(
    (unitId: string) => {
      const u = unitStates.find(uu => uu.id === unitId)
      if (u) setCameraFocusCube(u.position)
    },
    [unitStates]
  )

  const {
    hoveredEnemy, mousePos, setHoveredEnemyId,
    handleSceneMouseMove, handleUnitPointerOver, handleUnitPointerOut,
  } = useEnemyHoverTooltip({ unitStates, targetableUnitIds })

  const { unitPaths, setUnitPaths, onUnitPathDone } = useUnitPathAnimation()

  // Phase 2.5 C — handlers click extraits dans useBattleClickHandlers (alléger Game.tsx)
  const { handleUnitClick, handleTileClick, handleShakenConfirm } = useBattleClickHandlers({
    gameId: gameId ?? null,
    inProgress,
    selectedUnit,
    myTeam,
    unitStates,
    reachableMap,
    targetableUnitIds,
    splitMode,
    splitTargetKeys,
    retreatMode,
    retreatTargetKeys,
    suicideMode,
    suicideTargetIds,
    mergeMode,
    mergeTargetUnitIds,
    performMerge: sizing.performMerge,
    setMergeMode,
    selectedCohesionState,
    skipShakenWarning: uiSettings.skipShakenWarning,
    actionsBusy,
    submitAction,
    performRetreat: critical.performRetreat,
    performSuicide: critical.performSuicide,
    hookHandleUnitClick,
    clearSelection,
    setHoveredEnemyId,
    setSplitMode,
    setRetreatMode,
    setPendingShakenAttack,
    setSkipShakenWarning,
    setUnitPaths,
    pendingShakenAttack,
  })

  const { handleLeave, handleKick, handleStartBattle, handleEndTurn, handleBreakCombat } = useGameLifecycle({
    gameId: gameId ?? null, iAmHost, busy, setBusy,
    deleteGame, leaveGame, kickPlayer,
    canStart, inProgress, isMyTurn, actionsBusy,
    startBattle, endTurn, submitAction, refresh, clearSelection,
    selectedUnit, engagedUnitIds, navigate,
  })

  // Modal de fin : ouverte automatiquement sur status='finished',
  // refermable une fois (l'utilisateur peut rester sur le plateau pour debriefer).
  const [endModalDismissed, setEndModalDismissed] = useState(false)
  useEffect(() => {
    if (!finished) setEndModalDismissed(false)
  }, [finished, gameId])

  // v3.23 — Journal des combats : extrait dans useCombatToastFeed (QW1).
  const { combatPanelOpen, setCombatPanelOpen, toggleCombatPanel } = useCombatToastFeed({ combatNotifs })

  if (authLoading || !user || loading || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  const hostUserId = game.created_by
  const scaleLabel = getScaleLabel(game.current_scale)
  const statusLabel = getStatusLabel(game.status)
  const subtitleLabel = showBattle ? 'Bataille' : 'Brief'

  return (
    <div className="h-screen relative font-sans flex flex-col overflow-hidden">
      <PageBackground />

      <GameTopBar
        subtitleLabel={subtitleLabel}
        username={(user.user_metadata?.username as string | undefined) ?? user.email ?? 'soldat'}
        onBack={() => navigate('/lobby')}
        combatReportsCount={showBattle ? combatNotifs.length : undefined}
        combatReportsOpen={combatPanelOpen}
        onToggleCombatReports={showBattle ? toggleCombatPanel : undefined}
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <BattleHeader
            statusLabel={statusLabel}
            gameName={game.name}
            scenarioId={game.scenario_id}
            scaleLabel={scaleLabel}
            hostName={players.find(p => p.user_id === hostUserId)?.username ?? '...'}
            turnNumber={tactical?.currentTurn ?? game.turn_number}
          />

          <div
            className="flex-1 relative min-h-0"
            onMouseMove={showBattle ? handleSceneMouseMove : undefined}
          >
            <TacticalScene
              scale={game.current_scale}
              cubes={mvpCubes}
              units={renderUnits}
              viewerTeam={showBattle ? myTeam : null}
              tileStates={showBattle ? tileStates : undefined}
              selectedUnitId={selectedUnitId}
              targetableUnitIds={showBattle ? targetableUnitIds : undefined}
              mergeTargetUnitIds={showBattle ? mergeTargetUnitIds : undefined}
              exhaustedUnitIds={showBattle ? exhaustedUnitIds : undefined}
              highlightedUnitIds={showBattle ? highlightedUnitIds : undefined}
              cameraFocusCube={cameraFocusCube}
              unitPaths={showBattle ? unitPaths : undefined}
              onUnitPathDone={onUnitPathDone}
              onTileClick={showBattle ? handleTileClick : undefined}
              onUnitClick={showBattle ? handleUnitClick : undefined}
              onUnitPointerOver={showBattle ? handleUnitPointerOver : undefined}
              onUnitPointerOut={showBattle ? handleUnitPointerOut : undefined}
              damageFloaters={showBattle ? damageFloaters : undefined}
              damageFloaterDurationMs={animationDurationMs}
              onDamageFloaterDone={removeFloater}
              cohesionStateMap={showBattle ? cohesionStateMap : undefined}
              supportMap={showBattle ? supportMap : undefined}
              engagements={showBattle ? enginePairs : undefined}
              tileVisibility={inProgress && myTeam ? visibleTileMap : undefined}
              enemyVisibility={inProgress && myTeam ? enemyVisibility : undefined}
            />
            {combatPanelOpen && (
              <CombatResultPanel
                notifications={combatNotifs}
                onActiveChange={setActiveCombatNotif}
                onRemove={removeCombatNotif}
                onClear={() => {
                  clearCombatNotifs()
                  setCombatPanelOpen(false)
                }}
                onClose={() => setCombatPanelOpen(false)}
                onFocusUnit={handleFocusUnit}
              />
            )}
            {hoveredEnemy && selectedUnit && (
              <CombatPreviewTooltip attacker={selectedUnit} defender={hoveredEnemy} screenPos={mousePos} />
            )}
            <div className="absolute top-3 left-3 px-3 py-2 bg-[rgba(15,23,42,0.85)] backdrop-blur-[6px] border border-[rgba(226,232,240,0.18)] rounded-[2px] text-[10px] text-muted-foreground tracking-[0.05em] uppercase pointer-events-none">
              <div>Drag : rotation · Drag droit : pan · Molette : zoom</div>
            </div>
            {showBattle && unitsLoading && (
              <div className="absolute top-3 right-3 px-3 py-2 bg-[rgba(15,23,42,0.85)] backdrop-blur-[6px] border border-[rgba(226,232,240,0.18)] rounded-[2px] text-[10px] text-muted-foreground tracking-[0.05em] uppercase pointer-events-none">
                Chargement des unités…
              </div>
            )}
            <GameHUD
              status={game.status}
              iAmHost={iAmHost}
              iAmIn={iAmIn}
              isMyTurn={isMyTurn}
              canStart={canStart}
              startTooltip={startTooltip}
              busy={busy}
              actionsBusy={actionsBusy}
              onStartBattle={handleStartBattle}
              onEndTurn={handleEndTurn}
              onLeave={handleLeave}
            />
          </div>
        </div>

        <aside className="w-[340px] shrink-0 border-l border-[rgba(226,232,240,0.18)] bg-[rgba(8,12,24,0.7)] backdrop-blur-[2px] flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {showBattle ? (
              <BattleSidebar
                turn={tactical?.currentTurn ?? game.turn_number}
                activeTeam={activeTeam}
                myTeam={myTeam}
                isMyTurn={isMyTurn}
                selectedUnit={selectedUnit}
                allUnits={unitStates}
                gameId={game.id}
                splitActive={splitMode !== null}
                onEnterSplitMode={ratio => { setMergeMode(false); setSplitMode(ratio) }}
                onExitSplitMode={() => setSplitMode(null)}
                mergeActive={mergeMode}
                mergeAvailableTargets={sizing.mergeTargets.length}
                onEnterMergeMode={() => { setSplitMode(null); setMergeMode(true) }}
                onExitMergeMode={() => setMergeMode(false)}
                cohesionState={selectedCohesionState}
                support={selectedSupport}
                canRetreat={critical.canRetreat}
                canSuicide={critical.canSuicide}
                retreatActive={retreatMode}
                suicideActive={suicideMode}
                onEnterRetreatMode={() => { setSuicideMode(false); setRetreatMode(true) }}
                onExitRetreatMode={() => setRetreatMode(false)}
                onEnterSuicideMode={() => { setRetreatMode(false); setSuicideMode(true) }}
                onExitSuicideMode={() => setSuicideMode(false)}
                onSurrender={() => void critical.performSurrender()}
                engagements={engagementsForSelected}
                currentTurn={tactical?.currentTurn ?? game.turn_number}
                onBreakCombat={() => void handleBreakCombat()}
                breakCombatDisabled={actionsBusy}
                inspectedEnemy={inspectedEnemy}
                inspectedEnemyCohesion={inspectedEnemyCohesion}
                inspectedEnemyEngagements={engagementsForInspected}
                blueSlots={blueSlots}
                redSlots={redSlots}
                hostUserId={hostUserId}
                currentUserId={user.id}
              />
            ) : (
              <>
                <TeamPanel team="blue" slots={blueSlots} hostUserId={hostUserId} currentUserId={user.id} canKick={iAmHost} onKick={handleKick} compact />
                <TeamPanel team="red" slots={redSlots} hostUserId={hostUserId} currentUserId={user.id} canKick={iAmHost} onKick={handleKick} compact />
              </>
            )}
          </div>

          <BattleSidebarFooter
            playersCount={players.length}
            maxPlayers={game.max_players}
            online={online}
          />
        </aside>
      </div>

      {gameId && (
        <BattleModals
          endGameOpen={finished && !endModalDismissed}
          onEndGameClose={() => { setEndModalDismissed(true); navigate('/lobby') }}
          gameId={gameId}
          winner={tactical?.winner ?? null}
          totalTurns={tactical?.currentTurn ?? game.turn_number}
          shakenSelectedUnit={selectedUnit}
          pendingShakenAttack={pendingShakenAttack}
          onShakenConfirm={(dontShowAgain) => void handleShakenConfirm(dontShowAgain)}
          onShakenCancel={() => setPendingShakenAttack(null)}
        />
      )}
    </div>
  )
}

