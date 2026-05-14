// v1.2 (14/05/2026) — Phase 3.3 Lot C : handleTileClick gère orderRetreatPickMode (pré-ordre retreat)
// v1.1 (12/05/2026) — UX : mergeMode → clic sur unité alliée cible déclenche performMerge (avec move auto si distant)
// v1.0 (11/05/2026) — Phase 2.5 C : extraction handlers click (unit/tile/shaken) pour alléger Game.tsx
import { useCallback } from 'react'
import { cubeKey, type Cube } from '@engine/hex'
import { aStar } from '@engine/movement'
import { computeEnemyZoc } from '@engine/zoc'
import { getUnitStats, type UnitState } from '@engine/units'
import type { Team } from '@/types/game'
import type { GameAction } from '@hooks/useCombatActions'

interface UseBattleClickHandlersParams {
  gameId: string | null
  inProgress: boolean
  selectedUnit: UnitState | null
  myTeam: Team | null
  unitStates: ReadonlyArray<UnitState>
  reachableMap: Map<string, number>
  targetableUnitIds: Set<string>
  splitMode: 'half' | 'three_quarter' | 'nine_one' | null
  splitTargetKeys: Set<string>
  retreatMode: boolean
  retreatTargetKeys: Set<string>
  suicideMode: boolean
  suicideTargetIds: Set<string>
  // v1.1 — mergeMode (sélection cible alliée sur la map)
  mergeMode: boolean
  mergeTargetUnitIds: Set<string>
  performMerge: (targetUnitId: string) => Promise<boolean>
  setMergeMode: (on: boolean) => void
  selectedCohesionState: 'nominal' | 'shaken' | 'broken' | undefined
  skipShakenWarning: boolean
  actionsBusy: boolean
  submitAction: (gameId: string, action: GameAction) => Promise<{ ok: boolean }>
  performRetreat: (dest: Cube) => Promise<void>
  performSuicide: (targetUnitId: string) => Promise<void>
  hookHandleUnitClick: (u: { id: string; team: Team }) => void
  clearSelection: () => void
  setHoveredEnemyId: (id: string | null) => void
  setSplitMode: (m: 'half' | 'three_quarter' | 'nine_one' | null) => void
  setRetreatMode: (on: boolean) => void
  setPendingShakenAttack: (p: { targetId: string } | null) => void
  setSkipShakenWarning: (skip: boolean) => void
  setUnitPaths: (
    updater: (prev: Map<string, ReadonlyArray<Cube>>) => Map<string, ReadonlyArray<Cube>>,
  ) => void
  pendingShakenAttack: { targetId: string } | null
  // Phase 3.3 Lot C — mode "pick hex" pour pré-ordre retreat (depuis OrdersPanel).
  orderRetreatPickMode?: boolean
  orderRetreatPickKeys?: Set<string>
  commitOrderRetreatPick?: (hex: Cube) => void
  cancelOrderRetreatPick?: () => void
}

interface UseBattleClickHandlersResult {
  handleUnitClick: (unit: { id: string; team: Team }) => Promise<void>
  handleTileClick: (cube: Cube) => Promise<void>
  handleShakenConfirm: (dontShowAgain: boolean) => Promise<void>
}

