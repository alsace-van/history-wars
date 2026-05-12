// v1.8 (11/05/2026) — Phase 2.6 C : prop engagements (ligne 3D rouge pulsante entre pions engagés)
// v1.7 (11/05/2026) — Phase 2.5 C.2 : props cohesionStateMap + supportMap pour anneaux 3D état/soutien
// v1.6 (10/05/2026) — Phase 2 2.5 : prop damageFloaters (queue DamageFloater rendue en 3D au-dessus des unités)
// v1.5 (10/05/2026) — Phase 1.5 : prop cameraFocusCube (centrer la vue sur une unité depuis CombatResultPanel)
import { useMemo } from 'react'
import { cubeToWorld, type Cube } from '@engine/hex'
import type { Scale, Team } from '@/types/game'
import { SCALE_CONFIG } from '@engine/scales'
import { HexGrid } from '../hex/HexGrid'
import type { CohesionState, SupportCount } from '@engine/cohesion'
import { UnitPlaceholder } from '../units/UnitPlaceholder'
import { CameraController } from '../camera/CameraController'
import { SceneLighting } from '../lighting/SceneLighting'
import { DamageFloater } from '../effects/DamageFloater'
import { EngagementOverlay, type EngagementPair } from '../effects/EngagementOverlay'
import type { UnitInstance, HexTileState } from '../types'
import type { DamageFloaterEntry } from '@hooks/useCombatAnimator'
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
  /** v3.x — unités alliées proposées comme cible de fusion (halo bleu cyan). */
  mergeTargetUnitIds?: ReadonlySet<string>
  exhaustedUnitIds?: ReadonlySet<string>
  /** Phase 1.5 : unités impliquées dans le rapport combat actif (halo jaune pulsant). */
  highlightedUnitIds?: ReadonlySet<string>
  /** Phase 1.5 : cube hex sur lequel la caméra doit re-centrer son target (instantané). */
  cameraFocusCube?: Cube | null
  unitPaths?: Map<string, ReadonlyArray<Cube>>
  onUnitPathDone?: (unitId: string) => void
  onUnitClick?: (unit: UnitInstance) => void
  onUnitPointerOver?: (unit: UnitInstance) => void
  onUnitPointerOut?: (unit: UnitInstance) => void
  /** Phase 2 2.5 : queue de chiffres de dégâts flottants (rendu Billboard 3D). */
  damageFloaters?: ReadonlyArray<DamageFloaterEntry>
  /** Durée d'un floater en ms (depuis useSettings). */
  damageFloaterDurationMs?: number
  onDamageFloaterDone?: (id: string) => void
  /** Phase 2.5 C.2 : Map<unitId, CohesionState> pour l'anneau d'état (vert/jaune/orange). */
  cohesionStateMap?: Map<string, CohesionState>
  /** Phase 2.5 C.2 : Map<unitId, SupportCount> pour les cercles bleus de soutien. */
  supportMap?: Map<string, SupportCount>
  /** Phase 2.6 C : paires engagées (ligne 3D rouge pulsante entre les 2 pions). */
  engagements?: ReadonlyArray<EngagementPair>
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
  mergeTargetUnitIds,
  exhaustedUnitIds,
  highlightedUnitIds,
  cameraFocusCube,
  unitPaths,
  onUnitPathDone,
  onUnitClick,
  onUnitPointerOver,
  onUnitPointerOut,
  damageFloaters,
  damageFloaterDurationMs = 1800,
  onDamageFloaterDone,
  cohesionStateMap,
  supportMap,
  engagements,
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
          mergeTarget={mergeTargetUnitIds?.has(u.id) ?? false}
          exhausted={exhaustedUnitIds?.has(u.id) ?? false}
          highlighted={highlightedUnitIds?.has(u.id) ?? false}
          viewerTeam={viewerTeam}
          path={unitPaths?.get(u.id)}
          onPathDone={onUnitPathDone}
          onClick={onUnitClick}
          onPointerOver={onUnitPointerOver}
          onPointerOut={onUnitPointerOut}
          cohesionState={cohesionStateMap?.get(u.id)}
          support={supportMap?.get(u.id)}
        />
      )),
    [
      units,
      hexSize,
      selectedUnitId,
      targetableUnitIds,
      mergeTargetUnitIds,
      exhaustedUnitIds,
      highlightedUnitIds,
      viewerTeam,
      unitPaths,
      onUnitPathDone,
      onUnitClick,
      onUnitPointerOver,
      onUnitPointerOut,
      cohesionStateMap,
      supportMap,
    ]
  )

  // Cube hex → world position pour cibler la caméra (Y = 0, plan de la grille)
  const cameraTarget = useMemo<[number, number, number]>(() => {
    if (!cameraFocusCube) return [0, 0, 0]
    const w = cubeToWorld(cameraFocusCube, hexSize)
    return [w.x, 0, w.y]
  }, [cameraFocusCube, hexSize])

  return (
    <SceneShell className={className}>
      <CameraController scale={scale} target={cameraTarget} />
      <SceneLighting />
      <HexGrid scale={scale} cubes={cubes} onTileClick={onTileClick} tileStates={tileStates} />
      {renderedUnits}
      {engagements && engagements.length > 0 && (
        <EngagementOverlay engagements={engagements} hexSize={hexSize} />
      )}
      {damageFloaters?.map(f => (
        <DamageFloater
          key={f.id}
          cube={f.cube}
          hexSize={hexSize}
          killed={f.killed}
          wounded={f.wounded}
          durationMs={damageFloaterDurationMs}
          onComplete={() => onDamageFloaterDone?.(f.id)}
        />
      ))}
    </SceneShell>
  )
}
