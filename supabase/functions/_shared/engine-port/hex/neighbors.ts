// v1.0 (09/05/2026) — Phase 1 L1B.3 : port hex/neighbors pour Deno EF
// Source de verite : src/engine/hex/neighbors.ts. Duplication controlee (piege #12).

import type { Cube } from './types.ts'

/**
 * Ordre fixe : 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE.
 * Convention TACTICA flat-top.
 */
export const HEX_DIRECTIONS: ReadonlyArray<Cube> = [
  { q: +1, r:  0, s: -1 },
  { q: +1, r: -1, s:  0 },
  { q:  0, r: -1, s: +1 },
  { q: -1, r:  0, s: +1 },
  { q: -1, r: +1, s:  0 },
  { q:  0, r: +1, s: -1 },
]

export function neighbors(c: Cube): Cube[] {
  return HEX_DIRECTIONS.map(d => ({
    q: c.q + d.q,
    r: c.r + d.r,
    s: c.s + d.s,
  }))
}
