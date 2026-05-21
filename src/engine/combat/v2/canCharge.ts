// v1.0 (16/05/2026) — Phase 2.6 UX : helper client pour décider si un mini-popup
//   "Charge / Mêlée" doit s'ouvrir au clic sur un ennemi adjacent.
//
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.
//
// Skip volontaire du check terrain (le client n'a pas de terrainMap accessible
// dans le state UI). Le serveur valide définitivement via isChargeApplicable
// au resolve_action ; si terrain bloque la charge, le multiplicateur retombe à
// 1.0 (mêlée standard, pas de charge_intent appliqué). C'est un faux-positif
// rare et inoffensif.
//
// Prédicats vérifiés côté client :
//  - attacker.kind === 'C'
//  - lastMovePath présent, chargedDistance ≥ 2
//  - path en ligne droite
//  - defender adjacent à la position courante de l'attaquant
import { cubeDistance } from '../../hex'
import type { UnitState } from '../../units/types'
import { chargedDistance, isPathStraight } from './charge'

/**
 * Retourne true si une charge cavalerie EST PROBABLEMENT applicable selon les
 * infos disponibles côté client (sans terrain). Le serveur reste source de
 * vérité — si la charge échoue côté serveur (terrain bloque), la résolution
 * dégrade gracieusement en mêlée sans bonus.
 */
export function canChargeClient(attacker: UnitState, defender: UnitState): boolean {
  if (attacker.kind !== 'C') return false
  const path = attacker.lastMovePath
  if (!path || path.length === 0) return false
  if (chargedDistance(path) < 2) return false
  if (!isPathStraight(path)) return false
  if (cubeDistance(attacker.position, defender.position) !== 1) return false
  return true
}
