// v1.0 (09/05/2026) — Types render partages
import type { Cube } from '@engine/hex'
import type { Team, UnitKind } from '@/types/game'

export type HexTileState = 'idle' | 'hover' | 'selected' | 'reachable' | 'targetable'
export type HexTileVisibility = 'visible' | 'fog' | 'hidden'

export interface UnitInstance {
  readonly id: string
  readonly position: Cube
  readonly team: Team
  readonly kind: UnitKind
  readonly count?: number
}
