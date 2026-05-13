// v1.0 (13/05/2026) — Phase 3.2 Vague A2 : port engine-port vision (mirror src/engine/vision/visibility.ts)
// PORT FROM src/engine/vision/visibility.ts — DO NOT EDIT MANUALLY.
import { cubeDistance, cubeKey, spiral } from '../hex/index.ts'
import { hasLineOfSight } from '../los/index.ts'
import { getUnitStatsV2 } from '../units.ts'
import type { UnitState } from '../units.ts'

export type VisibilityLevel = 'hidden' | 'spotted' | 'identified'

const LEVEL_RANK: Record<VisibilityLevel, number> = { hidden: 0, spotted: 1, identified: 2 }

function buildBlockers(allUnits: ReadonlyArray<UnitState>, exclude: ReadonlySet<string>): Set<string> {
  const blockers = new Set<string>()
  for (const u of allUnits) {
    if (exclude.has(u.id)) continue
    blockers.add(cubeKey(u.position))
  }
  return blockers
}

export function visibleHexesFromUnit(
  unit: UnitState,
  allUnits: ReadonlyArray<UnitState>,
  boardKeys: ReadonlySet<string>,
): Set<string> {
  const visible = new Set<string>()
  const stats = getUnitStatsV2(unit.kind)
  const vision = stats.vision
  if (vision <= 0) return visible

  const blockers = buildBlockers(allUnits, new Set([unit.id]))
  const candidates = spiral(unit.position, vision)
  for (const c of candidates) {
    const key = cubeKey(c)
    if (!boardKeys.has(key)) continue
    if (key === cubeKey(unit.position)) continue
    const blockersForThisHex = new Set(blockers)
    blockersForThisHex.delete(key)
    if (hasLineOfSight(unit.position, c, blockersForThisHex)) {
      visible.add(key)
    }
  }
  return visible
}

export function visibleHexesFromTeam(
  team: 'blue' | 'red',
  allUnits: ReadonlyArray<UnitState>,
  boardKeys: ReadonlySet<string>,
): Set<string> {
  const out = new Set<string>()
  for (const observer of allUnits) {
    if (observer.team !== team) continue
    if (observer.routed) continue
    const cover = visibleHexesFromUnit(observer, allUnits, boardKeys)
    for (const k of cover) out.add(k)
  }
  // Inclure les positions propres des unités alliées (cohérent avec useVisionMap client v1.1).
  for (const u of allUnits) {
    if (u.team !== team) continue
    const k = cubeKey(u.position)
    if (boardKeys.has(k)) out.add(k)
  }
  return out
}

export function visibleEnemiesFromTeam(
  team: 'blue' | 'red',
  allUnits: ReadonlyArray<UnitState>,
  boardKeys: ReadonlySet<string>,
): Map<string, VisibilityLevel> {
  const out = new Map<string, VisibilityLevel>()
  const observers = allUnits.filter(u => u.team === team && !u.routed)
  if (observers.length === 0) return out

  for (const enemy of allUnits) {
    if (enemy.team === team) continue
    if (!boardKeys.has(cubeKey(enemy.position))) continue

    let best: VisibilityLevel = 'hidden'
    for (const obs of observers) {
      const dist = cubeDistance(obs.position, enemy.position)
      const obsVision = getUnitStatsV2(obs.kind).vision
      if (dist > obsVision) continue
      const blockers = buildBlockers(allUnits, new Set([obs.id, enemy.id]))
      if (!hasLineOfSight(obs.position, enemy.position, blockers)) continue
      const candidate: VisibilityLevel = dist <= Math.floor(obsVision / 2) ? 'identified' : 'spotted'
      if (LEVEL_RANK[candidate] > LEVEL_RANK[best]) {
        best = candidate
        if (best === 'identified') break
      }
    }
    if (best !== 'hidden') out.set(enemy.id, best)
  }
  return out
}
