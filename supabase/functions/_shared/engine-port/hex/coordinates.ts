// v1.1 (09/05/2026) — Phase 1 L1B.4a : ajout cubeRound (necessaire pour line.ts)
// v1.0 (09/05/2026) — Phase 1 L1B.3 : port hex/coordinates pour Deno EF
// Source de verite : src/engine/hex/coordinates.ts. Duplication controlee (piege #12).

import type { Cube } from './types.ts'

const nz = (x: number): number => (x === 0 ? 0 : x)

export function cube(q: number, r: number, s?: number): Cube {
  const sFinal = s ?? -q - r
  if (s !== undefined && Math.abs(q + r + s) > 1e-9) {
    throw new Error(`Cube invariant violated: q+r+s = ${q + r + s} (expected 0)`)
  }
  return { q: nz(q), r: nz(r), s: nz(sFinal) }
}

export function cubesEqual(a: Cube, b: Cube): boolean {
  return a.q === b.q && a.r === b.r && a.s === b.s
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
