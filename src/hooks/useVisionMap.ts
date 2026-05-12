// v1.0 (12/05/2026) — Phase 3.1-C : carte de visibilité client (fog évolué)
// Calcule en un seul useMemo :
//   - visibleTileMap : Map<cubeKey, HexTileVisibility> ('visible' pour les hex couverts, sinon absent = 'hidden').
//   - enemyVisibility : Map<unitId, VisibilityLevel> pour les ennemis observés.
//   - visibleEnemyIds : Set<unitId> dérivé (compat existing useTacticalSelection).
//
// Clé de mémo = unitStates + myTeam + boardKeys + activeTeam.
// Recalculé à chaque tour (activeTeam change) ou à chaque modification de unitStates.
// Pas de "mémoire de terrain" (state 'fog' pour hex précédemment vus) — réservé Phase 4.
import { useMemo } from 'react'
import { visibleEnemiesFromTeam, visibleHexesFromTeam, type VisibilityLevel } from '@engine/vision'
import type { UnitState } from '@engine/units'
import type { HexTileVisibility } from '@render/types'
import type { Team } from '@/types/game'

interface UseVisionMapParams {
  myTeam: Team | null
  unitStates: ReadonlyArray<UnitState>
  boardKeys: ReadonlySet<string>
  /** Réactive le recalcul à chaque changement de tour (les positions captent déjà
   *  les mouvements intra-tour, activeTeam capture le reset post-EndTurn). */
  activeTeam: Team
}

export interface UseVisionMapResult {
  /** Visibilité par cubeKey. 'visible' si la team y voit, key absente = 'hidden'. */
  visibleTileMap: Map<string, HexTileVisibility>
  /** Niveau d'identification des ennemis. Key absente = 'hidden'. */
  enemyVisibility: Map<string, VisibilityLevel>
  /** Set des unitId ennemis ≥ 'spotted' (lookup rapide pour ZoC/highlight). */
  visibleEnemyIds: Set<string>
  /** Set des cubeKey visibles (réutilisable côté useTacticalSelection). */
  visibleTileKeys: Set<string>
}

/**
 * Sans myTeam (hors bataille ou spectateur) → retourne des conteneurs vides.
 * L'UI consommatrice doit alors fallback sur le comportement "tout visible" en lobby
 * (ce que Game.tsx fait : ne passe tileVisibility à TacticalScene que si showBattle).
 */
export function useVisionMap(p: UseVisionMapParams): UseVisionMapResult {
  const { myTeam, unitStates, boardKeys, activeTeam } = p

  return useMemo<UseVisionMapResult>(() => {
    if (!myTeam) {
      return {
        visibleTileMap: new Map(),
        enemyVisibility: new Map(),
        visibleEnemyIds: new Set(),
        visibleTileKeys: new Set(),
      }
    }

    const visibleTileKeys = visibleHexesFromTeam(myTeam, unitStates, boardKeys)
    const visibleTileMap = new Map<string, HexTileVisibility>()
    for (const k of visibleTileKeys) visibleTileMap.set(k, 'visible')

    // L'hex de l'unité observatrice n'est pas dans son propre cover (cf. visibleHexesFromUnit) :
    // on ajoute manuellement les positions des unités alliées non-routed (le joueur voit ses propres unités).
    for (const u of unitStates) {
      if (u.team !== myTeam) continue
      // On retourne 'visible' même si routed (l'unité existe pour le joueur).
      const k = `${u.position.q},${u.position.r},${u.position.s}`
      if (boardKeys.has(k)) {
        visibleTileMap.set(k, 'visible')
        visibleTileKeys.add(k)
      }
    }

    const enemyVisibility = visibleEnemiesFromTeam(myTeam, unitStates, boardKeys)

    // Les hex occupés par des ennemis ≥ 'spotted' deviennent visibles (sinon la silhouette
    // serait dessinée sur une case 'hidden' noire — incohérent).
    for (const enemy of unitStates) {
      if (enemy.team === myTeam) continue
      const lvl = enemyVisibility.get(enemy.id)
      if (!lvl) continue
      const k = `${enemy.position.q},${enemy.position.r},${enemy.position.s}`
      if (boardKeys.has(k)) {
        visibleTileMap.set(k, 'visible')
        visibleTileKeys.add(k)
      }
    }

    const visibleEnemyIds = new Set<string>(enemyVisibility.keys())

    return { visibleTileMap, enemyVisibility, visibleEnemyIds, visibleTileKeys }
  }, [myTeam, unitStates, boardKeys, activeTeam])
}
