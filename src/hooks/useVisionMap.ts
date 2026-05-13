// v1.3 (13/05/2026) — Fix : ajout spiral(myUnit, movement) dans visibleTileKeys (permet repli unité routed après Rompre)
// v1.2 (13/05/2026) — Fix : ennemi engagé en mêlée avec une de mes unités = toujours 'identified' (même si mon obs est routed)
// v1.1 (12/05/2026) — Fix : utilise cubeKey() au lieu de "q,r,s" custom (mismatch boardKeys = q,r)
// v1.0 (12/05/2026) — Phase 3.1-C : carte de visibilité client (fog évolué)
import { useMemo } from 'react'
import { cubeKey, spiral } from '@engine/hex'
import { visibleEnemiesFromTeam, visibleHexesFromTeam, type VisibilityLevel } from '@engine/vision'
import { getUnitStatsV2, type UnitState } from '@engine/units'
import type { HexTileVisibility } from '@render/types'
import type { EngagementRow } from '@hooks/useEngagement'
import type { Team } from '@/types/game'

interface UseVisionMapParams {
  myTeam: Team | null
  unitStates: ReadonlyArray<UnitState>
  boardKeys: ReadonlySet<string>
  /** Réactive le recalcul à chaque changement de tour (les positions captent déjà
   *  les mouvements intra-tour, activeTeam capture le reset post-EndTurn). */
  activeTeam: Team
  /** Engagements actifs : un ennemi engagé avec une de mes unités est toujours 'identified',
   *  même si mon observateur est routed (on voit forcément qui nous frappe en mêlée). */
  engagementRows: ReadonlyArray<EngagementRow>
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
  const { myTeam, unitStates, boardKeys, activeTeam, engagementRows } = p

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
    // v1.3 fix : on inclut AUSSI le rayon de mouvement (spiral(movement)) pour que l'unité
    //   puisse toujours "voir où elle peut marcher" — y compris quand routed (vision=0).
    //   Sinon une unité broken seule sur le board ne pourrait plus du tout bouger (bug session 21
    //   après "Rompre" : reachableMap filtré par visibleTileKeys = ∅).
    for (const u of unitStates) {
      if (u.team !== myTeam) continue
      const move = getUnitStatsV2(u.kind).movement
      const reach = spiral(u.position, Math.max(1, move))
      for (const c of reach) {
        const k = cubeKey(c)
        if (boardKeys.has(k)) {
          visibleTileMap.set(k, 'visible')
          visibleTileKeys.add(k)
        }
      }
    }

    const enemyVisibility = visibleEnemiesFromTeam(myTeam, unitStates, boardKeys)

    // v1.2 — Override "engagé en mêlée" : un ennemi engagé avec une de mes unités est
    // toujours 'identified', même si mon observateur est routed (sinon on perd la vue
    // de l'unité qui nous attaque, cf. bug session 21 — vision = 0 quand seule unité broken).
    const myUnitIds = new Set<string>()
    for (const u of unitStates) if (u.team === myTeam) myUnitIds.add(u.id)
    for (const e of engagementRows) {
      const myId = myUnitIds.has(e.unit_a_id) ? e.unit_a_id : myUnitIds.has(e.unit_b_id) ? e.unit_b_id : null
      if (!myId) continue
      const enemyId = e.unit_a_id === myId ? e.unit_b_id : e.unit_a_id
      enemyVisibility.set(enemyId, 'identified')
    }

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
  }, [myTeam, unitStates, boardKeys, activeTeam, engagementRows])
}
