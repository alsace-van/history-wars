// v1.6 (11/05/2026) — Phase 2.6 C : engagedUnitIds bloque mouvement standard (Rompre obligatoire)
// v1.5 (11/05/2026) — Phase 2.5 C : cohesionStateMap + supportMap exposés + bloque attaque standard si Brisé
// v1.4 (11/05/2026) — Phase 2 hotfix soft-lock : autoriser l'attaque sur ennemi routé (coup de grâce)
// v1.3 (10/05/2026) — Phase 2 2D.6 : param splitMode → tileStates 'split-target' sur hex adjacents libres
import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeCohesion, computeSupport, type CohesionState, type SupportCount } from '@engine/cohesion'
import { cubeKey, cubeDistance, neighbors } from '@engine/hex'
import { bfsReachable } from '@engine/movement'
import { computeEnemyZoc } from '@engine/zoc'
import { hasLineOfSight } from '@engine/los'
import { getUnitStats, type UnitState } from '@engine/units'
import type { HexTileState } from '@render/types'
import type { Team } from '@/types/game'

interface UseTacticalSelectionParams {
  inProgress: boolean
  isMyTurn: boolean
  myTeam: Team | null
  /** team active courant (sert a invalider la selection sur changement de tour) */
  activeTeam: Team
  unitStates: ReadonlyArray<UnitState>
  /** cles cubiques des hex de la carte — limite la propagation BFS */
  boardKeys: ReadonlySet<string>
  /**
   * Phase 2 2D.6 : si true et selectedUnit existe, on remplace reachableMap/tileStates
   * par les 6 voisins libres en state 'split-target' (UX : sélection visuelle de la case
   * cible pour scinder). Le click sur ces tiles déclenche split_unit dans Game.tsx.
   */
  splitMode: boolean
  /**
   * Phase 2.5 C — mode "Retraite" : highlight des 6 voisins libres pour sortir une unité Brisée.
   * Click sur ces tiles déclenche `retreat` dans Game.tsx.
   */
  retreatMode?: boolean
  /**
   * Phase 2.5 C — mode "Combat suicide" : highlight des ennemis adjacents.
   * Click sur ces tiles/unités déclenche `suicide_attack` dans Game.tsx.
   */
  suicideMode?: boolean
  /**
   * Phase 2.6 C — Set des unitId actuellement dans au moins 1 engagement actif.
   * Si l'unité sélectionnée y figure, son mouvement standard est désactivé
   * (reachableMap vide). Elle doit Rompre le combat (-10% effective) avant
   * de se redéplacer. L'attaque mêlée sur son opponent reste possible (riposte).
   */
  engagedUnitIds?: ReadonlySet<string>
}

interface UseTacticalSelectionResult {
  selectedUnitId: string | null
  selectedUnit: UnitState | null
  isSelectedMine: boolean
  /** Map<cubeKey, cout MP> des cases atteignables (vide si pas de selection ou unite ennemie) */
  reachableMap: Map<string, number>
  /** Set des unitId ennemis attaquables par l'unite selectionnee (range + LoS) */
  targetableUnitIds: Set<string>
  /** Set des cubeKey en ZoC ennemie ; entrer y stoppe le mouvement (cf piege #41) */
  dangerousZocKeys: Set<string>
  /** Set des unitId ennemis observes par AU MOINS une de mes unites (LoS, fog of war Phase 1.5). */
  visibleEnemyIds: Set<string>
  /** Map<cubeKey, HexTileState> a passer a TacticalScene */
  tileStates: Map<string, HexTileState>
  /** Set des unites qui ont epuise leurs ordres (visuellement attenuees) */
  exhaustedUnitIds: Set<string>
  /** Phase 2 2D.6 : Set des cubeKey adjacentes libres en mode split (vide sinon). */
  splitTargetKeys: Set<string>
  /** Phase 2.5 — état de cohésion par unité (nominal / shaken / broken). */
  cohesionStateMap: Map<string, CohesionState>
  /** Phase 2.5 — comptage soutien par unité (alliés rayon 1+2). */
  supportMap: Map<string, SupportCount>
  /** Phase 2.5 C — Set des cubeKey adjacentes libres en mode retreat (vide sinon). */
  retreatTargetKeys: Set<string>
  /** Phase 2.5 C — Set des unitId ennemis adjacents en mode suicide (vide sinon). */
  suicideTargetIds: Set<string>
  handleUnitClick: (unit: { id: string; team: Team }) => void
  clearSelection: () => void
}

