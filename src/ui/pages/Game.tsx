// v3.20 (11/05/2026) — Phase 2.5 fix UX : passe support à BattleSidebar (affichage cohésion temps réel dans Inspector)
// v3.19 (11/05/2026) — Phase 2.5 C.2 : transmission cohesionStateMap + supportMap à TacticalScene (anneaux 3D)
// v3.18 (11/05/2026) — Phase 2.5 fix : refresh manuel après endTurn + actions critiques (UI sync sans Realtime)
// v3.17 (11/05/2026) — Phase 2.5 C : actions critiques Brisé (retraite/reddition/suicide) + modale Ébranlé
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
import { Bracket } from '@ui/game/Bracket'
import { BattleModals } from '@ui/game/BattleModals'
import { CombatPreviewTooltip } from '@ui/game/CombatPreviewTooltip'
import { CombatResultPanel } from '@ui/game/CombatResultPanel'
import type { CombatNotification } from '@hooks/useCombatNotifications'
import { TacticalScene, buildMvpUnitPlacement } from '@/render'
import { unitRowsToInstances, unitRowsToStates } from '@render/_data/unitAdapter'
import type { UnitInstance } from '@render/types'
import { spiral, cubeKey, type Cube } from '@engine/hex'
import { type UnitState, type SplitRatio } from '@engine/units'
import { cn } from '@lib/cn'

