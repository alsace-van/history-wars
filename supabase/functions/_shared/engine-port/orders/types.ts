// v1.1 (14/05/2026) — Phase 3.3-bis : +camp (action) + always (trigger) — mirror src v1.1
// v1.0 (13/05/2026) — Phase 3.2 Vague A2 : types ordres conditionnels (mirror src/engine/orders/types.ts)
// Source de verite : src/engine/orders/types.ts. Duplication controlee (piege #12).

import type { Cube } from '../hex/index.ts'
import type { UnitState } from '../units.ts'

type UnitId = string

export type OrderTriggerKind = 'on_attacked' | 'enemy_in_range' | 'cohesion_broken' | 'enemy_los' | 'always'
export type OrderActionKind = 'charge' | 'fire' | 'retreat' | 'hold' | 'camp'

export interface OrderTrigger {
  readonly kind: OrderTriggerKind
  readonly params?: { readonly range?: number }
}

export interface OrderAction {
  readonly kind: OrderActionKind
  readonly params?: Readonly<Record<string, unknown>>
}

export interface Posture {
  readonly id: string
  readonly unitId: UnitId
  readonly priority: number
  readonly trigger: OrderTrigger
  readonly action: OrderAction
  readonly active: boolean
}

export type OrderSkipReason = 'broken' | 'has_moved' | 'has_attacked' | 'no_target' | 'routed'

export interface OrderEvaluation {
  readonly posture: Posture
  readonly resolvedAction: OrderActionKind
  readonly targetUnitId?: UnitId | null
  readonly destHex?: Cube | null
  readonly skipped?: OrderSkipReason
}

export interface EvaluateOrdersContext {
  readonly allUnits: ReadonlyArray<UnitState>
  readonly engagedUnitIds: ReadonlySet<UnitId>
  readonly visibleEnemyIds: ReadonlySet<UnitId>
  readonly visibleTileKeys: ReadonlySet<string>
  readonly cohesionByUnit: ReadonlyMap<UnitId, 'nominal' | 'shaken' | 'broken'>
}

export const MAX_ORDERS_PER_UNIT = 3
