// v2.0 (21/05/2026) — Phase 5 Lot 5.0 TASK 5.0.5 : wrapper deleguant a HexGridInstanced (perf 5000+ hex)
// v1.2 (12/05/2026) — Phase 3.1-B : prop tileVisibility (fog client, défaut 'visible')
// v1.1 (09/05/2026) — L1C.3 : prop tileStates Map<cubeKey, HexTileState> qui override le hover local
// v1.0 (09/05/2026) — Grille hex parametree par scale, lit SCALE_CONFIG[scale]
//
// API publique inchangee. L'implementation v1.x (1 mesh/hex × 3 ~ inviable au-dela de
// 1000 hex) est remplacee par HexGridInstanced (1 draw call sol + 1 overlay + 1 bords).
// Conservee comme wrapper pour ne pas toucher les call sites (TacticalScene, MapEditor).

import type { Cube } from '@engine/hex'
import type { Scale } from '@/types/game'
import { HexGridInstanced } from './HexGridInstanced'
import type { HexTileState, HexTileVisibility } from '../types'

interface HexGridProps {
  scale: Scale
  cubes: Cube[]
  /** Hauteur (Three.js Y) d'un hex donne. Default : plat. */
  getElevation?: (c: Cube) => number
  onTileClick?: (c: Cube) => void
  /**
   * Etats explicites par hex (cubeKey → state). Override le hover local
   * quand un etat non-idle est defini. Hover local applique uniquement
   * sur les hex en idle dans cette map.
   */
  tileStates?: Map<string, HexTileState>
  /**
   * Phase 3.1-B : visibilité par hex. Si présente : key absente = 'hidden' (fog client).
   * Si absente : tous les hex sont 'visible' (pré-Phase 3, ou hors bataille).
   */
  tileVisibility?: Map<string, HexTileVisibility>
}

/**
 * Grille hex pour le niveau tactique. Drop-in wrapper Phase 5 Lot 5.0 :
 * forward toutes les props a HexGridInstanced sans rien faire de plus.
 */
export function HexGrid(props: HexGridProps) {
  return <HexGridInstanced {...props} />
}
