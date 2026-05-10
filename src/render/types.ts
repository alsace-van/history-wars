// v1.2 (10/05/2026) — Phase 1.5 : UnitInstance enrichi avec hp/hpMax/wounded pour scale + barre PV
// v1.1 (10/05/2026) — P1-L1C4-04 : ajout state 'dangerous' (ZoC ennemie)
// v1.0 (09/05/2026) — Types render partages
import type { Cube } from '@engine/hex'
import type { Team, UnitKind } from '@/types/game'

export type HexTileState = 'idle' | 'hover' | 'selected' | 'reachable' | 'targetable' | 'dangerous'
export type HexTileVisibility = 'visible' | 'fog' | 'hidden'

export interface UnitInstance {
  readonly id: string
  readonly position: Cube
  readonly team: Team
  readonly kind: UnitKind
  /** Soldats actifs courants (pour scale visuel + barre PV propre). */
  readonly hp?: number
  readonly hpMax?: number
  /** Soldats blesses (recoverable Phase 3). */
  readonly wounded?: number
  /** Compatibilite : effectif affiche sous le label kind (hp en MVP). */
  readonly count?: number
}
