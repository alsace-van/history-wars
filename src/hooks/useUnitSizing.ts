// v1.0 (10/05/2026) — Phase 2 2D.5 : hook split/merge pour UnitInspector
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2D.5

import { useCallback, useMemo } from 'react'
import { cubeKey, neighbors } from '@engine/hex'
import { resolveUnitStatsV2, type UnitState } from '@engine/units'
import type { SplitRatio } from '@engine/units'
import { useCombatActions } from './useCombatActions'

const TAG = '[useUnitSizing v1.0]'

export interface SplitTarget {
  q: number
  r: number
  s: number
  free: boolean
}

export interface UseUnitSizingResult {
  /** True si le pion peut etre scinde (conditions effectif + non attacked + cases libres). */
  canSplit: boolean
  /** True si au moins un pion adjacent same kind/team est fusionnable. */
  canMerge: boolean
  /** Liste des cases adjacentes pour split (avec flag free=true si vide). */
  splitTargets: ReadonlyArray<SplitTarget>
  /** Liste des pions adjacents fusionables. */
  mergeTargets: ReadonlyArray<UnitState>
  /** Lance un split via EF. Retourne true si reussite, false sinon. */
  performSplit: (ratio: SplitRatio, target: { q: number; r: number }) => Promise<boolean>
  /** Lance un merge via EF. */
  performMerge: (otherUnitId: string) => Promise<boolean>
  busy: boolean
}

interface UseUnitSizingParams {
  gameId: string | null
  unit: UnitState | null
  allUnits: ReadonlyArray<UnitState>
  isMyUnit: boolean
  isMyTurn: boolean
}

/**
 * Hook actions split / merge pour le pion selectionne.
 *
 * Conditions split (cf. engine/units/sizing.ts) :
 *  - unit !== null
 *  - isMyUnit && isMyTurn
 *  - !unit.routed && !unit.hasAttacked
 *  - unit.effective >= 2 * effectiveMin
 *  - au moins 1 case adjacente libre
 *
 * Conditions merge :
 *  - unit !== null
 *  - isMyUnit && isMyTurn
 *  - au moins 1 pion adjacent same kind/team/subKind, !hasAttacked, total <= effectiveMax cumule
 */
export function useUnitSizing(params: UseUnitSizingParams): UseUnitSizingResult {
  const { gameId, unit, allUnits, isMyUnit, isMyTurn } = params
  const { busy, submitAction } = useCombatActions()

  const splitTargets = useMemo<ReadonlyArray<SplitTarget>>(() => {
    if (!unit) return []
    const occupied = new Set<string>()
    for (const u of allUnits) {
      if (u.id === unit.id) continue
      occupied.add(cubeKey(u.position))
    }
    return neighbors(unit.position).map(n => ({
      q: n.q, r: n.r, s: n.s,
      free: !occupied.has(cubeKey(n)),
    }))
  }, [unit, allUnits])

  const mergeTargets = useMemo<ReadonlyArray<UnitState>>(() => {
    if (!unit || unit.hasAttacked || unit.routed) return []
    const candidates: UnitState[] = []
    for (const other of allUnits) {
      if (other.id === unit.id) continue
      if (other.team !== unit.team) continue
      if (other.kind !== unit.kind) continue
      if ((other.subKind ?? null) !== (unit.subKind ?? null)) continue
      if (other.hasAttacked || other.routed) continue
      // Adjacence (cf. neighbors retourne 6 hex)
      const adj = neighbors(unit.position).some(n => n.q === other.position.q && n.r === other.position.r)
      if (!adj) continue
      // Verifier overflow potentiel : total <= effectiveMax cumule
      const totalEffective = unit.effective + other.effective
      const cumulMax = unit.effectiveMax + other.effectiveMax
      if (totalEffective > cumulMax) continue
      candidates.push(other)
    }
    return candidates
  }, [unit, allUnits])

  const canSplit = useMemo(() => {
    if (!unit) return false
    if (!isMyUnit || !isMyTurn) return false
    if (unit.routed || unit.hasAttacked) return false
    const stats = resolveUnitStatsV2(unit.kind, unit.subKind)
    if (unit.effective < 2 * stats.effectiveMin) return false
    return splitTargets.some(t => t.free)
  }, [unit, isMyUnit, isMyTurn, splitTargets])

  const canMerge = useMemo(() => {
    if (!unit) return false
    if (!isMyUnit || !isMyTurn) return false
    return mergeTargets.length > 0
  }, [unit, isMyUnit, isMyTurn, mergeTargets])

  const performSplit = useCallback(
    async (ratio: SplitRatio, target: { q: number; r: number }): Promise<boolean> => {
      if (!gameId || !unit) {
        console.warn(TAG, 'performSplit called without gameId or unit')
        return false
      }
      const res = await submitAction(gameId, {
        type: 'split_unit',
        payload: { unit_id: unit.id, target_q: target.q, target_r: target.r, ratio },
      })
      return res.ok
    },
    [gameId, unit, submitAction],
  )

  const performMerge = useCallback(
    async (otherUnitId: string): Promise<boolean> => {
      if (!gameId || !unit) {
        console.warn(TAG, 'performMerge called without gameId or unit')
        return false
      }
      const res = await submitAction(gameId, {
        type: 'merge_unit',
        payload: { target_unit_id: unit.id, source_unit_id: otherUnitId },
      })
      return res.ok
    },
    [gameId, unit, submitAction],
  )

  return {
    canSplit,
    canMerge,
    splitTargets,
    mergeTargets,
    performSplit,
    performMerge,
    busy,
  }
}
