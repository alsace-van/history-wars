// v1.0 (08/05/2026) — Cle string pour Map<key, X>, base axial
import type { Cube } from './types'

const nz = (x: number): number => (x === 0 ? 0 : x)

/**
 * Encode un cube en string "q,r" (axial suffit, s est derivable).
 * Utilisable comme cle de Map.
 */
export function cubeKey(c: Cube): string {
  return `${c.q},${c.r}`
}

/**
 * Decode "q,r" -> Cube. Throw si format invalide.
 */
export function parseCubeKey(s: string): Cube {
  const parts = s.split(',')
  if (parts.length !== 2) {
    throw new Error(`parseCubeKey: invalid format "${s}", expected "q,r"`)
  }
  const q = Number(parts[0])
  const r = Number(parts[1])
  if (Number.isNaN(q) || Number.isNaN(r)) {
    throw new Error(`parseCubeKey: NaN in "${s}"`)
  }
  return { q: nz(q), r: nz(r), s: nz(-q - r) }
}
