// v1.0 (21/05/2026) — Phase 5 Lot 5.0 TASK 5.0.5 : InstancedMesh pour perf 5000+ hex
// Remplace HexGrid (1 mesh/hex × 3 = ~3000 mesh à rayon 7, inviable à rayon 60+).
// Architecture :
//   - 1 InstancedMesh "floor" (HEX_GEOMETRY extrudée) : cliquable + instanceColor par state
//   - 1 InstancedMesh "overlay" (HEX_FLAT_GEOMETRY) : illumination state non-idle, scale=0 sinon
//   - 1 LineSegments unique (BufferGeometry agrégée) : bords statiques gris semi-transparent
// API publique identique a HexGrid pour drop-in replacement.

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { Cube } from '@engine/hex'
import { cubeKey, cubeToWorld } from '@engine/hex'
import type { Scale } from '@/types/game'
import { SCALE_CONFIG } from '@engine/scales'
import { HEX_FLAT_GEOMETRY } from './HexTile'
import type { HexTileState, HexTileVisibility } from '../types'
import { COLORS } from '../colors'

const TAG = '[HexGridInstanced v1.0]'

const TILE_THICKNESS = 0.08
const OVERLAY_LIFT = 0.07

/**
 * Géométrie hex extrudée pour le sol cliquable (identique HexTile).
 * Construite une fois en module-level, partagée par toutes les instances.
 */
const HEX_GEOMETRY = (() => {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3
    const x = Math.cos(angle)
    const y = -Math.sin(angle)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: TILE_THICKNESS,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  })
  geom.rotateX(-Math.PI / 2)
  geom.translate(0, -TILE_THICKNESS / 2, 0)
  return geom
})()

interface HexGridInstancedProps {
  scale: Scale
  cubes: Cube[]
  getElevation?: (c: Cube) => number
  onTileClick?: (c: Cube) => void
  tileStates?: Map<string, HexTileState>
  tileVisibility?: Map<string, HexTileVisibility>
}

const flat = () => 0

// Buffers temporaires module-level (évite alloc par frame)
const tmpMatrix = new THREE.Matrix4()
const tmpColor = new THREE.Color()
const tmpPos = new THREE.Vector3()
const tmpQuat = new THREE.Quaternion()
const tmpScale = new THREE.Vector3()
const HIDDEN_MATRIX = (() => {
  const m = new THREE.Matrix4()
  m.compose(new THREE.Vector3(0, -10000, 0), new THREE.Quaternion(), new THREE.Vector3(0, 0, 0))
  return m
})()

/**
 * Couleur sol selon state + visibility.
 * 'hidden' → noir opaque (masque PageBackground qui leak).
 */
function getFillColor(state: HexTileState, visibility: HexTileVisibility): number {
  if (visibility === 'hidden') return 0x000000
  switch (state) {
    case 'hover': return COLORS.tileHover
    case 'selected': return COLORS.tileSelected
    case 'reachable': return COLORS.tileReachable
    case 'targetable': return COLORS.tileTargetable
    case 'dangerous': return COLORS.tileDangerous
    case 'split-target': return COLORS.tileSplitTarget
    case 'retreat-target': return COLORS.tileRetreatTarget
    default: return COLORS.tileIdle
  }
}

/**
 * State effectif d'un tile en tenant compte du hover local et de tileStates explicite.
 * Priorité : explicit non-idle > hover > idle.
 */
function resolveState(
  key: string,
  hoveredKey: string | null,
  tileStates?: Map<string, HexTileState>,
): HexTileState {
  const explicit = tileStates?.get(key)
  if (explicit && explicit !== 'idle') {
    return key === hoveredKey ? 'hover' : explicit
  }
  return key === hoveredKey ? 'hover' : 'idle'
}

function resolveVisibility(
  key: string,
  tileVisibility?: Map<string, HexTileVisibility>,
): HexTileVisibility {
  if (!tileVisibility) return 'visible'
  return tileVisibility.get(key) ?? 'hidden'
}

