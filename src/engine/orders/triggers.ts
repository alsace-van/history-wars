// v1.0 (13/05/2026) — Phase 3.2 Vague A : prédicats triggers ordres conditionnels
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.

import { cubeDistance } from '../hex'
import type { UnitState } from '../units/types'
import type { EvaluateOrdersContext, OrderTrigger } from './types'

/**
 * Trigger `on_attacked` : l'unité est actuellement engagée en mêlée (au moins 1
 * engagement persistant actif). Cohérent avec la sémantique Phase 2.6 : être
 * engagé = avoir subi (et subir) une attaque.
 *
 * Pas de fenêtre temporelle "le tour dernier" — la table engagements capture
 * persistance jusqu'à dissolution / rupture.
 */
export function isOnAttacked(unit: UnitState, ctx: EvaluateOrdersContext): boolean {
  return ctx.engagedUnitIds.has(unit.id)
}

/**
 * Trigger `enemy_in_range` : au moins 1 ennemi visible (≥ spotted) à distance
 * ≤ `trigger.params.range`. Fog Phase 3.1 respecté : ennemis hidden invisibles
 * donc ne déclenchent pas.
 *
 * Si `range` non défini → fallback 1 (adjacent only, sécurité).
 */
export function isEnemyInRange(
  unit: UnitState,
  trigger: OrderTrigger,
  ctx: EvaluateOrdersContext,
): boolean {
  const range = trigger.params?.range ?? 1
  if (range <= 0) return false
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (!ctx.visibleEnemyIds.has(enemy.id)) continue
    if (cubeDistance(unit.position, enemy.position) <= range) return true
  }
  return false
}

/**
 * Trigger `cohesion_broken` : la cohésion de l'unité est `broken`.
 * Lecture depuis le contexte (cohesionByUnit calculé par le caller).
 */
export function isCohesionBroken(unit: UnitState, ctx: EvaluateOrdersContext): boolean {
  return ctx.cohesionByUnit.get(unit.id) === 'broken'
}

/**
 * Trigger `enemy_los` : au moins 1 ennemi avec LoS dégagée ET visible (spotted+).
 * Cohérent avec engine/vision (visibleEnemyIds contient déjà les ennemis avec LoS).
 *
 * Équivaut à "il existe au moins 1 ennemi visible" — utilisé surtout par les
 * unités à distance (archer/artillerie) qui veulent tirer dès qu'elles voient.
 */
export function isEnemyLos(unit: UnitState, ctx: EvaluateOrdersContext): boolean {
  for (const enemy of ctx.allUnits) {
    if (enemy.team === unit.team) continue
    if (ctx.visibleEnemyIds.has(enemy.id)) return true
  }
  return false
}

/**
 * Dispatcher : retourne true si le trigger se déclenche pour l'unité dans le contexte.
 * Pure fn, pas de mutation.
 */
export function evaluateTrigger(
  unit: UnitState,
  trigger: OrderTrigger,
  ctx: EvaluateOrdersContext,
): boolean {
  switch (trigger.kind) {
    case 'on_attacked': return isOnAttacked(unit, ctx)
    case 'enemy_in_range': return isEnemyInRange(unit, trigger, ctx)
    case 'cohesion_broken': return isCohesionBroken(unit, ctx)
    case 'enemy_los': return isEnemyLos(unit, ctx)
    default: {
      // Exhaustiveness check (TS strict). Si nouveau kind ajouté, le compilo râle.
      const _exhaustive: never = trigger.kind
      return _exhaustive
    }
  }
}
