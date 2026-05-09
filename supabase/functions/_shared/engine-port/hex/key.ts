// v1.0 (09/05/2026) — Phase 1 L1B.3 : port hex/key pour Deno EF
// Source de verite : src/engine/hex/key.ts. Duplication controlee (piege #12).

import type { Cube } from './types.ts'

const nz = (x: number): number => (x === 0 ? 0 : x)

export function cubeKey(c: Cube): string {
  return `${c.q},${c.r}`
}

export function parseCubeKey(s: string): Cube {
  const parts = s.split(',')
  if (parts.length !== 2) {
    throw new Error(`parseCubeKey: invalid format "${s}"`)
  }
  const q = Number(parts[0])
  const r = Number(parts[1])
  if (Number.isNaN(q) || Number.isNaN(r)) {
    throw new Error(`parseCubeKey: NaN in "${s}"`)
  }
  return { q: nz(q), r: nz(r), s: nz(-q - r) }
}
