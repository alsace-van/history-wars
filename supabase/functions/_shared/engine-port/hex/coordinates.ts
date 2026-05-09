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
