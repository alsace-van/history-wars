// v1.1 (09/05/2026) — L1C.3 : prop tileStates Map<cubeKey, HexTileState> qui override le hover local
// v1.0 (09/05/2026) — Grille hex parametree par scale, lit SCALE_CONFIG[scale]
import { useMemo, useState } from 'react'
import type { Cube } from '@engine/hex'
import { cubeKey } from '@engine/hex'
import type { Scale } from '@/types/game'
import { SCALE_CONFIG } from '@engine/scales'
import { HexTile } from './HexTile'
import type { HexTileState } from '../types'

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
}

const flat = () => 0

export function HexGrid({
  scale,
  cubes,
  getElevation = flat,
  onTileClick,
  tileStates,
}: HexGridProps) {
  const { hexSize } = SCALE_CONFIG[scale]
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const tiles = useMemo(
    () =>
      cubes.map(c => ({
        cube: c,
        key: cubeKey(c),
        elevation: getElevation(c),
      })),
    [cubes, getElevation]
  )

  return (
    <group>
      {tiles.map(t => {
        // Priorite : tileStates explicite (selected/reachable/targetable) > hover local > idle
        const explicit = tileStates?.get(t.key)
        let state: HexTileState
        if (explicit && explicit !== 'idle') {
          // Si on hover un hex deja highlighte (reachable/targetable), garder le hover visuel
          state = t.key === hoveredKey ? 'hover' : explicit
        } else {
          state = t.key === hoveredKey ? 'hover' : 'idle'
        }
        return (
          <HexTile
            key={t.key}
            cube={t.cube}
            hexSize={hexSize}
            elevation={t.elevation}
            state={state}
            visibility="visible"
            onClick={() => onTileClick?.(t.cube)}
            onPointerOver={() => setHoveredKey(t.key)}
            onPointerOut={() =>
              setHoveredKey(prev => (prev === t.key ? null : prev))
            }
          />
        )
      })}
    </group>
  )
}
