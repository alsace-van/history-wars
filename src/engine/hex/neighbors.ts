// v1.0 (08/05/2026) — Voisins, anneaux, spirale en coordonnees cubiques
import type { Cube } from './types'

/**
 * Les 6 directions d'un hex flat-top, dans l'ordre fixe :
 *   0 = E, 1 = NE, 2 = NW, 3 = W, 4 = SW, 5 = SE.
 *
 * Cet ordre est NON negociable : il est utilise par la mecanique des flancs/dos
 * en Phase 4 (flank(d) = (d + 3) % 6 → dos opposé).
 */
export const HEX_DIRECTIONS: ReadonlyArray<Cube> = [
  { q: +1, r:  0, s: -1 }, // 0 = E
  { q: +1, r: -1, s:  0 }, // 1 = NE
  { q:  0, r: -1, s: +1 }, // 2 = NW
  { q: -1, r:  0, s: +1 }, // 3 = W
  { q: -1, r: +1, s:  0 }, // 4 = SW
  { q:  0, r: +1, s: -1 }, // 5 = SE
]

/**
 * Voisin direct dans une direction donnee. Modulo positif strict pour
 * accepter les directions negatives ou >= 6.
 */
export function neighbor(c: Cube, direction: number): Cube {
  const d = ((direction % 6) + 6) % 6
  const dir = HEX_DIRECTIONS[d]
  return { q: c.q + dir.q, r: c.r + dir.r, s: c.s + dir.s }
}

/**
 * Les 6 voisins de c, dans l'ordre des HEX_DIRECTIONS.
 */
export function neighbors(c: Cube): Cube[] {
  return HEX_DIRECTIONS.map(d => ({
    q: c.q + d.q,
    r: c.r + d.r,
    s: c.s + d.s,
  }))
}

/**
 * Tous les hex a EXACTEMENT distance `radius` du centre.
 * - radius = 0 → [center]
 * - radius = 1 → 6 hex
 * - radius = N → 6 * N hex (pour N >= 1)
 */
export function ring(center: Cube, radius: number): Cube[] {
  if (radius < 0) throw new Error(`ring: radius must be >= 0, got ${radius}`)
  if (radius === 0) return [{ ...center }]

  const result: Cube[] = []
  // On part de center + direction[4] * radius (SW), puis on parcourt les 6 cotes.
  let current: Cube = {
    q: center.q + HEX_DIRECTIONS[4].q * radius,
    r: center.r + HEX_DIRECTIONS[4].r * radius,
    s: center.s + HEX_DIRECTIONS[4].s * radius,
  }
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      result.push(current)
      current = neighbor(current, i)
    }
  }
  return result
}

/**
 * Tous les hex jusqu'a distance `radius` inclus du centre (disque plein).
 * - radius = 0 → 1 hex
 * - radius = 1 → 7 hex (1 + 6)
 * - radius = 2 → 19 hex (1 + 6 + 12)
 */
export function spiral(center: Cube, radius: number): Cube[] {
  if (radius < 0) throw new Error(`spiral: radius must be >= 0, got ${radius}`)
  const result: Cube[] = [{ ...center }]
  for (let r = 1; r <= radius; r++) {
    result.push(...ring(center, r))
  }
  return result
}
