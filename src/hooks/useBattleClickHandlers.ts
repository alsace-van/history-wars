// v1.7 (17/05/2026) — cleanup : retrait log diagnostic [CAV-CLICK] après
//   résolution du bug stale preview (cf. useChargePreview v1.1).
// v1.6 (16/05/2026) — Phase 2.6 UX pré-commit : click ennemi 'charge' → open preview au lieu de submit. Re-clic enemy = stay, click case bleue = retreat.
// v1.5 (16/05/2026) — Phase 2.6 refonte : dispatcher attaque unifié via attackTargets (auto-move + attack atomique). Suppr useChargeIntent + popup.
// v1.4 (16/05/2026) — Phase 2.6 UX : intercept enemy click pour ouvrir ChargeChoicePopup si cav charge éligible ; commit stay/retreat en mode chargeIntent
// v1.3 (16/05/2026) — Phase 2.6 : handleTileClick gère chargeRetreatMode (menu post-charge cav)
// v1.2 (14/05/2026) — Phase 3.3 Lot C : handleTileClick gère orderRetreatPickMode (pré-ordre retreat)
// v1.1 (12/05/2026) — UX : mergeMode → clic sur unité alliée cible déclenche performMerge (avec move auto si distant)
// v1.0 (11/05/2026) — Phase 2.5 C : extraction handlers click (unit/tile/shaken) pour alléger Game.tsx
import { useCallback } from 'react'
import { cubeKey, type Cube } from '@engine/hex'
import { aStar } from '@engine/movement'
import { computeEnemyZoc } from '@engine/zoc'
import type { UnitState } from '@engine/units'
import type { AttackPositionResult } from '@engine/combat/v2'
import type { Team } from '@/types/game'
import type { GameAction } from '@hooks/useCombatActions'
import type { AttackHint } from '@hooks/useTacticalSelection'

