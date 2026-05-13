// v1.2 (13/05/2026) — Phase 3.2-bis : injection turnsActive sur enginePairs (badge T+N EngagementOverlay)
// v1.1 (12/05/2026) — QW2 : ajout engagementsForInspected (lookup pour EnemyUnitPanel)
// v1.0 (12/05/2026) — QW1 : extraction des dérivations engagements (unitById + enginePairs + engagementsForSelected)
import { useMemo } from 'react'
import type { UnitState } from '@engine/units'
import type { EngagementPair } from '@render/effects/EngagementOverlay'
import type { EngagementRow } from '@hooks/useEngagement'

export interface EngagementSummary {
  id: string
  opponentId: string
  opponentKind: string
  opponentTeam: 'blue' | 'red'
  startedTurn: number
}

interface UseEngagementDerivationsParams {
  unitStates: ReadonlyArray<UnitState>
  engagementRows: ReadonlyArray<EngagementRow>
  engagementsByUnit: Map<string, EngagementRow[]>
  selectedUnit: UnitState | null
  inspectedEnemy: UnitState | null
  /** Phase 3.2-bis : tour courant pour calculer turnsActive = currentTurn - startedTurn + 1. */
  currentTurn?: number
}

export interface UseEngagementDerivationsResult {
  unitById: Map<string, UnitState>
  enginePairs: EngagementPair[]
  engagementsForSelected: EngagementSummary[] | undefined
  engagementsForInspected: EngagementSummary[] | undefined
}

function buildEngagementsForUnit(
  unit: UnitState | null,
  engagementsByUnit: Map<string, EngagementRow[]>,
  unitById: Map<string, UnitState>,
): EngagementSummary[] | undefined {
  if (!unit) return undefined
  const list = engagementsByUnit.get(unit.id)
  if (!list || list.length === 0) return undefined
  return list.flatMap(e => {
    const opponentId = e.unit_a_id === unit.id ? e.unit_b_id : e.unit_a_id
    const opp = unitById.get(opponentId)
    if (!opp) return []
    return [{
      id: e.id,
      opponentId,
      opponentKind: opp.kind as string,
      opponentTeam: opp.team,
      startedTurn: e.started_turn,
    }]
  })
}

export function useEngagementDerivations(
  p: UseEngagementDerivationsParams,
): UseEngagementDerivationsResult {
  const { unitStates, engagementRows, engagementsByUnit, selectedUnit, inspectedEnemy, currentTurn } = p

  const unitById = useMemo<Map<string, UnitState>>(() => {
    const m = new Map<string, UnitState>()
    for (const u of unitStates) m.set(u.id, u)
    return m
  }, [unitStates])

  const enginePairs = useMemo<EngagementPair[]>(() => {
    const out: EngagementPair[] = []
    for (const e of engagementRows) {
      const a = unitById.get(e.unit_a_id)
      const b = unitById.get(e.unit_b_id)
      if (!a || !b) continue
      const turnsActive = currentTurn != null
        ? Math.max(1, currentTurn - e.started_turn + 1)
        : undefined
      out.push({ id: e.id, positionA: a.position, positionB: b.position, turnsActive })
    }
    return out
  }, [engagementRows, unitById, currentTurn])

  const engagementsForSelected = useMemo<EngagementSummary[] | undefined>(
    () => buildEngagementsForUnit(selectedUnit, engagementsByUnit, unitById),
    [selectedUnit, engagementsByUnit, unitById],
  )

  const engagementsForInspected = useMemo<EngagementSummary[] | undefined>(
    () => buildEngagementsForUnit(inspectedEnemy, engagementsByUnit, unitById),
    [inspectedEnemy, engagementsByUnit, unitById],
  )

  return { unitById, enginePairs, engagementsForSelected, engagementsForInspected }
}
