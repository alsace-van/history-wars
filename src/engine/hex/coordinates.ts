// v1.0 (08/05/2026) — Conversions cube/axial/world flat-top
import type { Cube, Axial } from './types'

const SQRT3 = Math.sqrt(3)

/** Normalise -0 en +0 pour la coherence des comparaisons strictes */
const nz = (x: number): number => (x === 0 ? 0 : x)

/**
 * Construit un Cube. Si s n'est pas fourni, il est deduit (s = -q - r).
 * Si fourni, verifie l'invariant q + r + s === 0 (en dev).
 */
export function cube(q: number, r: number, s?: number): Cube {
  const sFinal = s ?? -q - r
  if (s !== undefined && Math.abs(q + r + s) > 1e-9) {
    throw new Error(`Cube invariant violated: q+r+s = ${q + r + s} (expected 0)`)
  }
  return { q: nz(q), r: nz(r), s: nz(sFinal) }
}

export function axialToCube(a: Axial): Cube {
  return { q: nz(a.q), r: nz(a.r), s: nz(-a.q - a.r) }
}

export function cubeToAxial(c: Cube): Axial {
  return { q: c.q, r: c.r }
}

export function cubesEqual(a: Cube, b: Cube): boolean {
  return a.q === b.q && a.r === b.r && a.s === b.s
}

/**
 * Cube → coordonnees monde 2D, orientation flat-top.
 * Formule de reference : Red Blob Games.
 *   x = hexSize * (3/2) * q
 *   y = hexSize * sqrt(3) * (r + q/2)
 */
export function cubeToWorld(c: Cube, hexSize: number): { x: number; y: number } {
  const x = hexSize * 1.5 * c.q
  const y = hexSize * SQRT3 * (c.r + c.q / 2)
  return { x, y }
}

/**
 * Inverse de cubeToWorld pour un point 2D arbitraire.
 * Le point peut tomber a la frontiere de plusieurs hex : on round vers le plus proche.
 */
export function worldToCube(x: number, y: number, hexSize: number): Cube {
  const qf = (2 / 3) * x / hexSize
  const rf = (-1 / 3) * x / hexSize + (SQRT3 / 3) * y / hexSize
  const sf = -qf - rf
  return cubeRound(qf, rf, sf)
}

/**
 * Arrondit un cube fractionnaire au cube entier le plus proche, en preservant
 * l'invariant q+r+s=0. La composante avec le plus grand ecart est derivee
 * des deux autres.
 */
export function cubeRound(qf: number, rf: number, sf: number): Cube {
  let q = Math.round(qf)
  let r = Math.round(rf)
  let s = Math.round(sf)

  const qDiff = Math.abs(q - qf)
  const rDiff = Math.abs(r - rf)
  const sDiff = Math.abs(s - sf)

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s
  } else if (rDiff > sDiff) {
    r = -q - s
  } else {
    s = -q - r
  }

  return { q: nz(q), r: nz(r), s: nz(s) }
}
