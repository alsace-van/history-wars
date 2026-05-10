// v1.0 (10/05/2026) — Phase 2 2A.7 : detection + multiplicateur charge cavalerie
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.7

import type { Cube } from '../../hex'
import { isChargeAllowed } from '../../terrain/caps'
import type { TerrainType } from '../../terrain/types'
import type { UnitState } from '../../units/types'
import type { CombatConfig } from './types'
import { DEFAULT_COMBAT_CONFIG } from './types'

/**
 * Distance euclidienne stricte entre 2 hex en coord cubiques (= cubeDistance redondant
 * mais on prefere un calcul local pour ne pas creer de cycle).
 * Inline pour eviter dependance fetch.
 */
function cubeDist(a: Cube, b: Cube): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2
}

/**
 * Verifie qu'un chemin (sequence de Cubes) est en ligne droite : chaque pas suit
 * la meme direction unitaire. La direction est determinee par le 1er segment.
 *
 * Robustesse : tolere les chemins de longueur < 2 (toujours "droit"), refuse
 * tout chemin dont 2 segments consecutifs ne sont pas paralleles.
 */
export function isPathStraight(path: ReadonlyArray<Cube>): boolean {
  if (path.length < 3) return true
  const dir0 = {
    q: path[1].q - path[0].q,
    r: path[1].r - path[0].r,
    s: path[1].s - path[0].s,
  }
  for (let i = 2; i < path.length; i++) {
    const d = {
      q: path[i].q - path[i - 1].q,
      r: path[i].r - path[i - 1].r,
      s: path[i].s - path[i - 1].s,
    }
    if (d.q !== dir0.q || d.r !== dir0.r || d.s !== dir0.s) return false
  }
  return true
}

/**
 * Distance parcourue en charge (longueur effective du dernier segment de mouvement).
 * Convention : path = [start, hex1, hex2, ..., final]. distance = path.length - 1.
 * Si path est vide ou 1 element, distance = 0.
 */
export function chargedDistance(path: ReadonlyArray<Cube>): number {
  return path.length === 0 ? 0 : path.length - 1
}

/**
 * Multiplicateur de charge selon la distance parcourue en ligne droite avant impact.
 *  2 hex   → 1.3
 *  3 hex   → 1.4
 *  4+ hex  → 1.5 (plafond)
 *  < 2 hex → 1.0 (pas de bonus)
 */
export function chargeMultiplier(
  distance: number,
  config: CombatConfig = DEFAULT_COMBAT_CONFIG,
): number {
  if (distance < 2) return 1.0
  if (distance === 2) return config.chargeMultipliers.two
  if (distance === 3) return config.chargeMultipliers.three
  return config.chargeMultipliers.fourPlus
}

export interface ChargeContext {
  /** Pion attaquant. Doit etre kind='C' pour eligibilite. */
  readonly attacker: UnitState
  /** Pion defenseur (utilise pour adjacence). */
  readonly defender: UnitState
  /** Trajectoire effective de l'attaquant ce tour (alimente par EF move). */
  readonly path: ReadonlyArray<Cube>
  /** Type de terrain pour chaque hex du path (longueur identique a path). */
  readonly pathTerrain: ReadonlyArray<TerrainType>
}

/**
 * Charge applicable si :
 *  - attacker.kind === 'C'
 *  - chargedDistance(path) >= 2
 *  - path est en ligne droite (isPathStraight)
 *  - tous les terrains du path autorisent la charge (chargeAllowed === true)
 *  - le defenseur est adjacent a la position finale du path
 */
export function isChargeApplicable(ctx: ChargeContext): boolean {
  if (ctx.attacker.kind !== 'C') return false
  if (chargedDistance(ctx.path) < 2) return false
  if (!isPathStraight(ctx.path)) return false
  for (const terrain of ctx.pathTerrain) {
    if (!isChargeAllowed(terrain)) return false
  }
  // adjacence finale path[last] / defender.position
  const last = ctx.path[ctx.path.length - 1]
  if (!last) return false
  return cubeDist(last, ctx.defender.position) === 1
}
