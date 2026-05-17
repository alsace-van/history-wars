// v2.0 (17/05/2026) — Phase 5 Lot B.5 : forward templateMap + templatesById + customAssetsById a TerrainDecor
// v1.9 (12/05/2026) — Phase 3.1-B : props tileVisibility + enemyVisibility (fog client + silhouettes)
// v1.8 (11/05/2026) — Phase 2.6 C : prop engagements (ligne 3D rouge pulsante entre pions engagés)
// v1.7 (11/05/2026) — Phase 2.5 C.2 : props cohesionStateMap + supportMap pour anneaux 3D état/soutien

import { useMemo } from 'react'
import { cubeToWorld, type Cube } from '@engine/hex'
import type { Scale, Team } from '@/types/game'
import { SCALE_CONFIG } from '@engine/scales'
import { HexGrid } from '../hex/HexGrid'
import type { CohesionState, SupportCount } from '@engine/cohesion'
import type { VisibilityLevel } from '@engine/vision'
import { UnitPlaceholder } from '../units/UnitPlaceholder'
import { CameraController } from '../camera/CameraController'
import { SceneLighting } from '../lighting/SceneLighting'
import { DamageFloater } from '../effects/DamageFloater'
import { EngagementOverlay, type EngagementPair } from '../effects/EngagementOverlay'
import { TerrainDecor } from '../decor/TerrainDecor'
import type { TerrainType } from '@engine/terrain/types'
import type { HexTemplate } from '@hooks/useHexTemplates'
import type { HexAsset } from '@hooks/useHexAssets'
import type { UnitInstance, HexTileState, HexTileVisibility } from '../types'
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
  /** Phase 3.1-B : visibilité par hex (fog client). Key absente = 'hidden'. */
  tileVisibility?: Map<string, HexTileVisibility>
  /** Phase 3.1-B : Map<unitId, VisibilityLevel> pour les ennemis. Key absente = 'hidden' (non rendu). */
  enemyVisibility?: Map<string, VisibilityLevel>
  /** Phase 5 : Map cubeKey → TerrainType pour rendu décors 3D (TerrainDecor). */
  terrainMap?: Map<string, TerrainType>
  /** Phase 5 Lot B.5 : Map cubeKey -> templateId (hex avec custom template). */
  templateMap?: Map<string, string>
  /** Phase 5 Lot B.5 : Lookup templateId -> HexTemplate. */
  templatesById?: Map<string, HexTemplate>
  /** Phase 5 Lot B.5 : Lookup assetId -> HexAsset pour GLB customs. */
  customAssetsById?: Map<string, HexAsset>
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
  tileVisibility,
  enemyVisibility,
  terrainMap,
  templateMap,
  templatesById,
  customAssetsById,
  className,
}: TacticalSceneProps) {
  const { hexSize } = SCALE_CONFIG[scale]

  const renderedUnits = useMemo(
    () => {
      const out: JSX.Element[] = []
      for (const u of units) {
        // Phase 3.1-B : si enemyVisibility est fourni ET l'unité est ennemie (≠ viewerTeam),
        // on filtre selon le niveau. 'hidden' = on ne rend pas. 'spotted' = silhouette.
        let silhouette = false
        if (enemyVisibility && viewerTeam && u.team !== viewerTeam) {
          const level = enemyVisibility.get(u.id) ?? 'hidden'
          if (level === 'hidden') continue
          silhouette = level === 'spotted'
        }
        out.push(
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
            silhouette={silhouette}
          />,
        )
      }
      return out
    },
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
      enemyVisibility,
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
      <HexGrid scale={scale} cubes={cubes} onTileClick={onTileClick} tileStates={tileStates} tileVisibility={tileVisibility} />
      {terrainMap && terrainMap.size > 0 && (
        <TerrainDecor
          terrainMap={terrainMap}
          hexSize={hexSize}
          templateMap={templateMap}
          templatesById={templatesById}
          customAssetsById={customAssetsById}
        />
      )}
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
