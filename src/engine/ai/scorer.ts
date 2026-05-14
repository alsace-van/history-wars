// v1.1 (14/05/2026) — Fix bot passif si engagé : scoreHold=-50 si engagé (force riposte)
// v1.0 (14/05/2026) — Phase 4 Lot A1 : scoreAction heuristique 1 ply (damage − risk)
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.

import { cubeDistance, cubeKey, type Cube } from '../hex'
import { previewCombatV2 } from '../combat/v2/preview'
import type { AttackPhase } from '../combat/v2/types'
import { DEFAULT_TERRAIN } from '../terrain/types'
import { resolveUnitStatsV2 } from '../units/stats'
import type { UnitState } from '../units/types'
import type { AIAction, AIContext } from './types'

const KILL_BONUS = 30
const CHARGE_BONUS = 10
const HOLD_REGEN_BONUS = 5

function terrainAt(ctx: AIContext, hex: Cube) {
  return ctx.terrainMap.get(cubeKey(hex)) ?? DEFAULT_TERRAIN
}

/** Estime le risque qu'un ennemi nous attaque depuis une position donnée. */
function expectedRiskAt(unit: UnitState, pos: Cube, ctx: AIContext): number {
  let totalRisk = 0
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (!ctx.visibleEnemyIds.has(enemy.id)) continue
    const enemyStats = resolveUnitStatsV2(enemy.kind, enemy.subKind)
    const dist = cubeDistance(pos, enemy.position)
    if (dist > enemyStats.range) continue
    // Preview de l'attaque ennemie sur nous (si on était à `pos`).
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

function scoreAttack(unit: UnitState, target: UnitState, ctx: AIContext): number {
  const distance = cubeDistance(unit.position, target.position)
  const aStats = resolveUnitStatsV2(unit.kind, unit.subKind)
  if (distance > aStats.range || distance < aStats.minRange) return -Infinity
  const phase: AttackPhase = distance > 1 ? 'ranged' : 'melee'

  // Charge bonus si cav, path "synthétique" hypothétique en ligne droite.
  let chargeMult = 1.0
  if (unit.kind === 'C' && distance === 1) {
    // Approximation : on n'a pas le path réel (move pas encore effectué). +10 flat.
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

  // Riposte estimée (melee uniquement).
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
  // Bonus si on peut achever la cible (damageMax >= effective restant).
  if (preview.estimatedDamageMax >= target.effective - target.effectiveMin) {
    score += KILL_BONUS
  }
  if (chargeMult > 1.0) score += CHARGE_BONUS
  return score
}

function scoreMove(unit: UnitState, dest: Cube, ctx: AIContext): number {
  // Heuristique : approcher de l'ennemi le plus faible, en évitant les risques.
  // MVP : l'IA "triche" en voyant TOUS les ennemis (pas seulement visibles). Sinon
  // tous les moves valent 0 en début de partie → bot reste planté. Phase 4-bis :
  // restreindre à visibleEnemyIds quand fog server-side RLS sera en place.
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

function scoreHold(unit: UnitState, ctx: AIContext): number {
  const isEngaged = ctx.engagedUnitIds.has(unit.id)
  // Engagé = au moins 1 ennemi adjacent. Tenir = subir des coups sans riposter.
  // Pénalité forte pour forcer une attaque même si scoreAttack < 0 (mieux taper que mourir passif).
  if (isEngaged) return -50
  // Tenir sa position : bonus si moral bas (régénération attendue tour suivant).
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

// Exports tests-friendly
export { expectedRiskAt, scoreAttack, scoreMove, scoreHold }
