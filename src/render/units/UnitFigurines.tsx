// v1.0 (21/05/2026) — Phase 5 Lot 5.6 : rendu N figurines pour unité multi-hex
// Frontière render/ : zéro Supabase, zéro hooks data.
//
// Délégation depuis UnitPlaceholder quand `unit.positions.length > 1`. N meshes
// statiques (1 par hex), 1 UnitLabel + 1 UnitHealthBar au centroïde. Pas
// d'animation path en MVP — la sémantique de déplacement bloc rigide arrive en
// TASK 5.6.4 (engine/movement/multi-hex-move).
//
// Click : chaque figurine déclenche `onClick(unit)` (stopPropagation). Le ring
// de sélection autour de chaque hex est géré par useTacticalSelection → tileStates
// 'selected', pas ici.

import { Suspense, useMemo, type ReactNode } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { cubeToWorld, type Cube } from '@engine/hex'
import { centroid, type UnitHexPosition } from '@engine/units'
import type { CohesionState, SupportCount } from '@engine/cohesion'
import type { Team, UnitKind } from '@/types/game'
import type { UnitInstance } from '../types'
import { COLORS } from '../colors'
import { SoldierMesh } from './SoldierMesh'
import { CavalryMesh } from './CavalryMesh'
import { CannonMesh } from './CannonMesh'
import { HowitzerMesh } from './HowitzerMesh'
import { UnitHealthBar } from './UnitHealthBar'
import { UnitLabel } from './UnitLabel'

interface UnitFigurinesProps {
  unit: UnitInstance
  positions: ReadonlyArray<UnitHexPosition>
  hexSize: number
  selected?: boolean
  targetable?: boolean
  exhausted?: boolean
  highlighted?: boolean
  viewerTeam?: Team | null
  onClick?: (unit: UnitInstance) => void
  onPointerOver?: (unit: UnitInstance) => void
  onPointerOut?: (unit: UnitInstance) => void
  cohesionState?: CohesionState
  support?: SupportCount
  silhouette?: boolean
}

// Constantes alignées sur UnitPlaceholder pour cohérence visuelle.
const SOLDIER_SCALE_RATIO = 0.5
const MIN_SOLDIER_SCALE_FACTOR = 0.35
const MAX_SOLDIER_SCALE_FACTOR = 1.0
const MESH_TOP_HEIGHT_BY_KIND: Readonly<Record<UnitKind, number>> = {
  I: 2.0,
  C: 2.8,
  A: 2.0,
}

// Lift Y du ring sélection (cf piège #47 z-fighting), même valeur qu'UnitPlaceholder.
const RING_LIFT = 0.1
const RING_NET_LIFT = RING_LIFT + 0.004

function cubeWorldXZ(c: Cube, hexSize: number): [number, number, number] {
  const w = cubeToWorld(c, hexSize)
  return [w.x, 0, w.y]
}

/**
 * Rendu d'une unité multi-hex (N hex contigus). Chaque hex porte 1 figurine GLB.
 * Label + healthbar centrés sur le centroïde géométrique (via `centroid` engine).
 *
 * Compat MVP : si `positions.length === 1`, identique à UnitPlaceholder mais sans
 * animation path (le 1-hex utilise UnitPlaceholder qui garde anim). N'est appelé
 * que pour multi-hex via le guard en début de UnitPlaceholder.
 */
