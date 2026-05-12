// v1.1 (12/05/2026) — MVP tweak : board radius 7 + lignes 4 unites par equipe (2I+1C+1A)
// v1.0 (09/05/2026) — Phase 1 L1B.2 : placements deterministes par scenario
// Source de verite : src/render/_data/mvpUnitPlacement.ts (parite obligatoire).

import type { UnitPlacement } from './types.ts'

export const SUPPORTED_SCENARIOS = ['mvp-plaine'] as const
export type ScenarioId = typeof SUPPORTED_SCENARIOS[number]

export function isSupportedScenario(id: string | null): id is ScenarioId {
  return id !== null && (SUPPORTED_SCENARIOS as readonly string[]).includes(id)
}

/**
 * mvp-plaine : 8 unites (4 vs 4), bleu en colonne ouest (q=-6), rouge en colonne est (q=6).
 * Chaque equipe : 2 Infanterie + 1 Cavalerie + 1 Artillerie alignees verticalement.
 * Symetrie centrale (q,r) ↔ (-q,-r). Distance min entre equipes : 12 hex.
 * Stocke axial (q, r) en BDD, s = -q-r calcule cote client.
 */
export function getScenarioPlacement(scenarioId: ScenarioId): UnitPlacement[] {
  switch (scenarioId) {
    case 'mvp-plaine':
      return [
        // Bleu — colonne ouest (q=-6), centree autour de y=0 visuellement.
        { team: 'blue', kind: 'I', q: -6, r:  2 },
        { team: 'blue', kind: 'I', q: -6, r:  3 },
        { team: 'blue', kind: 'C', q: -6, r:  4 },
        { team: 'blue', kind: 'A', q: -6, r:  5 },
        // Rouge — colonne est (q=6), miroir central.
        { team: 'red',  kind: 'I', q:  6, r: -2 },
        { team: 'red',  kind: 'I', q:  6, r: -3 },
        { team: 'red',  kind: 'C', q:  6, r: -4 },
        { team: 'red',  kind: 'A', q:  6, r: -5 },
      ]
  }
}

export const DEFAULT_BOARD_RADIUS = 7