const MVP_CUBES: Cube[] = spiral({ q: 0, r: 0, s: 0 }, 5)
const MVP_BOARD_KEYS = new Set(MVP_CUBES.map(cubeKey))

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
  // Phase 2.5 C — modes UI actions critiques
  const [retreatMode, setRetreatMode] = useState(false)
  const [suicideMode, setSuicideMode] = useState(false)
  const [pendingShakenAttack, setPendingShakenAttack] = useState<{ targetId: string } | null>(null)

  const {
    selectedUnitId,
    selectedUnit,
    reachableMap,
    targetableUnitIds,
    visibleEnemyIds,
    tileStates,
    exhaustedUnitIds,
    splitTargetKeys,
    cohesionStateMap,
    supportMap,
    retreatTargetKeys,
    suicideTargetIds,
    handleUnitClick: hookHandleUnitClick,
    clearSelection,
  } = useTacticalSelection({
    inProgress, isMyTurn, myTeam, activeTeam, unitStates,
    boardKeys: MVP_BOARD_KEYS,
    splitMode: splitMode !== null,
    retreatMode,
    suicideMode,
  })

  const critical = useUnitCriticalActions({
    gameId: gameId ?? null,
    selectedUnit,
    unitStates,
    boardKeys: MVP_BOARD_KEYS,
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

  // ---- Hover ennemi targetable → tooltip combat ----
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const handleSceneMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!hoveredEnemyId) return // pas de tooltip → inutile de mettre a jour
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [hoveredEnemyId])

  const handleUnitPointerOver = useCallback((unit: UnitInstance) => {
    if (targetableUnitIds.has(unit.id)) setHoveredEnemyId(unit.id)
  }, [targetableUnitIds])

  const handleUnitPointerOut = useCallback((unit: UnitInstance) => {
    setHoveredEnemyId(prev => (prev === unit.id ? null : prev))
  }, [])

  const hoveredEnemy = useMemo<UnitState | null>(
    () => unitStates.find(u => u.id === hoveredEnemyId) ?? null,
    [unitStates, hoveredEnemyId]
  )

  // Reset hover si selection change (l'ennemi peut sortir du targetableUnitIds)
  useEffect(() => {
    if (hoveredEnemyId && !targetableUnitIds.has(hoveredEnemyId)) {
      setHoveredEnemyId(null)
    }
  }, [hoveredEnemyId, targetableUnitIds])

  // ---- Animation paths : Map<unitId, path[]> consommee par UnitPlaceholder ----
  const [unitPaths, setUnitPaths] = useState<Map<string, ReadonlyArray<Cube>>>(new Map())

  const onUnitPathDone = useCallback((unitId: string) => {
    setUnitPaths(prev => {
      if (!prev.has(unitId)) return prev
      const next = new Map(prev)
      next.delete(unitId)
      return next
    })
  }, [])

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

  async function handleLeave() {
    if (!user || busy) return
    if (iAmHost) {
      const ok = window.confirm("Tu es l'hôte. Quitter va dissoudre la partie pour tous les joueurs. Continuer ?")
      if (!ok) return
      setBusy(true)
      const { error } = await deleteGame()
      setBusy(false)
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Partie dissoute.')
      navigate('/lobby')
    } else {
      setBusy(true)
      const { error } = await leaveGame()
      setBusy(false)
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Tu as quitté la partie.')
      navigate('/lobby')
    }
  }

  async function handleKick(playerId: string) {
    if (!iAmHost || busy) return
    setBusy(true)
    const { error } = await kickPlayer(playerId)
    setBusy(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Officier renvoyé.')
  }

  async function handleStartBattle() {
    if (!gameId || !canStart || actionsBusy) return
    const res = await startBattle(gameId)
    if (res.ok) toast.success('Bataille engagée.')
  }

  async function handleEndTurn() {
    if (!gameId || !inProgress || !isMyTurn || actionsBusy) return
    const res = await endTurn(gameId)
    if (res.ok) {
      clearSelection()
      // Phase 2.5 fix : ne pas dépendre uniquement de Realtime (qui peut décrocher).
      // Refresh manuel garantit que activeTeam UI suit la BDD immédiatement.
      void refresh()
      toast.success('Tour terminé.')
    }
  }

  // Modal de fin : ouverte automatiquement sur status='finished',
  // refermable une fois (l'utilisateur peut rester sur le plateau pour debriefer).
  const [endModalDismissed, setEndModalDismissed] = useState(false)
  useEffect(() => {
    if (!finished) setEndModalDismissed(false)
  }, [finished, gameId])

  if (authLoading || !user || loading || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  const hostUserId = game.created_by
  const scaleLabel =
    game.current_scale === 'tactical'
      ? 'Échelle tactique'
      : game.current_scale === 'operational'
        ? 'Échelle opérationnelle'
        : 'Échelle stratégique'

  const statusLabel =
    game.status === 'lobby'
      ? 'En attente'
      : game.status === 'briefing'
        ? 'Briefing'
        : game.status === 'in_progress'
          ? 'Bataille en cours'
          : game.status === 'finished'
            ? 'Bataille achevée'
            : game.status

  const subtitleLabel = showBattle ? 'Bataille' : 'Brief'

  return (
    <div className="h-screen relative font-sans flex flex-col overflow-hidden">
      <PageBackground />

      <GameTopBar
        subtitleLabel={subtitleLabel}
        username={(user.user_metadata?.username as string | undefined) ?? user.email ?? 'soldat'}
        onBack={() => navigate('/lobby')}
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-10 py-5 border-b border-[rgba(226,232,240,0.10)] shrink-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber mb-[4px]">
              Ordre de bataille — {statusLabel}
            </div>
            <h1 className="font-serif italic text-[28px] font-medium m-0 leading-[1.1] text-foreground">
              {game.name}
            </h1>
            <div className="text-muted-foreground text-[10px] uppercase tracking-[0.08em] flex flex-wrap gap-x-[12px] gap-y-1 mt-1">
              <span>{game.scenario_id ?? '—'}</span>
              <span className="opacity-40">/</span>
              <span>{scaleLabel}</span>
              <span className="opacity-40">/</span>
              <span>Hôte : {players.find(p => p.user_id === hostUserId)?.username ?? '...'}</span>
              <span className="opacity-40">/</span>
              <span>Tour {tactical?.currentTurn ?? game.turn_number}</span>
            </div>
          </div>

          <div
            className="flex-1 relative min-h-0"
            onMouseMove={showBattle ? handleSceneMouseMove : undefined}
          >
            <TacticalScene
              scale={game.current_scale}
              cubes={MVP_CUBES}
              units={renderUnits}
              viewerTeam={showBattle ? myTeam : null}
              tileStates={showBattle ? tileStates : undefined}
              selectedUnitId={selectedUnitId}
              targetableUnitIds={showBattle ? targetableUnitIds : undefined}
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
            />
            <CombatResultPanel
              notifications={combatNotifs}
              onActiveChange={setActiveCombatNotif}
              onRemove={removeCombatNotif}
              onClear={clearCombatNotifs}
              onFocusUnit={handleFocusUnit}
            />
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
                onEnterSplitMode={ratio => setSplitMode(ratio)}
                onExitSplitMode={() => setSplitMode(null)}
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

          <div className="relative p-4 border-t border-[rgba(226,232,240,0.18)] bg-[rgba(15,23,42,0.85)]">
            <div aria-hidden className="absolute top-[-1px] left-3 right-3 h-px opacity-40" style={{ background: 'linear-gradient(90deg, transparent, #EF9F27, transparent)' }} />
            <Bracket position="tl" /><Bracket position="tr" /><Bracket position="bl" /><Bracket position="br" />

            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
                <strong className="text-foreground font-semibold">{players.length} / {game.max_players} officiers</strong>
                {' · '}
                {players.length < game.max_players ? 'en attente' : 'effectif complet'}
              </div>
              <span className="flex items-center gap-[6px] text-[10px] uppercase tracking-[0.12em]" title={online ? 'Connecté au serveur' : 'Hors ligne — Realtime indisponible'}>
                <span aria-hidden className={cn('w-[7px] h-[7px] rounded-full shrink-0', online ? 'bg-emerald-400' : 'bg-red-500 animate-pulse')} />
                <span className={online ? 'text-muted-foreground' : 'text-red-400'}>{online ? 'En ligne' : 'Hors ligne'}</span>
              </span>
            </div>
          </div>
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

