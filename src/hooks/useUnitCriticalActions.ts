// v1.0 (11/05/2026) — Phase 2.5 C : actions critiques unité Brisée (Retraite / Reddition / Suicide)
// Source : docs/PLAN-MORAL-COHESION.md § 4
// Stateless : les modes (retreatMode/suicideMode/pendingShaken) sont gérés par Game.tsx.
// Ce hook expose : canRetreat/canSuicide dérivés + 3 triggers (POST EF).
import { useCallback, useMemo } from 'react'
import { EFFECTIVE_REFORM_THRESHOLD_RATIO } from '@engine/cohesion'
import { cubeDistance, cubeKey, neighbors, type Cube } from '@engine/hex'
import type { UnitState } from '@engine/units'
import { useCombatActions } from '@hooks/useCombatActions'

interface UseUnitCriticalActionsParams {
  gameId: string | null
  selectedUnit: UnitState | null
  unitStates: ReadonlyArray<UnitState>
  /** Set des hex valides in-board (limite la détection encerclement aux bords). */
  boardKeys: ReadonlySet<string>
  /** Callback après action critique réussie (clearSelection, reset modes parents). */
  onActionCompleted?: () => void
}

interface UseUnitCriticalActionsResult {
  /** True si selectedUnit a au moins 1 voisin libre adjacent in-board. */
  canRetreat: boolean
  /** True si selectedUnit encerclée (canRetreat=false) ET ratio camp ≥ 25% ET au moins 1 ennemi adjacent. */
  canSuicide: boolean
  performRetreat: (dest: Cube) => Promise<void>
  performSurrender: () => Promise<void>
  performSuicide: (targetUnitId: string) => Promise<void>
}

function computeCampEffectiveRatio(
  team: UnitState['team'],
  unitStates: ReadonlyArray<UnitState>,
): number {
  let alive = 0
  let max = 0
  for (const u of unitStates) {
    if (u.team !== team) continue
    alive += u.effective
    max += u.effectiveMax
  }
  return max > 0 ? alive / max : 0
}

export function useUnitCriticalActions(
  params: UseUnitCriticalActionsParams,
): UseUnitCriticalActionsResult {
  const { gameId, selectedUnit, unitStates, boardKeys, onActionCompleted } = params
  const { submitAction } = useCombatActions()

  const canRetreat = useMemo<boolean>(() => {
    if (!selectedUnit) return false
    const occupied = new Set<string>()
    for (const u of unitStates) {
      if (u.id === selectedUnit.id) continue
      occupied.add(cubeKey(u.position))
    }
    for (const n of neighbors(selectedUnit.position)) {
      const k = cubeKey(n)
      if (!boardKeys.has(k)) continue
      if (occupied.has(k)) continue
      return true
    }
    return false
  }, [selectedUnit, unitStates, boardKeys])

  const canSuicide = useMemo<boolean>(() => {
    if (!selectedUnit) return false
    // Au moins 1 ennemi adjacent
    let hasAdjEnemy = false
    for (const u of unitStates) {
      if (u.team === selectedUnit.team) continue
      if (cubeDistance(selectedUnit.position, u.position) === 1) {
        hasAdjEnemy = true
        break
      }
    }
    if (!hasAdjEnemy) return false
    // Encerclement total : pas de voisin libre
    if (canRetreat) return false
    // Ratio camp ≥ seuil reform (25%) — sinon capitulation forcée
    const ratio = computeCampEffectiveRatio(selectedUnit.team, unitStates)
    return ratio >= EFFECTIVE_REFORM_THRESHOLD_RATIO
  }, [selectedUnit, unitStates, canRetreat])

  const performRetreat = useCallback(async (dest: Cube) => {
    if (!gameId || !selectedUnit) return
    const res = await submitAction(gameId, {
      type: 'retreat',
      payload: { unit_id: selectedUnit.id, dest_q: dest.q, dest_r: dest.r },
    })
    if (res.ok) onActionCompleted?.()
  }, [gameId, selectedUnit, submitAction, onActionCompleted])

  const performSurrender = useCallback(async () => {
    if (!gameId || !selectedUnit) return
    const res = await submitAction(gameId, {
      type: 'surrender',
      payload: { unit_id: selectedUnit.id },
    })
    if (res.ok) onActionCompleted?.()
  }, [gameId, selectedUnit, submitAction, onActionCompleted])

  const performSuicide = useCallback(async (targetUnitId: string) => {
    if (!gameId || !selectedUnit) return
    const res = await submitAction(gameId, {
      type: 'suicide_attack',
      payload: { unit_id: selectedUnit.id, target_unit_id: targetUnitId },
    })
    if (res.ok) onActionCompleted?.()
  }, [gameId, selectedUnit, submitAction, onActionCompleted])

  return {
    canRetreat,
    canSuicide,
    performRetreat,
    performSurrender,
    performSuicide,
  }
}
