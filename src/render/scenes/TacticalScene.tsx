// v1.4 (10/05/2026) — Phase 1.5 : prop highlightedUnitIds (halo jaune unités du rapport combat actif)
// v1.3 (10/05/2026) — Phase 1.5 : prop viewerTeam pour barre PV asymetrique (own only)
// v1.2 (09/05/2026) — Animation case par case : prop unitPaths + onUnitPathDone
// v1.1 (09/05/2026) — L1C.3 : props tileStates + selectedUnitId + onUnitClick + onUnitHover + targetableUnitIds + exhaustedUnitIds
import { useMemo } from 'react'
import type { Cube } from '@engine/hex'
import type { Scale, Team } from '@/types/game'
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
  /** Equipe du joueur courant (Phase 1.5 : determine quelles unites montrent la barre PV detaillee). */
  viewerTeam?: Team | null
  onTileClick?: (c: Cube) => void
  tileStates?: Map<string, HexTileState>
  selectedUnitId?: string | null
  targetableUnitIds?: ReadonlySet<string>
  exhaustedUnitIds?: ReadonlySet<string>
  /** Phase 1.5 : unités impliquées dans le rapport combat actif (halo jaune pulsant). */
  highlightedUnitIds?: ReadonlySet<string>
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
  viewerTeam,
  onTileClick,
  tileStates,
  selectedUnitId,
  targetableUnitIds,
  exhaustedUnitIds,
  highlightedUnitIds,
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
          highlighted={highlightedUnitIds?.has(u.id) ?? false}
          viewerTeam={viewerTeam}
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
      highlightedUnitIds,
      viewerTeam,
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
