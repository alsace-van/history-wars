// v3.4 (10/05/2026) — P1-REFACTOR-01 : extraction BattleSidebar vers src/ui/game/BattleSidebar.tsx
// v3.3 (10/05/2026) — Fix ring sélection (option A) : retire state 'selected' du tileStates
// v3.2 (09/05/2026) — Animation case par case : aStar avant submit + unitPaths state
// v3.1 (09/05/2026) — L1C.3 : selection unite + reachable BFS + click move + UnitInspector
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useRequireAuth } from '@hooks/useRequireAuth'
import { useGame } from '@hooks/useGame'
import { useRealtime } from '@hooks/useRealtime'
import { useOnlineStatus } from '@hooks/useOnlineStatus'
import { useBattleUnits } from '@hooks/useBattleUnits'
import { useCombatActions } from '@hooks/useCombatActions'
import {
  isHost,
  isPlayerInGame,
  deriveSlotAssignment,
  type Team,
} from '@/types/game'
import { PageBackground } from '@ui/layout/PageBackground'
import { TeamPanel, type SlotData } from '@ui/game/TeamPanel'
import { BattleSidebar } from '@ui/game/BattleSidebar'
import { TacticalScene, buildMvpUnitPlacement } from '@/render'
import { unitRowsToInstances, unitRowsToStates } from '@render/_data/unitAdapter'
import type { HexTileState } from '@render/types'
import { spiral, cubeKey, type Cube } from '@engine/hex'
import { getUnitStats, type UnitState } from '@engine/units'
import { bfsReachable, aStar } from '@engine/movement'
import { computeEnemyZoc } from '@engine/zoc'
import { cn } from '@lib/cn'

const TAG = '[Game v3.4]'

