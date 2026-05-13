// v1.1 (13/05/2026) — Phase 3.2 : ajout neighbor + ring + spiral (utilises par vision et orders)
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

export function neighbor(c: Cube, direction: number): Cube {
  const d = ((direction % 6) + 6) % 6
  const dir = HEX_DIRECTIONS[d]
  return { q: c.q + dir.q, r: c.r + dir.r, s: c.s + dir.s }
}

export function neighbors(c: Cube): Cube[] {
  return HEX_DIRECTIONS.map(d => ({
    q: c.q + d.q,
    r: c.r + d.r,
    s: c.s + d.s,
  }))
}

export function ring(center: Cube, radius: number): Cube[] {
  if (radius < 0) throw new Error(`ring: radius must be >= 0, got ${radius}`)
  if (radius === 0) return [{ ...center }]

  const result: Cube[] = []
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

export function spiral(center: Cube, radius: number): Cube[] {
  if (radius < 0) throw new Error(`spiral: radius must be >= 0, got ${radius}`)
  const result: Cube[] = [{ ...center }]
  for (let r = 1; r <= radius; r++) {
    result.push(...ring(center, r))
  }
  return result
}