export function HexGridInstanced({
  scale,
  cubes,
  getElevation = flat,
  onTileClick,
  tileStates,
  tileVisibility,
}: HexGridInstancedProps) {
  const { hexSize } = SCALE_CONFIG[scale]
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const floorRef = useRef<THREE.InstancedMesh>(null)
  const overlayRef = useRef<THREE.InstancedMesh>(null)

  // Index inverse : instanceId → cube + cubeKey. Stable tant que cubes ne change pas.
  const cubeData = useMemo(() => {
    const arr: Cube[] = cubes.slice()
    const keys: string[] = arr.map(cubeKey)
    return { cubes: arr, keys }
  }, [cubes])

  const count = cubeData.cubes.length

  // Positions sol (instanceMatrix) — recalcul si cubes ou hexSize change
  // getElevation est intentionnellement out of deps pour éviter re-calc à chaque render
  // (la fonction default `flat` change d'identité à chaque render parent — anti-pattern à
  // documenter pour les consommateurs : memoize getElevation côté appelant si non-flat).
  useEffect(() => {
    const floor = floorRef.current
    if (!floor) return
    for (let i = 0; i < count; i++) {
      const c = cubeData.cubes[i]
      const w = cubeToWorld(c, hexSize)
      const elev = getElevation(c)
      tmpPos.set(w.x, elev, w.y)
      tmpQuat.set(0, 0, 0, 1)
      tmpScale.set(hexSize, 1, hexSize)
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale)
      floor.setMatrixAt(i, tmpMatrix)
    }
    floor.instanceMatrix.needsUpdate = true
    floor.computeBoundingSphere()
    if (typeof window !== 'undefined' && window.console) {
      console.log(TAG, 'floor instances posed:', count)
    }
  }, [cubeData, count, hexSize, getElevation])

  // Couleurs sol (instanceColor) — recalcul à chaque changement de state/visibility/hover
  useEffect(() => {
    const floor = floorRef.current
    if (!floor) return
    for (let i = 0; i < count; i++) {
      const key = cubeData.keys[i]
      const visibility = resolveVisibility(key, tileVisibility)
      const state = resolveState(key, hoveredKey, tileStates)
      tmpColor.setHex(getFillColor(state, visibility))
      floor.setColorAt(i, tmpColor)
    }
    if (floor.instanceColor) floor.instanceColor.needsUpdate = true
  }, [cubeData, count, tileStates, tileVisibility, hoveredKey])

  // Overlay : positionné au-dessus du sol (Y + OVERLAY_LIFT), scale=0 si pas d'overlay (= hide)
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    for (let i = 0; i < count; i++) {
      const key = cubeData.keys[i]
      const visibility = resolveVisibility(key, tileVisibility)
      const state = resolveState(key, hoveredKey, tileStates)
      const showOverlay = state !== 'idle' && visibility === 'visible'

      if (showOverlay) {
        const c = cubeData.cubes[i]
        const w = cubeToWorld(c, hexSize)
        const elev = getElevation(c)
        tmpPos.set(w.x, elev + OVERLAY_LIFT, w.y)
        tmpQuat.set(0, 0, 0, 1)
        tmpScale.set(hexSize, 1, hexSize)
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale)
        overlay.setMatrixAt(i, tmpMatrix)
        tmpColor.setHex(getFillColor(state, visibility))
        overlay.setColorAt(i, tmpColor)
      } else {
        overlay.setMatrixAt(i, HIDDEN_MATRIX)
      }
    }
    overlay.instanceMatrix.needsUpdate = true
    if (overlay.instanceColor) overlay.instanceColor.needsUpdate = true
  }, [cubeData, count, tileStates, tileVisibility, hoveredKey, hexSize, getElevation])

  // Bords agrégés en BufferGeometry unique (positions monde absolues, pas instanced).
  // Trade-off : couleur statique gris semi-transparent pour MVP. Effet edge-color-by-state
  // sacrifié pour la perf (sinon il faudrait LineSegments par tile = autant de drawcalls).
  const edgesGeom = useMemo(() => {
    const positions: number[] = []
    for (const c of cubeData.cubes) {
      const w = cubeToWorld(c, hexSize)
      const elev = getElevation(c)
      const y = elev + OVERLAY_LIFT + 0.001
      for (let i = 0; i < 6; i++) {
        const a1 = (i * Math.PI) / 3
        const a2 = ((i + 1) * Math.PI) / 3
        positions.push(
          w.x + Math.cos(a1) * hexSize, y, w.y + Math.sin(a1) * hexSize,
          w.x + Math.cos(a2) * hexSize, y, w.y + Math.sin(a2) * hexSize,
        )
      }
    }
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geom
  }, [cubeData, hexSize, getElevation])

  // Event handlers : raycast retourne event.instanceId → cube via lookup
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const id = e.instanceId
    if (id === undefined) return
    const key = cubeData.keys[id]
    const visibility = resolveVisibility(key, tileVisibility)
    // Hidden tiles non-cliquables (parité HexTile v1.4)
    if (visibility === 'hidden') return
    onTileClick?.(cubeData.cubes[id])
  }

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const id = e.instanceId
    if (id === undefined) return
    const key = cubeData.keys[id]
    const visibility = resolveVisibility(key, tileVisibility)
    if (visibility === 'hidden') return
    setHoveredKey(key)
  }

  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHoveredKey(null)
  }

  return (
    <group>
      {/* Sol cliquable — 1 draw call pour TOUS les hex */}
      <instancedMesh
        ref={floorRef}
        args={[HEX_GEOMETRY, undefined, count]}
        onClick={handleClick}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        <meshStandardMaterial roughness={0.85} metalness={0.05} />
      </instancedMesh>

      {/* Overlay illumination — 1 draw call, scale=0 pour hex sans state */}
      <instancedMesh
        ref={overlayRef}
        args={[HEX_FLAT_GEOMETRY, undefined, count]}
      >
        <meshBasicMaterial transparent opacity={0.45} depthWrite={false} />
      </instancedMesh>

      {/* Bords agrégés — 1 LineSegments couvrant toute la grille */}
      <lineSegments geometry={edgesGeom}>
        <lineBasicMaterial
          color={COLORS.tileIdleEdge}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}
