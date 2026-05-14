// v2.2 (14/05/2026) — Phase 3.3 Lot B : UnitInstance porte activeOrder (icône d'ordre sur pion)
// v2.1 (14/05/2026) — Phase 3.3 : UnitInstance porte subKind (artillery_light/heavy/archer)
// v2.0a (10/05/2026) — Phase 2 2D.6 : HexTileState 'split-target' (case adjacente libre pour scinder)
// v2.0 (10/05/2026) — Phase 2 2E.1 : UnitInstance enrichi avec effective/effectiveMax (Phase 2 effectif elastique)
import type { Cube } from '@engine/hex'
import type { Team, UnitKind } from '@/types/game'
import type { UnitSubKind } from '@engine/units'
import type { OrderActionKind } from '@engine/orders'

export type HexTileState = 'idle' | 'hover' | 'selected' | 'reachable' | 'targetable' | 'dangerous' | 'split-target' | 'retreat-target'
export type HexTileVisibility = 'visible' | 'fog' | 'hidden'

export interface UnitInstance {
  readonly id: string
  readonly position: Cube
  readonly team: Team
  readonly kind: UnitKind
  /** Soldats actifs courants (legacy v1, conserve 1 phase). */
  readonly hp?: number
  readonly hpMax?: number
  /** Soldats blesses (recoverable Phase 5). */
  readonly wounded?: number
  /** Compatibilite : effectif affiche sous le label kind (hp en MVP). */
  readonly count?: number
  // Phase 2 v2 : effectif elastique (source de verite UI)
  readonly effective?: number
  readonly effectiveMax?: number
  /** Phase 3.2-bis : moral < 25 → anneau orange clignotant lent (signal détresse). */
  readonly routed?: boolean
  /** Phase 3.2-bis : étiquette ordinale "I.1", "C.2"… (calculée par team+kind). */
  readonly ordinalLabel?: string
  /** Phase 3.2-bis : flags d'état d'ordres pour icônes au-dessus du pion (FoW : self only). */
  readonly hasMoved?: boolean
  readonly hasAttacked?: boolean
  /** True si l'unité est dans au moins un engagement actif (mouvement = Rompre requis). */
  readonly engaged?: boolean
  /** Phase 3.3 — sous-type (artillery_light/heavy/archer) pour labels + stats résolus côté UI. */
  readonly subKind?: UnitSubKind
  /** Phase 3.3 Lot B — kind du priority=1 ordre conditionnel actif (icône au-dessus du pion). */
  readonly activeOrder?: OrderActionKind
}
