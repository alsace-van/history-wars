// v1.0 (14/05/2026) — Phase 4 Lot A2 : mirror Deno port src/engine/ai/picker.ts
// PORT FROM src/engine/ai/picker.ts — DO NOT EDIT MANUALLY.

import { cubeKey, cubeDistance } from '../hex/index.ts'
import { bfsReachable } from '../movement/index.ts'
import { computeEnemyZoc } from '../zoc/index.ts'
import { hasLineOfSight } from '../los/index.ts'
import { getUnitStats, resolveUnitStatsV2 } from '../units.ts'
import type { UnitState } from '../units.ts'
import { scoreAction } from './scorer.ts'
import type { AIAction, AIContext, ScoredAction } from './types.ts'

export function enumerateActions(unit: UnitState, ctx: AIContext): AIAction[] {
  if (unit.routed) return []
  const actions: AIAction[] = [{ kind: 'hold' }]
  const stats = resolveUnitStatsV2(unit.kind, unit.subKind)

  if (!unit.hasAttacked) {
    for (const enemy of ctx.allUnits) {
      if (enemy.team === unit.team) continue
      if (!ctx.visibleEnemyIds.has(enemy.id)) continue
      const dist = cubeDistance(unit.position, enemy.position)
      if (dist < stats.minRange || dist > stats.range) continue
      if (dist > 1 && !stats.arcedTrajectory) {
        const blockers = new Set<string>()
        for (const u of ctx.allUnits) {
          if (u.id === unit.id || u.id === enemy.id) continue
          blockers.add(cubeKey(u.position))
        }
        if (!hasLineOfSight(unit.position, enemy.position, blockers)) continue
      }
      const kind = dist > 1 ? 'attack_ranged' : 'attack_melee'
      actions.push({ kind, targetId: enemy.id })
    }
  }

  if (!unit.hasMoved && !ctx.engagedUnitIds.has(unit.id)) {
    const baseStats = getUnitStats(unit.kind)
    const others = ctx.allUnits.filter(u => u.id !== unit.id)
    const blockers = new Set(others.map(u => cubeKey(u.position)))
    const enemyZoc = computeEnemyZoc(ctx.allUnits, unit.team)
    const reachable = bfsReachable({
      start: unit.position,
      movementPoints: baseStats.movement,
      blockers,
      enemyZocCubes: enemyZoc,
    })
    const startKey = cubeKey(unit.position)
    // MVP Phase 4 : pas de filtre fog (l'IA peut bouger dans le brouillard).
    let count = 0
    for (const k of reachable.keys()) {
      if (k === startKey) continue
      if (!ctx.boardKeys.has(k)) continue
      const [qStr, rStr, sStr] = k.split(',')
      const q = Number(qStr), r = Number(rStr), s = Number(sStr)
      actions.push({ kind: 'move', dest: { q, r, s } })
      if (++count >= 12) break
    }
  }

  return actions
}

export function pickBestActionForUnit(unit: UnitState, ctx: AIContext): AIAction | null {
  if (unit.routed) return null
  const actions = enumerateActions(unit, ctx)
  if (actions.length === 0) return null
  const scored: ScoredAction[] = actions
    .map(a => ({ action: a, score: scoreAction(unit, a, ctx) }))
    .filter(s => s.score > -Infinity)

  if (scored.length === 0) return { kind: 'hold' }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (ctx.profile === 'hard') return offensivePriority(b.action) - offensivePriority(a.action)
    return 0
  })

  if (ctx.profile === 'easy') {
    const top3 = scored.slice(0, Math.min(3, scored.length))
    const idx = Math.floor(ctx.rng() * top3.length)
    return top3[idx].action
  }
  return scored[0].action
}

function offensivePriority(a: AIAction): number {
  switch (a.kind) {
    case 'attack_melee': return 3
    case 'attack_ranged': return 3
    case 'move': return 2
    case 'hold': return 1
  }
}