export function useBattleClickHandlers(p: UseBattleClickHandlersParams): UseBattleClickHandlersResult {
  const {
    gameId, inProgress, selectedUnit, myTeam, unitStates, reachableMap, targetableUnitIds,
    splitMode, splitTargetKeys, retreatMode, retreatTargetKeys, suicideMode, suicideTargetIds,
    mergeMode, mergeTargetUnitIds, performMerge, setMergeMode,
    selectedCohesionState, skipShakenWarning, actionsBusy, submitAction,
    performRetreat, performSuicide, hookHandleUnitClick, clearSelection, setHoveredEnemyId,
    setSplitMode, setRetreatMode, setPendingShakenAttack, setSkipShakenWarning,
    setUnitPaths, pendingShakenAttack,
    orderRetreatPickMode = false,
    orderRetreatPickKeys,
    commitOrderRetreatPick,
    cancelOrderRetreatPick,
  } = p

  const handleUnitClick = useCallback(
    async (unit: { id: string; team: Team }) => {
      if (!gameId || !inProgress) return
      // v1.1 — mergeMode : clic sur unité alliée cible (cerclée bleue) → performMerge
      if (mergeMode && selectedUnit && unit.team === myTeam && mergeTargetUnitIds.has(unit.id)) {
        if (actionsBusy) return
        const ok = await performMerge(unit.id)
        if (ok) {
          setMergeMode(false)
          clearSelection()
        }
        return
      }
      // mergeMode + clic n'importe où d'autre → cancel
      if (mergeMode) {
        setMergeMode(false)
        // tomber dans le comportement normal pour la cible cliquée
      }
      // Suicide mode : click ennemi adjacent → suicide_attack
      if (suicideMode && selectedUnit && unit.team !== myTeam && suicideTargetIds.has(unit.id)) {
        if (actionsBusy) return
        await performSuicide(unit.id)
        return
      }
      // Attaque standard si targetable
      if (selectedUnit && unit.team !== myTeam && targetableUnitIds.has(unit.id)) {
        if (actionsBusy) return
        if (selectedCohesionState === 'shaken' && !skipShakenWarning) {
          setPendingShakenAttack({ targetId: unit.id })
          return
        }
        const atkStats = getUnitStats(selectedUnit.kind)
        const isRanged = atkStats.range > 1
        const res = await submitAction(gameId, {
          type: isRanged ? 'attack_ranged' : 'attack_melee',
          payload: { unit_id: selectedUnit.id, target_unit_id: unit.id },
        })
        if (res.ok) {
          clearSelection()
          setHoveredEnemyId(null)
        }
        return
      }
      hookHandleUnitClick(unit)
    },
    [
      gameId, inProgress, selectedUnit, myTeam, targetableUnitIds, actionsBusy, submitAction,
      clearSelection, hookHandleUnitClick, suicideMode, suicideTargetIds, performSuicide,
      selectedCohesionState, skipShakenWarning, setPendingShakenAttack, setHoveredEnemyId,
      mergeMode, mergeTargetUnitIds, performMerge, setMergeMode,
    ],
  )

  const handleTileClick = useCallback(
    async (cube: Cube) => {
      if (!gameId || !inProgress || !selectedUnit) return
      const key = cubeKey(cube)
      // Phase 3.3 Lot C — pré-ordre retreat : click sur hex highlight bleu → commit destHex.
      // Click hors highlight → cancel mode sans commit.
      if (orderRetreatPickMode) {
        if (orderRetreatPickKeys && orderRetreatPickKeys.has(key) && commitOrderRetreatPick) {
          commitOrderRetreatPick(cube)
        } else if (cancelOrderRetreatPick) {
          cancelOrderRetreatPick()
        }
        return
      }
      // v1.1 — mergeMode : clic sur hex vide → cancel mergeMode et stop
      if (mergeMode) { setMergeMode(false); return }
      // Mode retreat : tile ambre → retreat
      if (retreatMode) {
        if (!retreatTargetKeys.has(key)) { setRetreatMode(false); return }
        if (actionsBusy) return
        await performRetreat(cube)
        return
      }
      // Mode split : tile ambre → split_unit
      if (splitMode !== null) {
        if (!splitTargetKeys.has(key)) { setSplitMode(null); return }
        if (actionsBusy) return
        const res = await submitAction(gameId, {
          type: 'split_unit',
          payload: { unit_id: selectedUnit.id, target_q: cube.q, target_r: cube.r, ratio: splitMode },
        })
        if (res.ok) { setSplitMode(null); clearSelection() }
        return
      }
      // Move standard
      if (!reachableMap.has(key)) { clearSelection(); return }
      if (actionsBusy) return
      const others = unitStates.filter(u => u.id !== selectedUnit.id)
      const blockers = new Set(others.map(u => cubeKey(u.position)))
      const enemyZoc = computeEnemyZoc(unitStates, selectedUnit.team)
      const path = aStar({
        start: selectedUnit.position, goal: cube, blockers, enemyZocCubes: enemyZoc,
      })
      const res = await submitAction(gameId, {
        type: 'move',
        payload: { unit_id: selectedUnit.id, dest_q: cube.q, dest_r: cube.r },
      })
      if (res.ok && path && path.length >= 2) {
        setUnitPaths(prev => {
          const next = new Map(prev)
          next.set(selectedUnit.id, path)
          return next
        })
      }
    },
    [
      gameId, inProgress, selectedUnit, splitMode, splitTargetKeys, reachableMap, actionsBusy,
      submitAction, unitStates, clearSelection, retreatMode, retreatTargetKeys, performRetreat,
      setRetreatMode, setSplitMode, setUnitPaths, mergeMode, setMergeMode,
      orderRetreatPickMode, orderRetreatPickKeys, commitOrderRetreatPick, cancelOrderRetreatPick,
    ],
  )

  const handleShakenConfirm = useCallback(async (dontShowAgain: boolean) => {
    if (!gameId || !selectedUnit || !pendingShakenAttack) return
    if (dontShowAgain) setSkipShakenWarning(true)
    const atkStats = getUnitStats(selectedUnit.kind)
    const isRanged = atkStats.range > 1
    const res = await submitAction(gameId, {
      type: isRanged ? 'attack_ranged' : 'attack_melee',
      payload: { unit_id: selectedUnit.id, target_unit_id: pendingShakenAttack.targetId },
    })
    setPendingShakenAttack(null)
    if (res.ok) {
      clearSelection()
      setHoveredEnemyId(null)
    }
  }, [gameId, selectedUnit, pendingShakenAttack, setSkipShakenWarning, submitAction, clearSelection, setHoveredEnemyId, setPendingShakenAttack])

  return { handleUnitClick, handleTileClick, handleShakenConfirm }
}
