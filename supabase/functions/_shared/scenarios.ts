// v1.0 (09/05/2026) — Phase 1 L1B.2 : placements deterministes par scenario
// Source de verite : src/render/_data/mvpUnitPlacement.ts (parite obligatoire).

import type { UnitPlacement } from './types.ts'

export const SUPPORTED_SCENARIOS = ['mvp-plaine'] as const
export type ScenarioId = typeof SUPPORTED_SCENARIOS[number]

export function isSupportedScenario(id: string | null): id is ScenarioId {
  return id !== null && (SUPPORTED_SCENARIOS as readonly string[]).includes(id)
}

/**
 * mvp-plaine : 6 unites (3 vs 3), bleu ouest, rouge est, distance min 4 hex.
 * Stocke axial (q, r) en BDD, s = -q-r calcule cote client.
 */
export function getScenarioPlacement(scenarioId: ScenarioId): UnitPlacement[] {
  switch (scenarioId) {
    case 'mvp-plaine':
      return [
        { team: 'blue', kind: 'I', q: -3, r:  0 },
        { team: 'blue', kind: 'C', q: -3, r: -2 },
        { team: 'blue', kind: 'A', q: -4, r:  2 },
        { team: 'red',  kind: 'I', q:  3, r:  0 },
        { team: 'red',  kind: 'C', q:  3, r: -2 },
        { team: 'red',  kind: 'A', q:  4, r:  2 },
      ]
  }
}

export const DEFAULT_BOARD_RADIUS = 5