const PRIMARY_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

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

  useRealtime({
    channelName: gameId ? `game:${gameId}` : '',
    enabled: !!gameId && !!user,
    postgresChanges: gameId
      ? [
          { table: 'games', event: 'UPDATE', filter: `id=eq.${gameId}`, onChange: () => void refresh() },
          {
            table: 'games',
            event: 'DELETE',
            filter: `id=eq.${gameId}`,
            onChange: () => {
              toast.error("L'hôte a dissous la partie.")
              navigate('/lobby')
            },
          },
          { table: 'game_players', event: '*', filter: `game_id=eq.${gameId}`, onChange: () => void refresh() },
        ]
      : undefined,
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

  const { busy: actionsBusy, startBattle, submitAction } = useCombatActions()

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

  // ---- Selection + reachable ----
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!inProgress) {
      setSelectedUnitId(null)
      return
    }
    if (selectedUnitId && !unitStates.some(u => u.id === selectedUnitId)) {
      setSelectedUnitId(null)
    }
  }, [inProgress, activeTeam, unitStates, selectedUnitId])

  const selectedUnit = useMemo<UnitState | null>(
    () => unitStates.find(u => u.id === selectedUnitId) ?? null,
    [unitStates, selectedUnitId]
  )

  const isSelectedMine = !!selectedUnit && selectedUnit.team === myTeam

  const reachableMap = useMemo<Map<string, number>>(() => {
    if (!selectedUnit || !isSelectedMine || !isMyTurn) return new Map()
    if (selectedUnit.hasMoved || selectedUnit.routed) return new Map()
    const stats = getUnitStats(selectedUnit.kind)
    const others = unitStates.filter(u => u.id !== selectedUnit.id)
    const blockers = new Set(others.map(u => cubeKey(u.position)))
    const enemyZoc = computeEnemyZoc(unitStates, selectedUnit.team)
    const raw = bfsReachable({
      start: selectedUnit.position,
      movementPoints: stats.movement,
      blockers,
      enemyZocCubes: enemyZoc,
    })
    const startKey = cubeKey(selectedUnit.position)
    const out = new Map<string, number>()
    for (const [k, c] of raw) {
      if (k === startKey) continue
      if (!MVP_BOARD_KEYS.has(k)) continue
      out.set(k, c)
    }
    return out
  }, [selectedUnit, isSelectedMine, isMyTurn, unitStates])

  const tileStates = useMemo<Map<string, HexTileState>>(() => {
    // Fix ring v3.3 : on ne marque PAS la tile sous l'unite selectionnee en 'selected'.
    // L'anneau autour du soldat suffit visuellement (cf piege #47).
    const map = new Map<string, HexTileState>()
    for (const k of reachableMap.keys()) map.set(k, 'reachable')
    return map
  }, [reachableMap])

  const exhaustedUnitIds = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    for (const u of unitStates) {
      if (u.hasMoved && u.hasAttacked) set.add(u.id)
      if (u.routed) set.add(u.id)
    }
    return set
  }, [unitStates])

  // ---- Handlers ----
  const handleUnitClick = useCallback(
    (unit: { id: string; team: Team }) => {
      if (!inProgress) return
      if (selectedUnitId === unit.id) {
        setSelectedUnitId(null)
        return
      }
      if (unit.team !== myTeam) return
      setSelectedUnitId(unit.id)
    },
    [inProgress, selectedUnitId, myTeam]
  )

  const handleTileClick = useCallback(
    async (cube: Cube) => {
      if (!gameId || !inProgress) return
      if (!selectedUnit) return
      const key = cubeKey(cube)
      if (!reachableMap.has(key)) {
        setSelectedUnitId(null)
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
    [gameId, inProgress, selectedUnit, reachableMap, actionsBusy, submitAction, unitStates]
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

      <header className="relative flex items-center justify-between px-10 py-[18px] border-b border-[rgba(226,232,240,0.18)] bg-gradient-to-b from-[rgba(8,12,24,0.85)] to-transparent shrink-0">
        <div className="flex items-center gap-[18px]">
          <button
            onClick={() => navigate('/lobby')}
            className="bg-transparent border-none text-muted-foreground hover:text-tactica-amber px-2 py-[6px] text-[12px] uppercase tracking-[0.12em] cursor-pointer transition-colors"
          >
            ← Salle de commandement
          </button>
          <div className="text-[20px] font-bold tracking-[0.32em] text-foreground">
            TACTICA
            <span className="ml-3 align-middle font-serif italic font-normal text-[18px] tracking-[0.04em] text-tactica-amber">
              — {subtitleLabel}
            </span>
          </div>
        </div>
        <span className="text-[12px] text-muted-foreground tracking-[0.05em]">
          Officier{' '}
          <strong className="text-foreground font-semibold">
            {(user.user_metadata?.username as string | undefined) ?? user.email ?? 'soldat'}
          </strong>
        </span>
        <div
          aria-hidden
          className="absolute left-10 right-10 -bottom-px h-px opacity-40"
          style={{ background: 'linear-gradient(90deg, transparent 0%, #EF9F27 25%, #EF9F27 75%, transparent 100%)' }}
        />
      </header>

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

          <div className="flex-1 relative min-h-0">
            <TacticalScene
              scale={game.current_scale}
              cubes={MVP_CUBES}
              units={renderUnits}
              tileStates={showBattle ? tileStates : undefined}
              selectedUnitId={selectedUnitId}
              exhaustedUnitIds={showBattle ? exhaustedUnitIds : undefined}
              unitPaths={showBattle ? unitPaths : undefined}
              onUnitPathDone={onUnitPathDone}
              onTileClick={showBattle ? handleTileClick : undefined}
              onUnitClick={showBattle ? handleUnitClick : undefined}
            />
            <div className="absolute bottom-3 left-3 px-3 py-2 bg-[rgba(15,23,42,0.85)] backdrop-blur-[6px] border border-[rgba(226,232,240,0.18)] rounded-[2px] text-[10px] text-muted-foreground tracking-[0.05em] uppercase pointer-events-none">
              <div>Drag : rotation · Drag droit : pan · Molette : zoom</div>
            </div>
            {showBattle && unitsLoading && (
              <div className="absolute top-3 right-3 px-3 py-2 bg-[rgba(15,23,42,0.85)] backdrop-blur-[6px] border border-[rgba(226,232,240,0.18)] rounded-[2px] text-[10px] text-muted-foreground tracking-[0.05em] uppercase pointer-events-none">
                Chargement des unités…
              </div>
            )}
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

            <div className="flex items-center justify-between mb-3">
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

            <div className="flex flex-col gap-2">
              {!showBattle && (
                <span className="relative group">
                  <button
                    disabled={!canStart || actionsBusy}
                    onClick={handleStartBattle}
                    className={cn(
                      'w-full px-4 py-[10px] text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors',
                      canStart && !actionsBusy
                        ? 'bg-tactica-amber text-[#0f172a] hover:bg-tactica-amber/90 cursor-pointer'
                        : 'bg-tactica-amber/20 text-tactica-amber/40 cursor-not-allowed'
                    )}
                    style={{ clipPath: PRIMARY_BTN_CLIP }}
                  >
                    {actionsBusy ? 'Lancement…' : 'Engager la bataille'}
                  </button>
                  {startTooltip && (
                    <span className="absolute bottom-full right-0 mb-[6px] whitespace-nowrap text-[10px] uppercase tracking-[0.12em] bg-[rgba(8,12,24,0.95)] border border-tactica-amber px-[10px] py-[6px] rounded-[2px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {startTooltip}
                    </span>
                  )}
                </span>
              )}

              <button
                onClick={handleLeave}
                disabled={busy || !iAmIn}
                className="bg-transparent border border-destructive/50 text-destructive hover:bg-destructive hover:text-white disabled:opacity-50 disabled:cursor-not-allowed px-3 py-[7px] text-[11px] font-semibold uppercase tracking-[0.12em] rounded-[2px] transition-colors"
              >
                {iAmHost ? 'Dissoudre la partie' : 'Quitter la bataille'}
              </button>
            </div>
          </div>
        </aside>
      </div>
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
