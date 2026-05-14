// v1.2 (14/05/2026) — Phase 3.3 : +1 artillerie légère par camp (10 unités, 5+5) — mirror scenarios.ts v1.2
// v1.1 (12/05/2026) — MVP tweak : 8 unites (2I+1C+1A par equipe) en colonnes aux extremites
// v1.0 (09/05/2026) — Placement factice 6 unites pour MVP-Plaine
import type { UnitInstance } from '../types'

/**
 * 10 unites factices : 5 par equipe (2 Infanterie + 1 Cavalerie + 1 Artillerie légère + 1 Artillerie lourde),
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
    { id: 'b-al', position: { q: -6, r:  5, s:  1 }, team: 'blue', kind: 'A', subKind: 'artillery_light', count: 120 },
    { id: 'b-ah', position: { q: -6, r:  6, s:  0 }, team: 'blue', kind: 'A', subKind: 'artillery_heavy', count: 120 },

    // Equipe rouge (colonne est, q=6, miroir central)
    { id: 'r-i1', position: { q:  6, r: -2, s: -4 }, team: 'red',  kind: 'I', count: 800 },
    { id: 'r-i2', position: { q:  6, r: -3, s: -3 }, team: 'red',  kind: 'I', count: 800 },
    { id: 'r-c',  position: { q:  6, r: -4, s: -2 }, team: 'red',  kind: 'C', count: 180 },
    { id: 'r-al', position: { q:  6, r: -5, s: -1 }, team: 'red',  kind: 'A', subKind: 'artillery_light', count: 120 },
    { id: 'r-ah', position: { q:  6, r: -6, s:  0 }, team: 'red',  kind: 'A', subKind: 'artillery_heavy', count: 120 },
  ]
}
