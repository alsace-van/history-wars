// v1.1 (10/05/2026) — P1-L1C4-02 : ajout targetableUnitIds + dangerousZocKeys + tileStates 'dangerous'
// v1.0 (10/05/2026) — P1-REFACTOR-02 : extraction de la logique selection/reachable/tileStates depuis Game.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cubeKey, cubeDistance } from '@engine/hex'
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
  /** Map<cubeKey, HexTileState> a passer a TacticalScene */
  tileStates: Map<string, HexTileState>
  /** Set des unites qui ont epuise leurs ordres (visuellement attenuees) */
  exhaustedUnitIds: Set<string>
  handleUnitClick: (unit: { id: string; team: Team }) => void
  clearSelection: () => void
}

export function useTacticalSelection(
  params: UseTacticalSelectionParams
): UseTacticalSelectionResult {
  const { inProgress, isMyTurn, myTeam, activeTeam, unitStates, boardKeys } = params

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
      if (enemy.routed) continue
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

  const tileStates = useMemo<Map<string, HexTileState>>(() => {
    const map = new Map<string, HexTileState>()
    for (const k of reachableMap.keys()) {
      // hex reachable mais en ZoC ennemie → 'dangerous' (entree y stoppe le mouvement)
      map.set(k, enemyZoc.has(k) ? 'dangerous' : 'reachable')
    }
    return map
  }, [reachableMap, enemyZoc])

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
    tileStates,
    exhaustedUnitIds,
    handleUnitClick,
    clearSelection,
  }
}
