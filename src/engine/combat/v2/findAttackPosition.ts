// v1.0 (16/05/2026) — Phase 2.6 refonte attaque : helper unique pour résoudre la
//   position d'attaque d'une unité quel que soit son kind. Permet au client de
//   pré-calculer la case d'arrivée + path à envoyer au serveur, et au serveur
//   de valider symétriquement.
//
// Comportement par kind :
//  - Cav (C)  : voisins adjacents au défenseur, trié par (path droit + longueur
//               max d'abord, sinon par length asc). Maximise le bonus charge.
//  - Inf (I)  : voisins adjacents au défenseur, trié par length asc (chemin court).
//  - Art (A)  : si défenseur déjà à portée (minRange..range) → pas de move.
//               Sinon : énumère reachable hex, garde ceux où dist(dest,def) est
//               dans [minRange, range] + LoS clear (sauf arcedTrajectory).
//               Trié par length asc (move minimal).
//
// Frontière engine/ : zéro React, zéro Three, zéro Supabase.

import { cubeDistance, cubeKey, neighbors, type Cube } from '../../hex'
import { hasLineOfSight } from '../../los'
import { aStar } from '../../movement/path'
import { bfsReachable } from '../../movement/range'
import { resolveUnitStatsV2 } from '../../units/stats'
import type { UnitState } from '../../units/types'
import { computeEnemyZoc } from '../../zoc'
import { isPathStraight } from './charge'

export interface FindAttackPositionArgs {
  readonly attacker: UnitState
  readonly defender: UnitState
  readonly allUnits: ReadonlyArray<UnitState>
  readonly boardKeys: ReadonlySet<string>
  /**
   * OPTIMISATION perf — bfsReachable pré-calculé pour l'attaquant. Évite de
   * relancer un BFS par appel (quand le caller invoque findAttackPosition pour
   * N ennemis dans la même session, le résultat de BFS est identique).
   *
   * Si fourni, on l'utilise pour filtrer les voisins candidats et pour
   * l'auto-position ranged. Si absent, on retombe sur les calculs internes
   * (aStar pour mêlée, bfsReachable pour ranged).
   */
  readonly precomputedReachable?: ReadonlyMap<string, number>
  /**
   * OPTIMISATION perf — blockers + enemyZoc pré-calculés. Évite de recompute
   * Set<string> par appel. Si absent, calcul inline.
   */
  readonly precomputedBlockers?: ReadonlySet<string>
  readonly precomputedEnemyZoc?: ReadonlySet<string>
}

export interface AttackPositionResult {
  /** Case d'arrivée de l'attaquant. Si égale à attacker.position : pas de move requis. */
  readonly dest: Cube
  /** Path effectif (inclut start ET dest). Vide [] si pas de move. */
  readonly path: ReadonlyArray<Cube>
  /**
   * True si on s'attend à ce qu'une charge cav s'applique (path droit ≥ 2 hex
   * + adjacent au défenseur). Le serveur fait la décision finale via
   * isChargeApplicable + check terrain. Hint UI : afficher couleur "charge"
   * vs "march" différenciée.
   */
  readonly expectStraight: boolean
}

/**
 * Calcule la meilleure position d'attaque pour `attacker` contre `defender`,
 * en tenant compte du kind (mêlée vs ranged + préférence charge cav).
 *
 * Retourne `null` si :
 *  - aucun voisin libre autour du défenseur (mêlée)
 *  - défenseur hors de movement+range (ranged)
 *  - aucune position permet LoS clear (ranged non-arced)
 *  - attaquant a déjà bougé / déjà attaqué
 */
export function findAttackPosition(args: FindAttackPositionArgs): AttackPositionResult | null {
  const { attacker, defender, allUnits, boardKeys, precomputedReachable, precomputedBlockers, precomputedEnemyZoc } = args

  if (attacker.team === defender.team) return null
  if (attacker.id === defender.id) return null
  if (attacker.hasAttacked) return null

  const stats = resolveUnitStatsV2(attacker.kind, attacker.subKind)
  const movement = attacker.hasMoved ? 0 : stats.movement

  // OPTIMISATION : early-skip si le défenseur est manifestement hors d'atteinte.
  // Évite de lancer aStar/bfsReachable pour des ennemis distants → critique pour
  // la performance quand attackTargets recompute sur chaque render avec N enemies.
  const directDist = cubeDistance(attacker.position, defender.position)
  // Pour mêlée (range=1) : l'attaquant doit se mettre adjacent au défenseur.
  // Distance après move minimal = directDist - movement. On veut ≥ 1 (adjacent ou plus).
  // → on rejette si directDist > movement + 1.
  // Pour ranged : l'attaquant doit avoir le défenseur dans [minRange, range].
  // Distance minimale atteignable après movement = max(0, directDist - movement).
  // → on rejette si distance minimale > range.
  if (stats.range === 1) {
    if (directDist > movement + 1) return null
  } else {
    const minReachableDist = Math.max(0, directDist - movement)
    if (minReachableDist > stats.range) return null
  }

  // Blockers + ZoC : préférer les versions pré-calculées (évite N×O(N) par appel
  // quand le caller batch sur plusieurs ennemis).
  let blockers: ReadonlySet<string>
  if (precomputedBlockers) {
    blockers = precomputedBlockers
  } else {
    const tmp = new Set<string>()
    for (const u of allUnits) {
      if (u.id === attacker.id) continue
      tmp.add(cubeKey(u.position))
    }
    blockers = tmp
  }
  const enemyZoc = precomputedEnemyZoc ?? computeEnemyZoc(allUnits, attacker.team)

  if (stats.range === 1) {
    // Mêlée : cherche le meilleur voisin adjacent au défenseur.
    return findMeleeLandingHex(attacker, defender, movement, blockers, enemyZoc, boardKeys, precomputedReachable)
  }

  // Ranged (artillerie) : check si déjà à portée + LoS clear.
  if (directDist >= stats.minRange && directDist <= stats.range) {
    // Vérifier LoS depuis position courante (sauf arcedTrajectory).
    if (stats.arcedTrajectory || hasLineOfSightFrom(attacker.position, defender.position, allUnits, attacker.id, defender.id)) {
      return { dest: attacker.position, path: [], expectStraight: false }
    }
  }

  // Sinon : auto-position dans une case reachable où le défenseur est à portée + LoS.
  return findRangedAttackPosition(attacker, defender, movement, blockers, enemyZoc, boardKeys, allUnits, stats, precomputedReachable)
}

