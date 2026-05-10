// v3.14 (10/05/2026) — câble useGameRealtime à la place du useRealtime inline (DRY + lignes < 600)
// v3.13 (10/05/2026) — Phase 1.5 : highlight ennemi rapport combat filtré par visibleEnemyIds (fog of war)
// v3.12 (10/05/2026) — Phase 1.5 : bouton "Centrer la vue" dans CombatResultPanel (cameraFocusCube)
// v3.11 (10/05/2026) — Phase 1.5 : CombatResultPanel onglets + highlightedUnitIds plateau (rapport actif)
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
import { EndGameModal } from '@ui/game/EndGameModal'
import { CombatPreviewTooltip } from '@ui/game/CombatPreviewTooltip'
import { CombatResultPanel } from '@ui/game/CombatResultPanel'
import type { CombatNotification } from '@hooks/useCombatNotifications'
import { TacticalScene, buildMvpUnitPlacement } from '@/render'
import { unitRowsToInstances, unitRowsToStates } from '@render/_data/unitAdapter'
import type { UnitInstance } from '@render/types'
import { spiral, cubeKey, type Cube } from '@engine/hex'
import { getUnitStats, type UnitState } from '@engine/units'
import { aStar } from '@engine/movement'
import { computeEnemyZoc } from '@engine/zoc'
import { cn } from '@lib/cn'

const TAG = '[Game v3.14]'

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

  // ---- Selection + reachable + tileStates + targetable + visibleEnemyIds (extrait via hook) ----
  const {
    selectedUnitId,
    selectedUnit,
    reachableMap,
    targetableUnitIds,
    visibleEnemyIds,
    tileStates,
    exhaustedUnitIds,
    handleUnitClick: hookHandleUnitClick,
    clearSelection,
  } = useTacticalSelection({
    inProgress,
    isMyTurn,
    myTeam,
    activeTeam,
    unitStates,
    boardKeys: MVP_BOARD_KEYS,
  })

  // ---- Notifications combat en onglets (cf piège #52) ----
  const { notifications: combatNotifs, removeNotification: removeCombatNotif, clear: clearCombatNotifs } =
    useCombatNotifications({
      gameId: gameId ?? null,
      viewerTeam: showBattle ? myTeam : null,
      enabled: showBattle,
      playerTeams,
      units: unitStates,
    })

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

  // ---- Handler unit click (composite : attack si ennemi targetable, sinon toggle) ----
  const handleUnitClick = useCallback(
    async (unit: { id: string; team: Team }) => {
      if (!gameId || !inProgress) return
      // Click ennemi targetable → attack
      if (selectedUnit && unit.team !== myTeam && targetableUnitIds.has(unit.id)) {
        if (actionsBusy) return
        const atkStats = getUnitStats(selectedUnit.kind)
        const isRanged = atkStats.range > 1
        const res = await submitAction(gameId, {
          type: isRanged ? 'attack_ranged' : 'attack_melee',
          payload: { unit_id: selectedUnit.id, target_unit_id: unit.id },
        })
        if (res.ok) {
          clearSelection()
          setHoveredEnemyId(null)
          // Toast detaille gere par useCombatNotifications (Realtime INSERT game_actions)
        }
        return
      }
      // Sinon delegue au hook (toggle selection mes unites)
      hookHandleUnitClick(unit)
    },
    [
      gameId,
      inProgress,
      selectedUnit,
      myTeam,
      targetableUnitIds,
      actionsBusy,
      submitAction,
      clearSelection,
      hookHandleUnitClick,
    ]
  )

  // ---- Handler tile click (move) — reste ici car couple a submitAction + unitPaths ----
  const handleTileClick = useCallback(
    async (cube: Cube) => {
      if (!gameId || !inProgress) return
      if (!selectedUnit) return
      const key = cubeKey(cube)
      if (!reachableMap.has(key)) {
        clearSelection()
        return
      }
      if (actionsBusy) return

      // Calculer le path A* avant submit pour animation case par case (piege #34)
      const others = unitStates.filter(u => u.id !== selectedUnit.id)
      const blockers = new Set(others.map(u => cubeKey(u.position)))
      const enemyZoc = computeEnemyZoc(unitStates, selectedUnit.team)
      const path = aStar({
        start: selectedUnit.position,
        goal: cube,
        blockers,
        enemyZocCubes: enemyZoc,
      })

      // eslint-disable-next-line no-console
      console.log(TAG, 'submitAction move', { unit: selectedUnit.id, dest: cube, pathLen: path?.length })

      const res = await submitAction(gameId, {
        type: 'move',
        payload: { unit_id: selectedUnit.id, dest_q: cube.q, dest_r: cube.r },
      })

      if (res.ok && path && path.length >= 2) {
        // Stocker le path → UnitPlaceholder anime case par case
        setUnitPaths(prev => {
          const next = new Map(prev)
          next.set(selectedUnit.id, path)
          return next
        })
      }
    },
    [gameId, inProgress, selectedUnit, reachableMap, actionsBusy, submitAction, unitStates, clearSelection]
  )

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
            />
            <CombatResultPanel
              notifications={combatNotifs}
              onActiveChange={setActiveCombatNotif}
              onRemove={removeCombatNotif}
              onClear={clearCombatNotifs}
              onFocusUnit={handleFocusUnit}
            />
            {hoveredEnemy && selectedUnit && (
              <CombatPreviewTooltip
                attacker={selectedUnit}
                defender={hoveredEnemy}
                screenPos={mousePos}
              />
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
        <EndGameModal
          open={finished && !endModalDismissed}
          onClose={() => {
            setEndModalDismissed(true)
            navigate('/lobby')
          }}
          gameId={gameId}
          winner={tactical?.winner ?? null}
          totalTurns={tactical?.currentTurn ?? game.turn_number}
        />
      )}
    </div>
  )
}

function Bracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const cls = {
    tl: 'top-1 left-1 border-r-0 border-b-0',
    tr: 'top-1 right-1 border-l-0 border-b-0',
    bl: 'bottom-1 left-1 border-r-0 border-t-0',
    br: 'bottom-1 right-1 border-l-0 border-t-0',
  }[position]
  return <span aria-hidden className={cn('absolute w-[10px] h-[10px] border border-tactica-amber opacity-50', cls)} />
}
