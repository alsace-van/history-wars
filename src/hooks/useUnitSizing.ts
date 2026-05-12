// v1.1 (12/05/2026) — Fusion à distance : mergeTargets inclut les alliés atteignables via BFS + performMerge enchaîne move+merge
// v1.0 (10/05/2026) — Phase 2 2D.5 : hook split/merge pour UnitInspector
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2D.5

import { useCallback, useMemo } from 'react'
import { cubeKey, neighbors, cubeDistance } from '@engine/hex'
import { bfsReachable } from '@engine/movement'
import { computeEnemyZoc } from '@engine/zoc'
import { resolveUnitStatsV2, type UnitState } from '@engine/units'
import type { SplitRatio } from '@engine/units'
import { useCombatActions } from './useCombatActions'

const TAG = '[useUnitSizing v1.1]'

export interface SplitTarget {
  q: number
  r: number
  s: number
  free: boolean
}

/** Cible de fusion : unité alliée + flag "atteignable directement (adjacent) ou via déplacement". */
export interface MergeTarget extends UnitState {
  /** Distance hex source→target en cubes. 1 = adjacent, >1 = nécessite move+merge enchaînés. */
  distance: number
  /** Hex de destination intermédiaire (adjacent à la cible) si distant, undefined si adjacent. */
  approachHex?: { q: number; r: number; s: number }
}

export interface UseUnitSizingResult {
  canSplit: boolean
  canMerge: boolean
  splitTargets: ReadonlyArray<SplitTarget>
  mergeTargets: ReadonlyArray<MergeTarget>
  performSplit: (ratio: SplitRatio, target: { q: number; r: number }) => Promise<boolean>
  /**
   * Fusionne l'unité courante avec une cible alliée.
   *  - Si adjacent : appel direct `merge_unit` (la source = unité courante disparaît dans la cible).
   *  - Si distant : enchaîne `move` (vers approachHex) puis `merge_unit`.
   * Retourne true en cas de succès complet.
   */
  performMerge: (targetUnitId: string) => Promise<boolean>
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
 * Hook actions split / merge pour le pion sélectionné.
 *
 * v1.1 — La fusion accepte désormais des cibles **distantes** : si l'unité a encore
 * son mouvement, le hook calcule un BFS et retient les alliés compatibles dont au
 * moins un hex adjacent est atteignable. `performMerge` enchaîne alors move + merge
 * côté client. Si l'unité a déjà bougé, seules les fusions adjacentes restent dispo.
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

  /**
   * Cibles fusion potentielles (adjacentes + distantes atteignables).
   * Conditions par cible :
   *  - même team / kind / subKind
   *  - non attaqué / non routed
   *  - effectif cumulé ≤ effectiveMax cumulé (pas d'overflow)
   *  - adjacente OU au moins 1 hex adjacent à elle est dans le BFS reachable (et l'unité source peut encore bouger)
   */
  const mergeTargets = useMemo<ReadonlyArray<MergeTarget>>(() => {
    if (!unit || unit.hasAttacked || unit.routed) return []

    // Filtres communs (kind / team / overflow / état) — applicables avant le BFS.
    const compatibleAllies = allUnits.filter(other => {
      if (other.id === unit.id) return false
      if (other.team !== unit.team) return false
      if (other.kind !== unit.kind) return false
      if ((other.subKind ?? null) !== (unit.subKind ?? null)) return false
      if (other.hasAttacked || other.routed) return false
      const totalEffective = unit.effective + other.effective
      const cumulMax = unit.effectiveMax + other.effectiveMax
      if (totalEffective > cumulMax) return false
      return true
    })

    // Cas rapide adjacent (toujours autorisé, même si l'unité a déjà bougé).
    const out: MergeTarget[] = []
    const adjacentSet = new Set<string>()
    for (const ally of compatibleAllies) {
      if (cubeDistance(unit.position, ally.position) === 1) {
        out.push({ ...ally, distance: 1 })
        adjacentSet.add(ally.id)
      }
    }

    // Cas distant : nécessite mouvement disponible.
    if (!unit.hasMoved) {
      const stats = resolveUnitStatsV2(unit.kind, unit.subKind)
      const others = allUnits.filter(u => u.id !== unit.id)
      const blockers = new Set(others.map(u => cubeKey(u.position)))
      const enemyZoc = computeEnemyZoc(allUnits, unit.team)
      const reachable = bfsReachable({
        start: unit.position,
        movementPoints: stats.movement,
        blockers,
        enemyZocCubes: enemyZoc,
      })

      for (const ally of compatibleAllies) {
        if (adjacentSet.has(ally.id)) continue // déjà ajouté en adjacent
        const d = cubeDistance(unit.position, ally.position)
        // Adjacent à un hex atteignable ? Sinon impossible.
        const adjs = neighbors(ally.position)
        let bestApproach: { q: number; r: number; s: number } | undefined
        let bestCost = Infinity
        for (const adj of adjs) {
          const key = cubeKey(adj)
          const cost = reachable.get(key)
          if (cost !== undefined && cost < bestCost) {
            bestCost = cost
            bestApproach = adj
          }
        }
        if (bestApproach) {
          out.push({ ...ally, distance: d, approachHex: bestApproach })
        }
      }
    }

    return out
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
    async (targetUnitId: string): Promise<boolean> => {
      if (!gameId || !unit) {
        console.warn(TAG, 'performMerge called without gameId or unit')
        return false
      }
      const target = mergeTargets.find(t => t.id === targetUnitId)
      if (!target) {
        console.warn(TAG, `performMerge target ${targetUnitId} not in mergeTargets`)
        return false
      }
      // v1.1 — Si distant : on déplace d'abord vers approachHex (hex adjacent à la cible),
      // puis on envoie le merge. Le serveur lit la position fraîche après le move.
      if (target.distance > 1 && target.approachHex) {
        const moveRes = await submitAction(gameId, {
          type: 'move',
          payload: { unit_id: unit.id, dest_q: target.approachHex.q, dest_r: target.approachHex.r },
        })
        if (!moveRes.ok) {
          console.warn(TAG, 'performMerge: move step failed, abort merge')
          return false
        }
      }
      // Sémantique : la cible cliquée survit (target_unit_id), l'unité courante disparaît (source_unit_id).
      // Cohérent avec l'intuition utilisateur : "je vais rejoindre cette unité".
      const mergeRes = await submitAction(gameId, {
        type: 'merge_unit',
        payload: { target_unit_id: targetUnitId, source_unit_id: unit.id },
      })
      return mergeRes.ok
    },
    [gameId, unit, mergeTargets, submitAction],
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