export function UnitFigurines({
  unit,
  positions,
  hexSize,
  selected = false,
  targetable: _targetable = false,
  exhausted = false,
  highlighted: _highlighted = false,
  viewerTeam,
  onClick,
  onPointerOver,
  onPointerOut,
  cohesionState: _cohesionState,
  support: _support,
  silhouette = false,
}: UnitFigurinesProps) {
  // Centroïde calculé via engine (cubeRound respect q+r+s=0).
  const centroidCube = useMemo<Cube>(() => centroid({
    ...unit,
    // Adapt UnitInstance → UnitState minimal pour centroid (lit positions).
    id: unit.id,
    kind: unit.kind,
    team: unit.team,
    position: unit.position,
    positions,
    hp: 0, hpMax: 0, wounded: 0, morale: 0, moraleMax: 0,
    hasMoved: false, hasAttacked: false, routed: false,
    effective: unit.effective ?? 0, effectiveMax: unit.effectiveMax ?? 0,
    effectiveMin: 0, killed: 0,
  }), [unit, positions])

  const centroidWorld = useMemo<[number, number, number]>(
    () => cubeWorldXZ(centroidCube, hexSize),
    [centroidCube, hexSize],
  )

  const ringRadius = hexSize * 0.42

  // Scale partagé : ratio effective/effectiveMax (même formule que UnitPlaceholder).
  const eff = unit.effective ?? unit.hp ?? 1
  const effMax = unit.effectiveMax ?? unit.hpMax ?? 1
  const effectiveRatio = effMax > 0 ? Math.max(0, Math.min(1, eff / effMax)) : 1
  const scaleFactor = MIN_SOLDIER_SCALE_FACTOR + (MAX_SOLDIER_SCALE_FACTOR - MIN_SOLDIER_SCALE_FACTOR) * effectiveRatio
  const soldierScale = hexSize * SOLDIER_SCALE_RATIO * scaleFactor
  const baseScale = hexSize * SOLDIER_SCALE_RATIO
  const opacity = silhouette ? 0.35 : (exhausted ? 0.55 : 1)

  const showHealthBar = !!viewerTeam && unit.team === viewerTeam && effMax > 0

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    onClick?.(unit)
  }
  function handleOver(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    onPointerOver?.(unit)
  }
  function handleOut(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    onPointerOut?.(unit)
  }

  // Figurine par hex (mesh + hitbox cliquable + ring sélection si selected).
  // Le ring entoure CHAQUE hex de l'unité multi-hex pour rendre lisible son emprise.
  const figurines: ReactNode[] = positions.map((p, i) => {
    const w = cubeWorldXZ(p.cube, hexSize)
    return (
      <group key={`${unit.id}-fig-${i}`} position={w}>
        {selected && (
          <>
            <group position={[0, RING_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <mesh renderOrder={1}>
                <ringGeometry args={[ringRadius * 1.1, ringRadius * 1.55, 64]} />
                <meshBasicMaterial color={COLORS.unitSelectedRing} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
              <mesh renderOrder={2}>
                <ringGeometry args={[ringRadius * 1.0, ringRadius * 1.32, 64]} />
                <meshBasicMaterial color={COLORS.unitSelectedRing} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
            </group>
            <group position={[0, RING_NET_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <mesh renderOrder={4}>
                <ringGeometry args={[ringRadius * 1.06, ringRadius * 1.2, 64]} />
                <meshBasicMaterial color={COLORS.unitSelectedRing} transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            </group>
          </>
        )}
        <mesh position={[0, baseScale, 0]} onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
          <cylinderGeometry args={[ringRadius, ringRadius, baseScale * 2, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <group position={[0, soldierScale, 0]} scale={[soldierScale, soldierScale, soldierScale]}>
          <Suspense fallback={null}>
            {unit.kind === 'C' ? (
              <CavalryMesh team={unit.team} opacity={opacity} selected={selected} />
            ) : unit.kind === 'A' && unit.subKind === 'artillery_heavy' ? (
              <CannonMesh team={unit.team} opacity={opacity} selected={selected} />
            ) : unit.kind === 'A' && unit.subKind === 'artillery_light' ? (
              <HowitzerMesh team={unit.team} opacity={opacity} selected={selected} />
            ) : (
              <SoldierMesh team={unit.team} opacity={opacity} selected={selected} />
            )}
          </Suspense>
        </group>
      </group>
    )
  })

  const labelYOffset = soldierScale * MESH_TOP_HEIGHT_BY_KIND[unit.kind] + 0.3

  return (
    <>
      {figurines}
      {/* 1 label + 1 healthbar au centroïde (lecture rapide identité du groupe). */}
      <group position={centroidWorld}>
        {!silhouette && showHealthBar && (
          <UnitHealthBar
            effective={eff}
            effectiveMax={effMax}
            wounded={unit.wounded ?? 0}
            yOffset={baseScale * 2.2 + 0.55}
            width={baseScale * 1.6}
          />
        )}
        <UnitLabel
          unit={unit}
          yOffset={labelYOffset}
          showHealthBar={showHealthBar}
          silhouette={silhouette}
        />
      </group>
    </>
  )
}