// ----------------------------------------------------------------------------
// Helpers internes
// ----------------------------------------------------------------------------

function findMeleeLandingHex(
  attacker: UnitState,
  defender: UnitState,
  movement: number,
  blockers: ReadonlySet<string>,
  enemyZoc: ReadonlySet<string>,
  boardKeys: ReadonlySet<string>,
  precomputedReachable: ReadonlyMap<string, number> | undefined,
): AttackPositionResult | null {
  const candidates: { dest: Cube; path: ReadonlyArray<Cube>; straight: boolean; length: number }[] = []

  for (const n of neighbors(defender.position)) {
    const k = cubeKey(n)
    if (!boardKeys.has(k)) continue
    if (blockers.has(k)) continue
    // Si attaquant déjà adjacent au défenseur ET ce voisin == sa position → pas de move,
    // c'est de la mêlée directe (dest = position, path = []).
    if (n.q === attacker.position.q && n.r === attacker.position.r) {
      candidates.push({ dest: attacker.position, path: [], straight: false, length: 0 })
      continue
    }
    if (movement === 0) continue  // pas de mouvement restant pour atteindre ce voisin
    // OPTIM : si reachable pré-calculé fourni, vérifier accessibility AVANT
    // d'appeler aStar (très chère).
    if (precomputedReachable && !precomputedReachable.has(k)) continue
    if (precomputedReachable) {
      const cost = precomputedReachable.get(k)!
      if (cost > movement) continue
    }
    const path = aStar({ start: attacker.position, goal: n, blockers, enemyZocCubes: enemyZoc })
    if (!path) continue
    const len = path.length - 1
    if (len > movement) continue
    const straight = attacker.kind === 'C' && isPathStraight(path) && len >= 2
    candidates.push({ dest: n, path, straight, length: len })
  }

  if (candidates.length === 0) return null

  // Tri pour cav : straight + long en premier, puis non-straight par length asc.
  // Pour inf/art : length asc uniquement.
  candidates.sort((a, b) => {
    if (attacker.kind === 'C') {
      if (a.straight !== b.straight) return a.straight ? -1 : 1
      if (a.straight && b.straight) return b.length - a.length  // longer = better bonus
    }
    return a.length - b.length
  })

  const best = candidates[0]
  return { dest: best.dest, path: best.path, expectStraight: best.straight }
}

function findRangedAttackPosition(
  attacker: UnitState,
  defender: UnitState,
  movement: number,
  blockers: ReadonlySet<string>,
  enemyZoc: ReadonlySet<string>,
  boardKeys: ReadonlySet<string>,
  allUnits: ReadonlyArray<UnitState>,
  stats: { range: number; minRange: number; arcedTrajectory?: boolean },
  precomputedReachable: ReadonlyMap<string, number> | undefined,
): AttackPositionResult | null {
  if (movement === 0) return null

  // OPTIM : réutiliser le BFS pré-calculé si fourni (sinon recompute inline).
  const reachable = precomputedReachable ?? bfsReachable({
    start: attacker.position,
    movementPoints: movement,
    blockers,
    enemyZocCubes: enemyZoc,
  })

  // OPTIM : on cherche d'abord la meilleure dest (plus courte) AVANT de
  // calculer un path. Évite N appels aStar quand on n'en a besoin que d'1.
  let bestKey: string | null = null
  let bestCost = Infinity
  let bestDest: Cube | null = null
  for (const [k, cost] of reachable) {
    if (cost === 0) continue
    if (!boardKeys.has(k)) continue
    if (cost >= bestCost) continue  // on a déjà mieux
    const [qStr, rStr] = k.split(',')
    const q = Number(qStr)
    const r = Number(rStr)
    const dest: Cube = { q, r, s: -q - r }
    const dist = cubeDistance(dest, defender.position)
    if (dist < stats.minRange || dist > stats.range) continue
    if (!stats.arcedTrajectory && !hasLineOfSightFrom(dest, defender.position, allUnits, attacker.id, defender.id)) continue
    bestKey = k
    bestCost = cost
    bestDest = dest
  }

  if (!bestDest || !bestKey) return null

  // 1 seul aStar pour récupérer le path effectif.
  const path = aStar({ start: attacker.position, goal: bestDest, blockers, enemyZocCubes: enemyZoc })
  if (!path) return null
  return { dest: bestDest, path, expectStraight: false }
}

function hasLineOfSightFrom(
  from: Cube,
  to: Cube,
  allUnits: ReadonlyArray<UnitState>,
  attackerId: string,
  defenderId: string,
): boolean {
  // Blockers LoS = autres unités (hors attaquant et défenseur). Mirror handleAttack.ts.
  const losBlockers = new Set<string>()
  for (const u of allUnits) {
    if (u.id === attackerId || u.id === defenderId) continue
    losBlockers.add(cubeKey(u.position))
  }
  return hasLineOfSight(from, to, losBlockers)
}
