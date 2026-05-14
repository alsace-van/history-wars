// v1.1 (14/05/2026) — Fix bot passif si engagé : scoreHold=-50 si engagé (force riposte)
// v1.0 (14/05/2026) — Phase 4 Lot A2 : mirror Deno port src/engine/ai/scorer.ts
// PORT FROM src/engine/ai/scorer.ts — DO NOT EDIT MANUALLY.

import { cubeDistance, cubeKey, type Cube } from '../hex/index.ts'
import { previewCombatV2 } from '../combat/v2/preview.ts'
import type { AttackPhase } from '../combat/v2/types.ts'
import { DEFAULT_TERRAIN } from '../terrain/types.ts'
import { resolveUnitStatsV2 } from '../units.ts'
import type { UnitState } from '../units.ts'
import type { AIAction, AIContext } from './types.ts'

const KILL_BONUS = 30
const CHARGE_BONUS = 10
const HOLD_REGEN_BONUS = 5

function terrainAt(ctx: AIContext, hex: Cube) {
  return ctx.terrainMap.get(cubeKey(hex)) ?? DEFAULT_TERRAIN
}

export function expectedRiskAt(unit: UnitState, pos: Cube, ctx: AIContext): number {
  let totalRisk = 0
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (!ctx.visibleEnemyIds.has(enemy.id)) continue
    const enemyStats = resolveUnitStatsV2(enemy.kind, enemy.subKind)
    const dist = cubeDistance(pos, enemy.position)
    if (dist > enemyStats.range) continue
    const fakeMe: UnitState = { ...unit, position: pos }
    const phase: AttackPhase = dist > 1 ? 'ranged' : 'melee'
    const preview = previewCombatV2({
      attacker: enemy,
      defender: fakeMe,
      phase,
      attackerTerrain: terrainAt(ctx, enemy.position),
      defenderTerrain: terrainAt(ctx, pos),
      distance: dist,
      chargeMult: 1.0,
      config: ctx.combatConfig,
    })
    totalRisk += preview.estimatedDamageMax
  }
  return totalRisk
}

export function scoreAttack(unit: UnitState, target: UnitState, ctx: AIContext): number {
  const distance = cubeDistance(unit.position, target.position)
  const aStats = resolveUnitStatsV2(unit.kind, unit.subKind)
  if (distance > aStats.range || distance < aStats.minRange) return -Infinity
  const phase: AttackPhase = distance > 1 ? 'ranged' : 'melee'

  let chargeMult = 1.0
  if (unit.kind === 'C' && distance === 1) {
    chargeMult = 1.3
  }

  const preview = previewCombatV2({
    attacker: unit,
    defender: target,
    phase,
    attackerTerrain: terrainAt(ctx, unit.position),
    defenderTerrain: terrainAt(ctx, target.position),
    distance,
    chargeMult,
    config: ctx.combatConfig,
  })

  let riskBack = 0
  if (phase === 'melee' && target.effective > target.effectiveMin) {
    const ripost = previewCombatV2({
      attacker: target,
      defender: unit,
      phase: 'melee',
      attackerTerrain: terrainAt(ctx, target.position),
      defenderTerrain: terrainAt(ctx, unit.position),
      distance: 1,
      chargeMult: 1.0,
      config: ctx.combatConfig,
    })
    riskBack = ripost.estimatedDamageMax
  }

  let score = preview.estimatedDamageMax - riskBack
  if (preview.estimatedDamageMax >= target.effective - target.effectiveMin) {
    score += KILL_BONUS
  }
  if (chargeMult > 1.0) score += CHARGE_BONUS
  return score
}

export function scoreMove(unit: UnitState, dest: Cube, ctx: AIContext): number {
  // MVP : l'IA voit tous les ennemis (cheat assumé). Phase 4-bis : restreindre à visibleEnemyIds.
  let bestApproach = 0
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    const distNow = cubeDistance(unit.position, enemy.position)
    const distAfter = cubeDistance(dest, enemy.position)
    const weakness = 1 - (enemy.effective / enemy.effectiveMax)
    const approach = (distNow - distAfter) * (1 + weakness * 2)
    if (approach > bestApproach) bestApproach = approach
  }
  const risk = expectedRiskAt(unit, dest, ctx)
  return bestApproach * 10 - risk
}

export function scoreHold(unit: UnitState, ctx: AIContext): number {
  const isEngaged = ctx.engagedUnitIds.has(unit.id)
  // Engagé : pénalité forte (subir 1 attaque/ennemi adjacent sans riposter = suicide passif).
  if (isEngaged) return -50
  if (unit.morale < 50) return HOLD_REGEN_BONUS
  return 0
}

export function scoreAction(unit: UnitState, action: AIAction, ctx: AIContext): number {
  switch (action.kind) {
    case 'attack_melee':
    case 'attack_ranged': {
      const target = ctx.allUnits.find(u => u.id === action.targetId)
      if (!target) return -Infinity
      return scoreAttack(unit, target, ctx)
    }
    case 'move':
      return scoreMove(unit, action.dest, ctx)
    case 'hold':
      return scoreHold(unit, ctx)
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}
