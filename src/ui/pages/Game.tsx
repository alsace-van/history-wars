// v3.29 (14/05/2026) — Phase 3.3 Lot A : useOrderTriggeredToasts câblé (toast owner)
// v3.28 (13/05/2026) — QW2 session 22 : extraction useEngagementTickFloaters + useCombatHighlight + useCameraFocus (< 600 lignes)
// v3.27 (13/05/2026) — Phase 3.2-bis : tick floaters + toast "Combat continu (T+N)" pour engagement persistant
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useDeferredUnitDisplay } from '@hooks/useDeferredUnitDisplay'
import { useDeferredEngagements } from '@hooks/useDeferredEngagements'
import { useTerrainTiles } from '@hooks/useTerrainTiles'
import { useHexTemplates } from '@hooks/useHexTemplates'
import { useHexAssets } from '@hooks/useHexAssets'
import { usePaintMode } from '@hooks/usePaintMode'
import { PaintModePanel } from '@ui/editor/PaintModePanel'
import { useCombatAnimator, type DamageFloaterEntry } from '@hooks/useCombatAnimator'
import { useSettings } from '@hooks/useSettings'
import { useUnitCriticalActions } from '@hooks/useUnitCriticalActions'
import { useBattleClickHandlers } from '@hooks/useBattleClickHandlers'
import { useEngagement } from '@hooks/useEngagement'
import { useChargePreview } from '@hooks/useChargePreview'
import { useUnitSizing } from '@hooks/useUnitSizing'
import { useGameLifecycle } from '@hooks/useGameLifecycle'
import { useCombatToastFeed } from '@hooks/useCombatToastFeed'
import { useEnemyHoverTooltip } from '@hooks/useEnemyHoverTooltip'
import { useUnitPathAnimation } from '@hooks/useUnitPathAnimation'
import { useEngagementDerivations } from '@hooks/useEngagementDerivations'
import { useVisionMap } from '@hooks/useVisionMap'
import { usePreOrders } from '@hooks/usePreOrders'
import { useEngagementTickFloaters } from '@hooks/useEngagementTickFloaters'
import { useCombatHighlight } from '@hooks/useCombatHighlight'
import { useCameraFocus } from '@hooks/useCameraFocus'
import { useOrderTriggeredToasts } from '@hooks/useOrderTriggeredToasts'
import { useActiveOrdersByUnit } from '@hooks/useActiveOrdersByUnit'
import { useBotAutoTurn } from '@hooks/useBotAutoTurn'
import { supabase } from '@lib/supabase'
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
import { TacticalScene, buildMvpUnitPlacement } from '@/render'
import { unitRowsToInstances, unitRowsToStates } from '@render/_data/unitAdapter'
import type { HexTileState } from '@render/types'
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
    // Phase 4 — autoriser l'accès en mode spectateur pour les parties in_progress.
    // Les autres status (lobby, briefing, finished, abandoned) exigent d'être membre.
    if (
      game &&
      !isHost(game, user.id) &&
      !isPlayerInGame(players, user.id) &&
      game.status !== 'in_progress'
    ) {
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

  const { units: dbUnits, loading: unitsLoading, refresh: refreshUnits } = useBattleUnits(gameId, showBattle)

  // Phase 4-bis Lot 1 (fog server-side RLS) : refresh complet des units à chaque
  // changement de tour. Sans ça, les units ennemies qui SORTENT du fog (UPDATE
  // filtré par RLS) restent affichées en fantôme à leur dernière position connue.
  useEffect(() => {
    if (!showBattle || !game?.turn_number) return
    void refreshUnits()
  }, [game?.turn_number, showBattle, refreshUnits])

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

  // Phase 4 : un slot est "occupé" si user humain présent OU bot inséré (is_bot=true, user_id=null).
  const occupiedPlayers = useMemo(() => players.filter(p => p.user_id !== null || p.is_bot), [players])
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
  // Phase 3.3 Lot C — mode "pick hex" pour pré-ordre retreat (cliqué dans OrdersPanel).
  // Le callback est stocké en ref pour être invoqué à la sélection sans capture stale.
  const [orderRetreatPickMode, setOrderRetreatPickMode] = useState(false)
  const orderRetreatPickCallbackRef = useRef<((hex: Cube) => void) | null>(null)

  // Phase 2.6 C — engagements actifs (table engagements migration 017 + Realtime).
  const { engagements: engagementRows, engagedUnitIds, engagementsByUnit } = useEngagement(gameId, showBattle)

  // Phase 5 Lot 1 — terrain_tiles (fetch + Realtime) pour rendu décors 3D.
  const { terrainMap, templateMap } = useTerrainTiles(gameId, showBattle)
  // Phase 5 Lot B.5 : charge la bibliotheque de hex_templates + assets customs pour resoudre
  // les hex avec template_id applique. Hooks actifs quand la bataille est rendue.
  const { templates, byId: templatesById } = useHexTemplates(showBattle)
  const { byId: customAssetsById } = useHexAssets(showBattle)
  // Phase 5 Lot B.6 : paint mode admin (panel + intercept du clic hex).
  const paintMode = usePaintMode(gameId)
  const isAdmin = user?.email === 'alsacevancreation@hotmail.com'

  // Phase 3.3 Lot B — map { unit_id → action_kind du priority=1 actif } pour l'icône
  // d'ordre conditionnel sur le pion 3D. RLS filtre côté serveur (mes pions seulement).
  const { activeOrders, refresh: refreshActiveOrders } = useActiveOrdersByUnit({
    gameId: gameId ?? null,
    myUserId: user?.id ?? null,
    enabled: showBattle,
  })

  // Phase 3.2-bis — enrichit chaque UnitInstance avec `engaged` pour que UnitPlaceholder
  // affiche l'icône d'état mouvement correcte (orange si engagé = "Rompre" requis).
  // Phase 3.3 Lot B — injecte activeOrder pour l'icône d'ordre conditionnel.
  const renderUnitsEnriched = useMemo(
    () => renderUnits.map(u => ({
      ...u,
      engaged: engagedUnitIds.has(u.id),
      activeOrder: activeOrders.get(u.id),
    })),
    [renderUnits, engagedUnitIds, activeOrders],
  )

  // Phase 3.1-C : fog client (vision range + LoS). Doit être appelé AVANT useTacticalSelection
  // car ses outputs alimentent visibleTileKeys + enemyVisibility (filtre reachable/targetable).
  const { visibleTileMap, enemyVisibility, visibleEnemyIds, visibleTileKeys } = useVisionMap({
    myTeam: showBattle ? myTeam : null,
    unitStates,
    boardKeys: mvpBoardKeys,
    activeTeam,
    engagementRows,
  })

  const {
    selectedUnitId,
    selectedUnit,
    reachableMap,
    targetableUnitIds,
    attackTargets,
    tileStates,
    exhaustedUnitIds,
    splitTargetKeys,
    cohesionStateMap,
    supportMap,
    retreatTargetKeys,
    suicideTargetIds,
    orderRetreatPickKeys,
    inspectedEnemy,
    handleUnitClick: hookHandleUnitClick,
    clearSelection,
  } = useTacticalSelection({
    inProgress, isMyTurn, myTeam, activeTeam, unitStates,
    boardKeys: mvpBoardKeys,
    splitMode: splitMode !== null,
    retreatMode,
    suicideMode,
    orderRetreatPickMode,
    engagedUnitIds,
    visibleTileKeys: inProgress && myTeam ? visibleTileKeys : undefined,
    enemyVisibility: inProgress && myTeam ? enemyVisibility : undefined,
  })

  // v1.2 — useUnitPathAnimation déclaré tôt pour exposer setUnitPaths à
  // useChargePreview (anim pré-move charge).
  const { unitPaths, setUnitPaths, onUnitPathDone } = useUnitPathAnimation()

  // Phase 2.6 UX pré-commit cav — preview avant la charge atomique.
  const chargePreview = useChargePreview({
    gameId: gameId ?? null,
    selectedUnit,
    unitStates,
    boardKeys: mvpBoardKeys,
    submitAction,
    setUnitPaths,
    onActionCompleted: () => {
      clearSelection()
      // fix retreat cav : refresh la table `units` (position retreat), pas
      // seulement `games`. Sinon le pion attend l'event Realtime (souvent
      // dédupliqué par Supabase entre 3 UPDATEs successifs) et ne bouge
      // qu'au prochain refreshUnits forcé par le changement de tour.
      void refreshUnits()
      void refresh()
    },
  })

  // Override tileStates si preview active : seules les cases de repli sont visibles.
  const finalTileStates = useMemo(() => {
    if (!chargePreview.preview) return tileStates
    const map = new Map<string, HexTileState>()
    for (const k of chargePreview.preview.retreatKeys) {
      map.set(k, 'retreat-target')
    }
    return map
  }, [chargePreview.preview, tileStates])

  // Phase 2.6 refonte — injecte attackHint dans chaque UnitInstance ennemie en
  // fonction du résultat findAttackPosition. UnitPlaceholder s'en sert pour
  // rendre un anneau coloré au-dessus du pion (charge = orange, march = ambre,
  // march-fire = violet, melee = rouge sombre).
  const renderUnitsWithAttackHint = useMemo(() => {
    if (attackTargets.size === 0) return renderUnitsEnriched
    return renderUnitsEnriched.map(u => {
      const target = attackTargets.get(u.id)
      if (!target) return u
      return { ...u, attackHint: target.hint }
    })
  }, [renderUnitsEnriched, attackTargets])

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

  // Phase 3.2-bis — auto-activation du mode "Retraite" si l'unité est en déroute
  // (= effectif < 20% effectiveMax désormais, cf. computeRouted). Cohérent avec la
  // règle serveur : handleRetreat exige cohesionState='broken' qui se déclenche
  // sous effectiveMin — qu'on ait aligné via ROUT_EFFECTIVE_RATIO=20% des effectifs.
  useEffect(() => {
    if (!isMyTurn || !selectedUnit) return
    if (!selectedUnit.routed) return
    if (selectedUnit.hasMoved) return
    if (engagedUnitIds.has(selectedUnit.id)) return
    if (!critical.canRetreat) return
    setRetreatMode(prev => (prev ? prev : true))
  }, [isMyTurn, selectedUnit, engagedUnitIds, critical.canRetreat])

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
    currentTurn: tactical?.currentTurn ?? game?.turn_number,
  })

  const inspectedEnemyCohesion = inspectedEnemy ? cohesionStateMap.get(inspectedEnemy.id) : undefined

  // ---- Notifications combat en onglets (cf piège #52) ----
  const { notifications: combatNotifs, removeNotification: removeCombatNotif, clear: clearCombatNotifs, pendingDefenderIds, pendingAttackerIds } =
    useCombatNotifications({
      gameId: gameId ?? null,
      viewerTeam: showBattle ? myTeam : null,
      enabled: showBattle,
      playerTeams,
      units: unitStates,
      // v2.6 — diffère l'affichage des points/journal jusqu'à la fin de l'anim attaquant.
      unitPaths,
    })

  // v2.6 — Union attaquants + défenseurs gelés pour le rendu :
  //  - Défenseur : freeze shrink/disparition (peut perdre des hommes ou être tué)
  //  - Attaquant : freeze shrink (peut perdre des hommes en riposte) + engagements
  const pendingCombatUnitIds = useMemo(() => {
    const s = new Set<string>(pendingDefenderIds)
    for (const id of pendingAttackerIds) s.add(id)
    return s
  }, [pendingDefenderIds, pendingAttackerIds])

  // v2.6 — freeze visuel des unités en combat pending : shrink + disparition.
  const renderUnitsForScene = useDeferredUnitDisplay(renderUnitsWithAttackHint, pendingCombatUnitIds)

  // v2.6 — filtre les engagements impliquant une unité en combat pending : pas
  // d'affichage de la ligne d'engagement ni du badge "T+N" avant fin d'anim.
  const deferredEngagementRows = useDeferredEngagements(engagementRows, pendingCombatUnitIds)
  // Ids des engagements à afficher actuellement (pour filtrer enginePairs côté rendu).
  const deferredEngagementIds = useMemo(() => {
    const s = new Set<string>()
    for (const e of deferredEngagementRows) s.add(e.id)
    return s
  }, [deferredEngagementRows])


  // Phase 3.3 Lot A — toast "Ordre déclenché" côté owner (privacy filter via actor_user_id).
  useOrderTriggeredToasts({
    gameId: gameId ?? null,
    viewerUserId: user?.id ?? null,
    units: unitStates,
    enabled: showBattle,
  })

  const { settings: uiSettings, setSkipShakenWarning, animationDurationMs } = useSettings()
  const { floaters: damageFloaters, removeFloater: removeCombatFloater } = useCombatAnimator({ notifications: combatNotifs, unitStates, animationDurationMs, enabled: showBattle })

  // Phase 3.2-bis : queue dédiée des DamageFloaters issus des ticks d'engagement persistant
  // (Découplée de useCombatAnimator qui traite les CombatNotification Realtime — voir hook).
  const { tickFloaters, removeTickFloater, handleEndTurnSuccess } = useEngagementTickFloaters({
    myTeam, unitStates, animationDurationMs,
  })
  const removeFloater = useCallback((id: string) => {
    if (id.startsWith('tick-')) removeTickFloater(id)
    else removeCombatFloater(id)
  }, [removeCombatFloater, removeTickFloater])
  const allFloaters = useMemo<ReadonlyArray<DamageFloaterEntry>>(
    () => (tickFloaters.length === 0 ? damageFloaters : [...damageFloaters, ...tickFloaters]),
    [damageFloaters, tickFloaters],
  )

  // Highlight scénique pour le rapport de combat actif (filtré par fog of war).
  const { setActiveCombatNotif, highlightedUnitIds } = useCombatHighlight(visibleEnemyIds)

  // Phase 1.5 : focus caméra sur une unité (boutons "Centrer" report panel / sidebar).
  const { cameraFocusCube, handleFocusUnit } = useCameraFocus(unitStates)

  const {
    hoveredEnemy, mousePos, setHoveredEnemyId,
    handleSceneMouseMove, handleUnitPointerOver, handleUnitPointerOut,
  } = useEnemyHoverTooltip({ unitStates, targetableUnitIds })

  // Ref toujours à jour de la position souris (consommée par useBattleClickHandlers
  // pour positionner ChargeChoicePopup au pointeur sans subir le retard de re-render).
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  mousePosRef.current = mousePos

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
    orderRetreatPickMode,
    orderRetreatPickKeys,
    commitOrderRetreatPick: (hex: Cube) => {
      const cb = orderRetreatPickCallbackRef.current
      orderRetreatPickCallbackRef.current = null
      setOrderRetreatPickMode(false)
      if (cb) cb(hex)
    },
    cancelOrderRetreatPick: () => {
      orderRetreatPickCallbackRef.current = null
      setOrderRetreatPickMode(false)
    },
    // Phase 2.6 refonte — attackTargets (auto-move + attack atomique).
    attackTargets,
    // Phase 2.6 refonte — post-charge cav : repli implicite (cases bleues +
    // click cav = stay + click ailleurs = stay).
    // Phase 2.6 UX pré-commit cav — preview avant charge atomique.
    chargePreviewTargetId: chargePreview.preview?.targetId ?? null,
    chargePreviewRetreatKeys: chargePreview.preview?.retreatKeys,
    openChargePreview: chargePreview.openPreview,
    commitChargeStay: chargePreview.commitStay,
    commitChargeRetreat: chargePreview.commitRetreat,
    cancelChargePreview: chargePreview.cancel,
  })

  const { handleLeave, handleKick, handleStartBattle, handleEndTurn, handleBreakCombat } = useGameLifecycle({
    gameId: gameId ?? null, iAmHost, busy, setBusy,
    deleteGame, leaveGame, kickPlayer,
    canStart, inProgress, isMyTurn, actionsBusy,
    startBattle, endTurn, submitAction, refresh, clearSelection,
    selectedUnit, engagedUnitIds, navigate,
    onEndTurnSuccess: handleEndTurnSuccess,
  })

  // Phase 2.6 — bloque end_turn tant qu'une décision post-charge cav est en attente.
  // La cavalerie reste figée (champ pending_post_charge_target_id non-null en BDD),
  // donc autoriser end_turn laisserait un état serveur incohérent au prochain tour.
  const handleEndTurnGuarded = useCallback(async () => {
    if (chargePreview.blockEndTurn) {
      toast.error('Décision charge en attente : clique l\'ennemi (rester) ou une case bleue (replier).')
      return
    }
    await handleEndTurn()
  }, [chargePreview.blockEndTurn, handleEndTurn])

  // Modal de fin : ouverte automatiquement sur status='finished',
  // refermable une fois (l'utilisateur peut rester sur le plateau pour debriefer).
  const [endModalDismissed, setEndModalDismissed] = useState(false)
  useEffect(() => {
    if (!finished) setEndModalDismissed(false)
  }, [finished, gameId])

  // v3.23 — Journal des combats : extrait dans useCombatToastFeed (QW1).
  const { combatPanelOpen, setCombatPanelOpen, toggleCombatPanel } = useCombatToastFeed({ combatNotifs })

  // Phase 3.2 C — ordres conditionnels (pré-postures) de l'unité sélectionnée.
  // Hook en queue (cf. règle CLAUDE.md). Désactivé hors bataille pour ne pas fetcher inutile.
  const preOrders = usePreOrders({
    gameId,
    unitId: selectedUnit && selectedUnit.team === myTeam ? selectedUnit.id : null,
    enabled: showBattle,
  })

  // Phase 3.3 Lot B — refetch immédiat de la map globale `activeOrders` dès que les
  // ordres de l'unité sélectionnée changent (create/update/delete). Sans ça, l'icône
  // sur le pion n'apparaît qu'après le prochain end_turn (qui émet `order_triggered`).
  useEffect(() => {
    void refreshActiveOrders()
  }, [preOrders.orders, refreshActiveOrders])

  // Phase 4 Lot A5 — auto-trigger run_bot_turn quand activeTeam = bot. Host only.
  // À la fin du tour bot, on auto-bascule via endTurn (resolve_turn v1.6 autorise
  // un humain à end_turn quand activeTeam contient un bot). Délai 1.2s pour que
  // l'utilisateur visualise les déplacements du bot avant la bascule.
  useBotAutoTurn({
    gameId: gameId ?? null,
    activeTeam: showBattle ? activeTeam : null,
    players: players.map(p => ({ team: p.team, is_bot: p.is_bot })),
    iAmHost,
    currentTurn: tactical?.currentTurn ?? game?.turn_number ?? 0,
    enabled: showBattle,
    onBotTurnComplete: () => {
      if (!gameId) return
      void refresh()
      window.setTimeout(() => {
        void endTurn(gameId).catch((e: unknown) => {
          console.error('[Game] auto endTurn after bot failed', e)
        })
      }, 1200)
    },
  })

  // Phase 4 — handler ajout bot (host uniquement, slot vacant). Insère game_players
  // is_bot=true avec difficulté choisie. RLS migration 022 autorise.
  const handleAddBot = useCallback(async (team: Team, difficulty: 'easy' | 'medium' | 'hard') => {
    if (!gameId) return
    const teamSlots = team === 'blue' ? blueSlots : redSlots
    const emptySlot = teamSlots.find(s => s.player === null)
    if (!emptySlot) {
      toast.error('Aucun slot vacant pour ajouter un bot')
      return
    }
    const { error } = await supabase.from('game_players').insert({
      game_id: gameId,
      user_id: null,
      team,
      slot_index: emptySlot.index,
      role: emptySlot.role,
      is_bot: true,
      bot_difficulty: difficulty,
    })
    if (error) {
      toast.error(`Bot impossible : ${error.message}`)
      return
    }
    toast.success(`🤖 Bot ${difficulty} ajouté au camp ${team === 'blue' ? 'bleu' : 'rouge'}`)
  }, [gameId, blueSlots, redSlots])

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
        myTeam={showBattle ? myTeam : null}
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
              units={renderUnitsForScene as typeof renderUnitsWithAttackHint}
              viewerTeam={showBattle ? myTeam : null}
              tileStates={showBattle ? finalTileStates : undefined}
              selectedUnitId={selectedUnitId}
              targetableUnitIds={showBattle ? targetableUnitIds : undefined}
              mergeTargetUnitIds={showBattle ? mergeTargetUnitIds : undefined}
              exhaustedUnitIds={showBattle ? exhaustedUnitIds : undefined}
              highlightedUnitIds={showBattle ? highlightedUnitIds : undefined}
              cameraFocusCube={cameraFocusCube}
              unitPaths={showBattle ? unitPaths : undefined}
              onUnitPathDone={onUnitPathDone}
              onTileClick={
                showBattle
                  ? (cube: Cube) => {
                      // Phase 5 Lot B.6 : si paint mode actif, le clic peint l'hex au lieu de
                      // declencher la logique gameplay (selection unite, mouvement, etc.).
                      if (paintMode.active) {
                        void paintMode.apply(cube)
                        return
                      }
                      handleTileClick(cube)
                    }
                  : undefined
              }
              onUnitClick={showBattle ? handleUnitClick : undefined}
              onUnitPointerOver={showBattle ? handleUnitPointerOver : undefined}
              onUnitPointerOut={showBattle ? handleUnitPointerOut : undefined}
              damageFloaters={showBattle ? allFloaters : undefined}
              damageFloaterDurationMs={animationDurationMs}
              onDamageFloaterDone={removeFloater}
              cohesionStateMap={showBattle ? cohesionStateMap : undefined}
              supportMap={showBattle ? supportMap : undefined}
              engagements={showBattle ? enginePairs.filter(p => deferredEngagementIds.has(p.id)) : undefined}
              tileVisibility={
                // Phase 5 Lot B.6 : admin en paint mode bypass le fog (tous hex cliquables).
                inProgress && myTeam && !(isAdmin && paintMode.active)
                  ? visibleTileMap
                  : undefined
              }
              enemyVisibility={inProgress && myTeam ? enemyVisibility : undefined}
              terrainMap={showBattle ? terrainMap : undefined}
              templateMap={showBattle ? templateMap : undefined}
              templatesById={showBattle ? templatesById : undefined}
              customAssetsById={showBattle ? customAssetsById : undefined}
            />
            {/* Phase 5 Lot B.6 : panneau paint mode admin (flottant en bas-gauche). */}
            {showBattle && isAdmin && (
              <PaintModePanel templates={templates} paintMode={paintMode} />
            )}
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
              onEndTurn={handleEndTurnGuarded}
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
                orders={preOrders.orders}
                ordersBusy={preOrders.busy}
                ordersError={preOrders.error}
                onCreateOrder={preOrders.createOrder}
                onUpdateOrder={preOrders.updateOrder}
                onDeleteOrder={preOrders.deleteOrder}
                onReorderOrder={preOrders.reorderOrder}
                onRequestPickRetreatHex={(onPicked) => {
                  // Lot C — exclusivité avec retreat/suicide/split.
                  setRetreatMode(false)
                  setSuicideMode(false)
                  setSplitMode(null)
                  orderRetreatPickCallbackRef.current = onPicked
                  setOrderRetreatPickMode(true)
                }}
                blueSlots={blueSlots}
                redSlots={redSlots}
                hostUserId={hostUserId}
                currentUserId={user.id}
                onFocusUnit={handleFocusUnit}
                engagedUnitIds={engagedUnitIds}
              />
            ) : (
              <>
                <TeamPanel team="blue" slots={blueSlots} hostUserId={hostUserId} currentUserId={user.id} canKick={iAmHost} onKick={handleKick} compact onAddBot={iAmHost ? handleAddBot : undefined} />
                <TeamPanel team="red" slots={redSlots} hostUserId={hostUserId} currentUserId={user.id} canKick={iAmHost} onKick={handleKick} compact onAddBot={iAmHost ? handleAddBot : undefined} />
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