export function useTacticalSelection(
  params: UseTacticalSelectionParams
): UseTacticalSelectionResult {
  const { inProgress, isMyTurn, myTeam, activeTeam, unitStates, boardKeys, splitMode, retreatMode = false, suicideMode = false, engagedUnitIds } = params

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

  // Reset selection : sortie de in_progress, changement de tour, ou unite disparue
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

  // ZoC ennemie depuis le point de vue de l'unite selectionnee. Memoise + reutilise par
  // reachableMap (BFS stop) et dangerousZocKeys (visuel) — evite double calcul.
  const enemyZoc = useMemo<Set<string>>(() => {
    if (!selectedUnit || !isSelectedMine) return new Set()
    return computeEnemyZoc(unitStates, selectedUnit.team)
  }, [selectedUnit, isSelectedMine, unitStates])

  const reachableMap = useMemo<Map<string, number>>(() => {
    if (!selectedUnit || !isSelectedMine || !isMyTurn) return new Map()
    if (selectedUnit.hasMoved || selectedUnit.routed) return new Map()
    // Phase 2.6 — engagement persistant : une unité engagée doit Rompre le combat
    // (action volontaire, -10% effective) avant de pouvoir bouger en standard.
    if (engagedUnitIds && engagedUnitIds.has(selectedUnit.id)) return new Map()
    const stats = getUnitStats(selectedUnit.kind)
    const others = unitStates.filter(u => u.id !== selectedUnit.id)
    const blockers = new Set(others.map(u => cubeKey(u.position)))
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
      if (!boardKeys.has(k)) continue
      out.set(k, c)
    }
    return out
  }, [selectedUnit, isSelectedMine, isMyTurn, unitStates, enemyZoc, boardKeys, engagedUnitIds])

  // Phase 2.5 — précalcule cohésion + support pour toutes les unités (single pass).
  // Permet : (1) bloquer attaque standard si Brisé, (2) UI panneau critique,
  // (3) anneaux 3D, (4) modale Ébranlé. Recalcul à chaque changement unitStates
  // → cohésion en temps réel (cf décision 8 plan moral-cohésion).
  const cohesionData = useMemo<{
    supportMap: Map<string, SupportCount>
    cohesionStateMap: Map<string, CohesionState>
  }>(() => {
    const supportMap = new Map<string, SupportCount>()
    const cohesionStateMap = new Map<string, CohesionState>()
    for (const u of unitStates) {
      const s = computeSupport(u, unitStates)
      const c = computeCohesion(u, s)
      supportMap.set(u.id, s)
      cohesionStateMap.set(u.id, c.state)
    }
    return { supportMap, cohesionStateMap }
  }, [unitStates])

  const targetableUnitIds = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!selectedUnit || !isSelectedMine || !isMyTurn) return out
    if (selectedUnit.hasAttacked || selectedUnit.routed) return out
    // Phase 2.5 — Brisée ne peut pas attaquer en standard (uniquement actions critiques).
    if (cohesionData.cohesionStateMap.get(selectedUnit.id) === 'broken') return out
    const stats = getUnitStats(selectedUnit.kind)
    const range = stats.range
    for (const enemy of unitStates) {
      if (enemy.team === selectedUnit.team) continue
      // Phase 2.5 — on attaque même les ennemis routed / Brisé (coup de grâce historique).
      const dist = cubeDistance(selectedUnit.position, enemy.position)
      if (dist === 0 || dist > range) continue
      if (range > 1) {
        // LoS : blockers = tous corps sauf le tireur et la cible
        const blockers = new Set<string>()
        for (const u of unitStates) {
          if (u.id === selectedUnit.id) continue
          if (u.id === enemy.id) continue
          blockers.add(cubeKey(u.position))
        }
        if (!hasLineOfSight(selectedUnit.position, enemy.position, blockers)) continue
      }
      out.add(enemy.id)
    }
    return out
  }, [selectedUnit, isSelectedMine, isMyTurn, unitStates, cohesionData])

  // Phase 1.5 fog of war : un ennemi est visible si AU MOINS une de mes unités non-routed a LoS sur lui.
  // Blockers LoS = tous les corps SAUF l'observateur et la cible (cohérent avec hasLineOfSight côté EF).
  const visibleEnemyIds = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!myTeam) return out
    const myObservers = unitStates.filter(u => u.team === myTeam && !u.routed)
    if (myObservers.length === 0) return out
    for (const enemy of unitStates) {
      if (enemy.team === myTeam) continue
      for (const observer of myObservers) {
        const blockers = new Set<string>()
        for (const u of unitStates) {
          if (u.id === observer.id) continue
          if (u.id === enemy.id) continue
          blockers.add(cubeKey(u.position))
        }
        if (hasLineOfSight(observer.position, enemy.position, blockers)) {
          out.add(enemy.id)
          break
        }
      }
    }
    return out
  }, [myTeam, unitStates])

  // Phase 2 2D.6 : 6 voisins libres autour de la source quand splitMode actif.
  // Calcul indépendant de reachableMap (pas de coût MP, juste adjacence + libre).
  const splitTargetKeys = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!splitMode || !selectedUnit || !isSelectedMine || !isMyTurn) return out
    const occupied = new Set<string>()
    for (const u of unitStates) {
      if (u.id === selectedUnit.id) continue
      occupied.add(cubeKey(u.position))
    }
    for (const n of neighbors(selectedUnit.position)) {
      const k = cubeKey(n)
      if (!boardKeys.has(k)) continue
      if (occupied.has(k)) continue
      out.add(k)
    }
    return out
  }, [splitMode, selectedUnit, isSelectedMine, isMyTurn, unitStates, boardKeys])

  // Phase 2.5 C — 6 voisins libres autour de la source en mode retreat (UX similaire split).
  // L'unité doit être Brisée pour entrer en retreatMode (vérif côté Game.tsx).
  const retreatTargetKeys = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!retreatMode || !selectedUnit || !isSelectedMine || !isMyTurn) return out
    const occupied = new Set<string>()
    for (const u of unitStates) {
      if (u.id === selectedUnit.id) continue
      occupied.add(cubeKey(u.position))
    }
    for (const n of neighbors(selectedUnit.position)) {
      const k = cubeKey(n)
      if (!boardKeys.has(k)) continue
      if (occupied.has(k)) continue
      out.add(k)
    }
    return out
  }, [retreatMode, selectedUnit, isSelectedMine, isMyTurn, unitStates, boardKeys])

  // Phase 2.5 C — ennemis adjacents quand suicideMode actif (cibles potentielles).
  // Le check encerclement + ratio camp se fait côté EF.
  const suicideTargetIds = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!suicideMode || !selectedUnit || !isSelectedMine || !isMyTurn) return out
    for (const enemy of unitStates) {
      if (enemy.team === selectedUnit.team) continue
      if (cubeDistance(selectedUnit.position, enemy.position) !== 1) continue
      out.add(enemy.id)
    }
    return out
  }, [suicideMode, selectedUnit, isSelectedMine, isMyTurn, unitStates])

  const tileStates = useMemo<Map<string, HexTileState>>(() => {
    const map = new Map<string, HexTileState>()
    // Modes exclusifs : split / retreat / suicide n'affichent QUE leur sélection.
    if (splitMode) {
      for (const k of splitTargetKeys) map.set(k, 'split-target')
      return map
    }
    if (retreatMode) {
      // Réutilise le state 'split-target' (ambre) pour la sélection direction retraite.
      for (const k of retreatTargetKeys) map.set(k, 'split-target')
      return map
    }
    if (suicideMode) {
      // Pas de tile state spécifique en mode suicide — les ennemis attaquables sont highlight via suicideTargetIds.
      return map
    }
    for (const k of reachableMap.keys()) {
      // hex reachable mais en ZoC ennemie → 'dangerous' (entree y stoppe le mouvement)
      map.set(k, enemyZoc.has(k) ? 'dangerous' : 'reachable')
    }
    return map
  }, [splitMode, splitTargetKeys, retreatMode, retreatTargetKeys, suicideMode, reachableMap, enemyZoc])

  const exhaustedUnitIds = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    for (const u of unitStates) {
      if (u.hasMoved && u.hasAttacked) set.add(u.id)
      if (u.routed) set.add(u.id)
    }
    return set
  }, [unitStates])

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

  const clearSelection = useCallback(() => {
    setSelectedUnitId(null)
  }, [])

  return {
    selectedUnitId,
    selectedUnit,
    isSelectedMine,
    reachableMap,
    targetableUnitIds,
    dangerousZocKeys: enemyZoc,
    visibleEnemyIds,
    tileStates,
    exhaustedUnitIds,
    splitTargetKeys,
    cohesionStateMap: cohesionData.cohesionStateMap,
    supportMap: cohesionData.supportMap,
    retreatTargetKeys,
    suicideTargetIds,
    handleUnitClick,
    clearSelection,
  }
}
