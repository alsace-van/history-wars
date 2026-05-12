// v1.0 (12/05/2026) — Phase 3.1-A : fog of war évolué (vision range + LoS + niveau spotted/identified)
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.
// Source : docs/PLAN-PHASE-3-FOG.md (à créer Vague D) + plan on-demarre-la-phase-silly-reddy.md.
import { cubeDistance, cubeKey, spiral } from '../hex'
import { hasLineOfSight } from '../los'
import { getUnitStatsV2 } from '../units'
import type { UnitState } from '../units'
import type { Team } from '../../types/game'

/**
 * Niveau d'identification d'un ennemi :
 *  - `hidden`     : invisible, masqué côté UI.
 *  - `spotted`    : silhouette détectée (distance ≤ vision), kind/effectif imprécis.
 *  - `identified` : observé de près (distance ≤ floor(vision/2)), stats publiques lisibles.
 */
export type VisibilityLevel = 'hidden' | 'spotted' | 'identified'

const LEVEL_RANK: Record<VisibilityLevel, number> = { hidden: 0, spotted: 1, identified: 2 }

/**
 * Recompose le Set des positions occupées (cubeKey) par les autres unités.
 * Sert de blockers à `hasLineOfSight`. Convention Phase 1.5 (piège #15) :
 * alliées ET ennemies bloquent.
 */
function buildBlockers(allUnits: ReadonlyArray<UnitState>, exclude: ReadonlySet<string>): Set<string> {
  const blockers = new Set<string>()
  for (const u of allUnits) {
    if (exclude.has(u.id)) continue
    blockers.add(cubeKey(u.position))
  }
  return blockers
}

/**
 * Ensemble des hex visibles depuis `unit` (BFS limité par vision + LoS).
 * L'hex de départ est exclu (l'unité voit sa propre case par construction, mais
 * on n'a pas besoin de l'inclure pour le filtrage UI).
 *
 * Convention LoS : un allié sur la trajectoire bloque aussi la vue.
 */
export function visibleHexesFromUnit(
  unit: UnitState,
  allUnits: ReadonlyArray<UnitState>,
  boardKeys: ReadonlySet<string>,
): Set<string> {
  const visible = new Set<string>()
  const stats = getUnitStatsV2(unit.kind)
  const vision = stats.vision
  if (vision <= 0) return visible

  // Blockers = toutes les unités sauf l'observateur lui-même.
  const blockers = buildBlockers(allUnits, new Set([unit.id]))

  // spiral inclut le centre + tous les hex à distance ≤ vision.
  const candidates = spiral(unit.position, vision)
  for (const c of candidates) {
    const key = cubeKey(c)
    if (!boardKeys.has(key)) continue
    if (key === cubeKey(unit.position)) continue
    // hasLineOfSight ignore les extrémités → un blocker SUR la case cible n'invalide pas la vue.
    // Mais on veut quand même filtrer : on retire la cible du set blockers en lui passant un set qui exclut sa key.
    const targetKey = key
    const blockersForThisHex = new Set(blockers)
    blockersForThisHex.delete(targetKey)
    if (hasLineOfSight(unit.position, c, blockersForThisHex)) {
      visible.add(key)
    }
  }
  return visible
}

/**
 * Union des couvertures `visibleHexesFromUnit` pour toutes les unités non-routed
 * du `team`. C'est la carte de visibilité agrégée du joueur côté UI.
 */
export function visibleHexesFromTeam(
  team: Team,
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
  return out
}

/**
 * Pour chaque unité ennemie au `team` observateur, calcule le meilleur niveau
 * de visibilité (identified > spotted > hidden) parmi tous les observateurs alliés.
 *
 *  - identified : distance ≤ floor(vision/2) ET LoS.
 *  - spotted    : distance ≤ vision ET LoS.
 *  - hidden     : sinon (n'apparaît pas dans la map).
 *
 * Une unité routed ne compte pas comme observateur (cohérent avec
 * `visibleHexesFromTeam`). En revanche, un ennemi routed PEUT être vu.
 */
export function visibleEnemiesFromTeam(
  team: Team,
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

      // LoS : blockers = toutes les unités sauf l'observateur et la cible (cohérent
      // avec useTacticalSelection.targetableUnitIds et engine combat).
      const blockers = buildBlockers(allUnits, new Set([obs.id, enemy.id]))
      if (!hasLineOfSight(obs.position, enemy.position, blockers)) continue

      const candidate: VisibilityLevel = dist <= Math.floor(obsVision / 2) ? 'identified' : 'spotted'
      if (LEVEL_RANK[candidate] > LEVEL_RANK[best]) {
        best = candidate
        if (best === 'identified') break // déjà le max
      }
    }
    if (best !== 'hidden') out.set(enemy.id, best)
  }
  return out
}

/**
 * Helper pour conserver l'API symétrique : récupère le niveau de visibilité
 * d'un ennemi spécifique. Retourne 'hidden' si la Map ne contient pas l'id.
 */
export function getVisibilityLevel(
  enemyId: string,
  enemyVisibility: ReadonlyMap<string, VisibilityLevel>,
): VisibilityLevel {
  return enemyVisibility.get(enemyId) ?? 'hidden'
}

// Garde-fou interne (pas exposé) : surface de lookup compte-tenu de spiral().
// Si vision === 0 → spiral retourne juste le centre → set vide après filtrage centre.
// Ce comportement reste cohérent même pour vision atypique (≤ 0).
// Utilisé par les tests.
export const __internals__ = {
  buildBlockers,
} as const