interface UseBattleClickHandlersParams {
  gameId: string | null
  inProgress: boolean
  selectedUnit: UnitState | null
  myTeam: Team | null
  unitStates: ReadonlyArray<UnitState>
  reachableMap: Map<string, number>
  targetableUnitIds: Set<string>
  /**
   * Phase 2.6 refonte — map des cibles avec meta (path + hint). Consommé par le
   * dispatcher pour décider du payload move_dest/move_path à envoyer.
   */
  attackTargets: ReadonlyMap<string, AttackPositionResult & { hint: AttackHint }>
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
  // Phase 2.6 UX pré-commit cav — preview avant la charge atomique.
  /**
   * Id de la cible si une preview est active (click ennemi avec hint='charge').
   * Re-click sur ce même ennemi = commitChargeStay. Click case bleue = commitChargeRetreat.
   */
  chargePreviewTargetId?: string | null
  /** Set cubeKey des cases de repli candidates (radius 3 depuis landing). */
  chargePreviewRetreatKeys?: ReadonlySet<string>
  /** Ouvre la preview (appelé sur click enemy avec hint='charge'). */
  openChargePreview?: (target: UnitState, meta: { dest: Cube; path: ReadonlyArray<Cube>; expectStraight: boolean }) => void
  /** Submit attack avec intent stay. */
  commitChargeStay?: () => Promise<void>
  /** Submit attack avec intent retreat sur cette case. */
  commitChargeRetreat?: (hex: Cube) => Promise<void>
  /** Annule la preview sans submit. */
  cancelChargePreview?: () => void
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
    attackTargets,
    chargePreviewTargetId,
    chargePreviewRetreatKeys,
    openChargePreview,
    commitChargeStay,
    commitChargeRetreat,
    cancelChargePreview,
  } = p

  const handleUnitClick = useCallback(
    async (unit: { id: string; team: Team }) => {
      if (!gameId || !inProgress) return
      // Phase 2.6 UX pré-commit — preview active.
      if (chargePreviewTargetId) {
        // Re-click sur la cible de la preview = "Rester en mêlée".
        if (unit.id === chargePreviewTargetId && commitChargeStay) {
          await commitChargeStay()
          return
        }
        // Click sur autre unité = cancel + continue le flow normal.
        if (cancelChargePreview) cancelChargePreview()
      }
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
      // Phase 2.6 refonte — attaque unifiée via attackTargets (auto-move + attack atomique).
      if (selectedUnit && unit.team !== myTeam && targetableUnitIds.has(unit.id)) {
        if (actionsBusy) return
        if (selectedCohesionState === 'shaken' && !skipShakenWarning) {
          setPendingShakenAttack({ targetId: unit.id })
          return
        }
        const meta = attackTargets.get(unit.id)
        if (!meta) return  // safety, ne devrait pas arriver

        // Phase 2.6 UX pré-commit — pour les charges cav (hint='charge'),
        // ouvre la preview au lieu de soumettre direct. L'utilisateur choisira
        // ensuite stay (re-clic ennemi) ou retreat (clic case bleue).
        if (meta.hint === 'charge' && openChargePreview) {
          openChargePreview(unit as unknown as UnitState, meta)
          return
        }

        // Pour melee/march/march-fire : submit immédiat (1 clic).
        const isRanged = meta.hint === 'march-fire'
        const payload: GameAction['payload'] = meta.path.length > 0
          ? {
              unit_id: selectedUnit.id,
              target_unit_id: unit.id,
              move_dest: { q: meta.dest.q, r: meta.dest.r },
              move_path: meta.path.map(c => ({ q: c.q, r: c.r, s: c.s })),
            }
          : { unit_id: selectedUnit.id, target_unit_id: unit.id }
        if (meta.path.length >= 2) {
          const attackerId = selectedUnit.id
          setUnitPaths(prev => {
            const next = new Map(prev)
            next.set(attackerId, meta.path)
            return next
          })
        }
        const res = await submitAction(gameId, {
          type: isRanged ? 'attack_ranged' : 'attack_melee',
          payload,
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
      attackTargets, setUnitPaths,
      chargePreviewTargetId, commitChargeStay, openChargePreview, cancelChargePreview,
    ],
  )

  const handleTileClick = useCallback(
    async (cube: Cube) => {
      // Phase 2.6 UX pré-commit — preview active : check AVANT le bail "!selectedUnit"
      // pour éviter le bug "click case bleue sans effet" si la sélection a été
      // clearée entre temps.
      const key = cubeKey(cube)
      if (chargePreviewTargetId && chargePreviewRetreatKeys) {
        if (chargePreviewRetreatKeys.has(key) && commitChargeRetreat) {
          await commitChargeRetreat(cube)
        } else if (cancelChargePreview) {
          cancelChargePreview()
        }
        return
      }
      if (!gameId || !inProgress || !selectedUnit) return
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
      chargePreviewTargetId, chargePreviewRetreatKeys, commitChargeRetreat, cancelChargePreview,
    ],
  )

  const handleShakenConfirm = useCallback(async (dontShowAgain: boolean) => {
    if (!gameId || !selectedUnit || !pendingShakenAttack) return
    if (dontShowAgain) setSkipShakenWarning(true)
    const meta = attackTargets.get(pendingShakenAttack.targetId)
    // Phase 2.6 UX pré-commit — si la cible est chargeable, ouvre la preview
    // après le confirm shaken (au lieu de submit direct). L'utilisateur choisira
    // ensuite stay/retreat.
    if (meta?.hint === 'charge' && openChargePreview) {
      const targetUnit = (() => {
        // best-effort lookup — pendingShakenAttack.targetId est un UnitState.id valide.
        // openChargePreview attend un UnitState. On reconstruit minimal depuis meta + id.
        return { id: pendingShakenAttack.targetId, position: meta.dest } as unknown as UnitState
      })()
      setPendingShakenAttack(null)
      openChargePreview(targetUnit, meta)
      return
    }
    const isRanged = meta?.hint === 'march-fire'
    const payload: GameAction['payload'] = meta && meta.path.length > 0
      ? {
          unit_id: selectedUnit.id,
          target_unit_id: pendingShakenAttack.targetId,
          move_dest: { q: meta.dest.q, r: meta.dest.r },
          move_path: meta.path.map(c => ({ q: c.q, r: c.r, s: c.s })),
        }
      : { unit_id: selectedUnit.id, target_unit_id: pendingShakenAttack.targetId }
    if (meta && meta.path.length >= 2) {
      const attackerId = selectedUnit.id
      setUnitPaths(prev => {
        const next = new Map(prev)
        next.set(attackerId, meta.path)
        return next
      })
    }
    const res = await submitAction(gameId, {
      type: isRanged ? 'attack_ranged' : 'attack_melee',
      payload,
    })
    setPendingShakenAttack(null)
    if (res.ok) {
      clearSelection()
      setHoveredEnemyId(null)
    }
  }, [gameId, selectedUnit, pendingShakenAttack, setSkipShakenWarning, submitAction, clearSelection, setHoveredEnemyId, setPendingShakenAttack, attackTargets, setUnitPaths, openChargePreview])

  return { handleUnitClick, handleTileClick, handleShakenConfirm }
}
