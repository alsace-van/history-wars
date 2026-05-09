// v1.0 (08/05/2026) — Distance hex en coordonnees cubiques
import type { Cube } from './types'

/**
 * Distance entre 2 hex en nombre de pas (voisin a voisin).
 * Formule cube : (|dq| + |dr| + |ds|) / 2
 */
export function cubeDistance(a: Cube, b: Cube): number {
  return (
    (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2
  )
}
