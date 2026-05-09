// v1.0 (08/05/2026) — Trace de ligne droite hex (utile Phase 3 ligne de vue)
import type { Cube } from './types'
import { cubeDistance } from './distance'
import { cubeRound } from './coordinates'

/**
 * Interpolation lineaire entre 2 cubes a t ∈ [0, 1].
 * Le resultat n'est pas necessairement un cube entier — usage interne pour line.
 */
export function cubeLerp(a: Cube, b: Cube, t: number): Cube {
  return {
    q: a.q + (b.q - a.q) * t,
    r: a.r + (b.r - a.r) * t,
    s: a.s + (b.s - a.s) * t,
  }
}

/**
 * Liste des hex traverses par la ligne droite de a a b, inclus.
 * - Si a === b, retourne [a].
 * - Premier element = a, dernier = b.
 *
 * Cas limite : si la ligne passe pile sur une frontiere d'hex (ambiguite),
 * on epsilon-shifte la ligne vers a pour rendre le resultat deterministe.
 */
export function cubeLineDraw(a: Cube, b: Cube): Cube[] {
  const N = cubeDistance(a, b)
  if (N === 0) return [{ ...a }]

  // Epsilon shift pour eviter les ties sur les frontieres d'hex
  const aNudged: Cube = {
    q: a.q + 1e-6,
    r: a.r + 1e-6,
    s: a.s - 2e-6,
  }
  const bNudged: Cube = {
    q: b.q + 1e-6,
    r: b.r + 1e-6,
    s: b.s - 2e-6,
  }

  const result: Cube[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const lerped = cubeLerp(aNudged, bNudged, t)
    result.push(cubeRound(lerped.q, lerped.r, lerped.s))
  }
  return result
}
