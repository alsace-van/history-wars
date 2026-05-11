// v1.4 (11/05/2026) — Phase 2 hotfix soft-lock : autoriser l'attaque sur ennemi routé (coup de grâce)
// v1.3 (10/05/2026) — Phase 2 2D.6 : param splitMode → tileStates 'split-target' sur hex adjacents libres
// v1.2 (10/05/2026) — Phase 1.5 : ajout visibleEnemyIds (fog of war via LoS depuis toutes mes unités)
// v1.1 (10/05/2026) — P1-L1C4-02 : ajout targetableUnitIds + dangerousZocKeys + tileStates 'dangerous'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  handleUnitClick: (unit: { id: string; team: Team }) => void
  clearSelection: () => void
}

export function useTacticalSelection(
  params: UseTacticalSelectionParams
): UseTacticalSelectionResult {
  const { inProgress, isMyTurn, myTeam, activeTeam, unitStates, boardKeys, splitMode } = params

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
  }, [selectedUnit, isSelectedMine, isMyTurn, unitStates, enemyZoc, boardKeys])

  const targetableUnitIds = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!selectedUnit || !isSelectedMine || !isMyTurn) return out
    if (selectedUnit.hasAttacked || selectedUnit.routed) return out
    const stats = getUnitStats(selectedUnit.kind)
    const range = stats.range
    for (const enemy of unitStates) {
      if (enemy.team === selectedUnit.team) continue
      // Hotfix v1.4 : on N'EXCLUT PAS les unités routées de la liste des cibles.
      // Sinon, une routed adjacente bloque indéfiniment la partie (récup moral
      // impossible en ZdC ennemie cf. morale.ts:53 → soft-lock total).
      // Permettre le « coup de grâce » est aussi historiquement réaliste.
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
  }, [selectedUnit, isSelectedMine, isMyTurn, unitStates])

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

  const tileStates = useMemo<Map<string, HexTileState>>(() => {
    const map = new Map<string, HexTileState>()
    // En mode split : on ignore reachable/dangerous, on ne montre QUE les 6 cibles split.
    if (splitMode) {
      for (const k of splitTargetKeys) map.set(k, 'split-target')
      return map
    }
    for (const k of reachableMap.keys()) {
      // hex reachable mais en ZoC ennemie → 'dangerous' (entree y stoppe le mouvement)
      map.set(k, enemyZoc.has(k) ? 'dangerous' : 'reachable')
    }
    return map
  }, [splitMode, splitTargetKeys, reachableMap, enemyZoc])

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
    handleUnitClick,
    clearSelection,
  }
}
