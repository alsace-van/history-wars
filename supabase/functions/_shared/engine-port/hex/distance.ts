// v1.0 (09/05/2026) — Phase 1 L1B.3 : port hex/distance pour Deno EF
// Source de verite : src/engine/hex/distance.ts. Duplication controlee (piege #12).

import type { Cube } from './types.ts'

/**
 * Distance hex en coordonnees cubiques : (|dq| + |dr| + |ds|) / 2.
 */
export function cubeDistance(a: Cube, b: Cube): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2
}
