// v1.1 (12/05/2026) — Fix : utilise cubeKey() au lieu de "q,r,s" custom (mismatch boardKeys = q,r)
// v1.0 (12/05/2026) — Phase 3.1-C : carte de visibilité client (fog évolué)
import { useMemo } from 'react'
import { cubeKey } from '@engine/hex'
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
    // on ajoute manuellement les positions des unités alliées (le joueur voit ses propres unités).
    // v1.1 fix : utilise cubeKey() (= "q,r") pour matcher boardKeys, pas une clé "q,r,s" custom.
    for (const u of unitStates) {
      if (u.team !== myTeam) continue
      const k = cubeKey(u.position)
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
      const k = cubeKey(enemy.position)
      if (boardKeys.has(k)) {
        visibleTileMap.set(k, 'visible')
        visibleTileKeys.add(k)
      }
    }

    const visibleEnemyIds = new Set<string>(enemyVisibility.keys())

    return { visibleTileMap, enemyVisibility, visibleEnemyIds, visibleTileKeys }
  }, [myTeam, unitStates, boardKeys, activeTeam])
}
