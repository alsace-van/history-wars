// v1.0b (09/05/2026) — Fix : edges custom (CylinderGeometry edges incluait diagonales internes)
// v1.0a (09/05/2026) — Fix : rotation hex retiree
// v1.0 (09/05/2026) — Un hex : cylindre tres aplati + bordure
import { memo, useMemo } from 'react'
import * as THREE from 'three'
import type { Cube } from '@engine/hex'
import { cubeToWorld } from '@engine/hex'
import type { HexTileState, HexTileVisibility } from '../types'
import { COLORS } from '../colors'

interface HexTileProps {
  cube: Cube
  hexSize: number
  elevation: number
  state: HexTileState
  visibility: HexTileVisibility
  onClick?: () => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}

const TILE_THICKNESS = 0.08
const EDGE_LIFT = 0.005

/**
 * Mesh hex : CylinderGeometry 6 segments. AUCUNE rotation : sommets natifs
 * aux angles 0,60,...,300° = exactement la convention cubeToWorld flat-top.
 */
const HEX_GEOMETRY = new THREE.CylinderGeometry(1, 1, TILE_THICKNESS, 6, 1)

/**
 * Edges : BufferGeometry custom avec UNIQUEMENT le contour hexagonal du top.
 * On NE peut PAS utiliser `EdgesGeometry(HEX_GEOMETRY)` qui inclurait aussi
 * les 12 aretes diagonales des faces top/bottom (triangulees en eventail
 * depuis le centre par CylinderGeometry) -> effet "etoile" visible sur la
 * grille en superposition.
 */
const HEX_EDGES = (() => {
  const positions: number[] = []
  for (let i = 0; i < 6; i++) {
    const a1 = (i * Math.PI) / 3
    const a2 = ((i + 1) * Math.PI) / 3
    positions.push(Math.cos(a1), 0, Math.sin(a1))
    positions.push(Math.cos(a2), 0, Math.sin(a2))
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geom
})()

function HexTileBase({
  cube,
  hexSize,
  elevation,
  state,
  visibility,
  onClick,
  onPointerOver,
  onPointerOut,
}: HexTileProps) {
  const { fillColor, edgeColor } = useMemo(() => {
    if (visibility === 'hidden') return { fillColor: 0x000000, edgeColor: 0x000000 }
    if (state === 'hover') return { fillColor: COLORS.tileHover, edgeColor: COLORS.tileHoverEdge }
    if (state === 'selected') return { fillColor: COLORS.tileSelected, edgeColor: COLORS.tileSelectedEdge }
    return { fillColor: COLORS.tileIdle, edgeColor: COLORS.tileIdleEdge }
  }, [state, visibility])

  const position = useMemo<[number, number, number]>(() => {
    const w = cubeToWorld(cube, hexSize)
    return [w.x, elevation, w.y]
  }, [cube, hexSize, elevation])

  if (visibility === 'hidden') return null

  return (
    <group position={position}>
      <mesh
        geometry={HEX_GEOMETRY}
        scale={[hexSize, 1, hexSize]}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          onPointerOver?.()
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          onPointerOut?.()
        }}
      >
        <meshStandardMaterial
          color={fillColor}
          roughness={0.85}
          metalness={0.05}
          transparent={visibility === 'fog'}
          opacity={visibility === 'fog' ? 0.35 : 1}
        />
      </mesh>
      <lineSegments
        geometry={HEX_EDGES}
        scale={[hexSize, 1, hexSize]}
        position={[0, TILE_THICKNESS / 2 + EDGE_LIFT, 0]}
      >
        <lineBasicMaterial color={edgeColor} />
      </lineSegments>
    </group>
  )
}

export const HexTile = memo(HexTileBase)
