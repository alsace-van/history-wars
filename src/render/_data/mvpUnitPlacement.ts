// v1.1 (12/05/2026) — MVP tweak : 8 unites (2I+1C+1A par equipe) en colonnes aux extremites
// v1.0 (09/05/2026) — Placement factice 6 unites pour MVP-Plaine
import type { UnitInstance } from '../types'

/**
 * 8 unites factices : 4 par equipe (2 Infanterie + 1 Cavalerie + 1 Artillerie),
 * alignees en colonne aux extremites du plateau radius 7.
 * Bleu colonne ouest (q=-6), rouge colonne est (q=6).
 * Parite obligatoire avec supabase/functions/_shared/scenarios.ts.
 */
export function buildMvpUnitPlacement(): UnitInstance[] {
  return [
    // Equipe bleue (colonne ouest, q=-6)
    { id: 'b-i1', position: { q: -6, r:  2, s:  4 }, team: 'blue', kind: 'I', count: 800 },
    { id: 'b-i2', position: { q: -6, r:  3, s:  3 }, team: 'blue', kind: 'I', count: 800 },
    { id: 'b-c',  position: { q: -6, r:  4, s:  2 }, team: 'blue', kind: 'C', count: 180 },
    { id: 'b-a',  position: { q: -6, r:  5, s:  1 }, team: 'blue', kind: 'A', count: 120 },

    // Equipe rouge (colonne est, q=6, miroir central)
    { id: 'r-i1', position: { q:  6, r: -2, s: -4 }, team: 'red',  kind: 'I', count: 800 },
    { id: 'r-i2', position: { q:  6, r: -3, s: -3 }, team: 'red',  kind: 'I', count: 800 },
    { id: 'r-c',  position: { q:  6, r: -4, s: -2 }, team: 'red',  kind: 'C', count: 180 },
    { id: 'r-a',  position: { q:  6, r: -5, s: -1 }, team: 'red',  kind: 'A', count: 120 },
  ]
}
