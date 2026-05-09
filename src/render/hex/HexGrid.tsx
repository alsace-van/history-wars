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
}

const flat = () => 0

export function HexGrid({
  scale,
  cubes,
  getElevation = flat,
  onTileClick,
}: HexGridProps) {
  const { hexSize } = SCALE_CONFIG[scale]
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  // Tiles avec leur etat memo (eviter re-render des 91 quand un seul change)
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
        const state: HexTileState = t.key === hoveredKey ? 'hover' : 'idle'
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
