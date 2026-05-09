// v1.0 (09/05/2026) — Scene tactique complete : grid + units + camera + lighting
import { useMemo } from 'react'
import type { Cube } from '@engine/hex'
import type { Scale } from '@/types/game'
import { SCALE_CONFIG } from '@engine/scales'
import { HexGrid } from '../hex/HexGrid'
import { UnitPlaceholder } from '../units/UnitPlaceholder'
import { CameraController } from '../camera/CameraController'
import { SceneLighting } from '../lighting/SceneLighting'
import type { UnitInstance } from '../types'
import { SceneShell } from './SceneShell'

interface TacticalSceneProps {
  scale: Scale
  cubes: Cube[]
  units: UnitInstance[]
  onTileClick?: (c: Cube) => void
  className?: string
}

export function TacticalScene({
  scale,
  cubes,
  units,
  onTileClick,
  className,
}: TacticalSceneProps) {
  const { hexSize } = SCALE_CONFIG[scale]

  const renderedUnits = useMemo(
    () =>
      units.map(u => (
        <UnitPlaceholder key={u.id} unit={u} hexSize={hexSize} />
      )),
    [units, hexSize]
  )

  return (
    <SceneShell className={className}>
      <CameraController scale={scale} />
      <SceneLighting />
      <HexGrid scale={scale} cubes={cubes} onTileClick={onTileClick} />
      {renderedUnits}
    </SceneShell>
  )
}
