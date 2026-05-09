// v1.2 (09/05/2026) — Animation case par case : prop unitPaths + onUnitPathDone
// v1.1 (09/05/2026) — L1C.3 : props tileStates + selectedUnitId + onUnitClick + onUnitHover + targetableUnitIds + exhaustedUnitIds
// v1.0 (09/05/2026) — Scene tactique complete : grid + units + camera + lighting
import { useMemo } from 'react'
import type { Cube } from '@engine/hex'
import type { Scale } from '@/types/game'
import { SCALE_CONFIG } from '@engine/scales'
import { HexGrid } from '../hex/HexGrid'
import { UnitPlaceholder } from '../units/UnitPlaceholder'
import { CameraController } from '../camera/CameraController'
import { SceneLighting } from '../lighting/SceneLighting'
import type { UnitInstance, HexTileState } from '../types'
import { SceneShell } from './SceneShell'

interface TacticalSceneProps {
  scale: Scale
  cubes: Cube[]
  units: UnitInstance[]
  onTileClick?: (c: Cube) => void
  tileStates?: Map<string, HexTileState>
  selectedUnitId?: string | null
  targetableUnitIds?: ReadonlySet<string>
  exhaustedUnitIds?: ReadonlySet<string>
  unitPaths?: Map<string, ReadonlyArray<Cube>>
  onUnitPathDone?: (unitId: string) => void
  onUnitClick?: (unit: UnitInstance) => void
  onUnitPointerOver?: (unit: UnitInstance) => void
  onUnitPointerOut?: (unit: UnitInstance) => void
  className?: string
}

export function TacticalScene({
  scale,
  cubes,
  units,
  onTileClick,
  tileStates,
  selectedUnitId,
  targetableUnitIds,
  exhaustedUnitIds,
  unitPaths,
  onUnitPathDone,
  onUnitClick,
  onUnitPointerOver,
  onUnitPointerOut,
  className,
}: TacticalSceneProps) {
  const { hexSize } = SCALE_CONFIG[scale]

  const renderedUnits = useMemo(
    () =>
      units.map(u => (
        <UnitPlaceholder
          key={u.id}
          unit={u}
          hexSize={hexSize}
          selected={u.id === selectedUnitId}
          targetable={targetableUnitIds?.has(u.id) ?? false}
          exhausted={exhaustedUnitIds?.has(u.id) ?? false}
          path={unitPaths?.get(u.id)}
          onPathDone={onUnitPathDone}
          onClick={onUnitClick}
          onPointerOver={onUnitPointerOver}
          onPointerOut={onUnitPointerOut}
        />
      )),
    [
      units,
      hexSize,
      selectedUnitId,
      targetableUnitIds,
      exhaustedUnitIds,
      unitPaths,
      onUnitPathDone,
      onUnitClick,
      onUnitPointerOver,
      onUnitPointerOut,
    ]
  )

  return (
    <SceneShell className={className}>
      <CameraController scale={scale} />
      <SceneLighting />
      <HexGrid scale={scale} cubes={cubes} onTileClick={onTileClick} tileStates={tileStates} />
      {renderedUnits}
    </SceneShell>
  )
}
