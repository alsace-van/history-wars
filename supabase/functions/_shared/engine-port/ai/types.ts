// v1.1 (17/05/2026) — Phase 4-bis Lot 2 : ajout lookaheadDepth + deadlineMs (opt-in minimax)
// v1.0 (14/05/2026) — Phase 4 Lot A2 : mirror Deno port src/engine/ai/types.ts
// PORT FROM src/engine/ai/types.ts — DO NOT EDIT MANUALLY.

import type { Cube } from '../hex/index.ts'
import type { TerrainType } from '../terrain/types.ts'
import type { CombatConfig } from '../combat/v2/types.ts'
import type { UnitState } from '../units.ts'

type UnitId = string

export type AIProfile = 'easy' | 'medium' | 'hard'

export type AIAction =
  | { readonly kind: 'move'; readonly dest: Cube }
  | { readonly kind: 'attack_melee'; readonly targetId: UnitId }
  | { readonly kind: 'attack_ranged'; readonly targetId: UnitId }
  | { readonly kind: 'hold' }

export interface AIContext {
  readonly allUnits: ReadonlyArray<UnitState>
  readonly visibleEnemyIds: ReadonlySet<UnitId>
  readonly visibleTileKeys: ReadonlySet<string>
  readonly boardKeys: ReadonlySet<string>
  readonly terrainMap: ReadonlyMap<string, TerrainType>
  readonly combatConfig: CombatConfig
  readonly profile: AIProfile
  readonly rng: () => number
  readonly engagedUnitIds: ReadonlySet<UnitId>
  readonly lookaheadDepth?: number
  readonly deadlineMs?: number
}

export interface ScoredAction {
  readonly action: AIAction
  readonly score: number
}
