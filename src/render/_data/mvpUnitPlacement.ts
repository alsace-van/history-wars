// v1.0 (09/05/2026) — Placement factice 6 unites pour MVP-Plaine
import type { UnitInstance } from '../types'

/**
 * 6 unites factices : 3 par equipe, 1 de chaque type (I/C/A).
 * Bleu côte ouest (q < 0), rouge côte est (q > 0).
 * Distance min entre une unite blue et une red >= 4 hex.
 */
export function buildMvpUnitPlacement(): UnitInstance[] {
  return [
    // Equipe bleue (ouest)
    { id: 'b-i', position: { q: -3, r:  0, s:  3 }, team: 'blue', kind: 'I', count: 100 },
    { id: 'b-c', position: { q: -3, r: -2, s:  5 }, team: 'blue', kind: 'C', count: 60 },
    { id: 'b-a', position: { q: -4, r:  2, s:  2 }, team: 'blue', kind: 'A', count: 30 },

    // Equipe rouge (est)
    { id: 'r-i', position: { q:  3, r:  0, s: -3 }, team: 'red', kind: 'I', count: 100 },
    { id: 'r-c', position: { q:  3, r: -2, s: -1 }, team: 'red', kind: 'C', count: 60 },
    { id: 'r-a', position: { q:  4, r:  2, s: -6 }, team: 'red', kind: 'A', count: 30 },
  ]
}
