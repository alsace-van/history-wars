// v1.0a (09/05/2026) — Fix : rotation hex retiree (cause trous entre hex)
// v1.0 (09/05/2026) — Un hex : cylindre tres aplati + bordure (LineSegments)
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
 * Geometrie hex aplatie partagee. CylinderGeometry(_, _, _, 6) cree un hex
 * inscrit dans un cercle de rayon 1 avec sommets aux angles 0,60,...,300°.
 * AUCUNE rotation : c'est exactement la convention attendue par cubeToWorld
 * flat-top de Red Blob (les sommets sont a l'Est et a l'Ouest, les faces
 * plates en haut/bas perpendiculaires a l'axe Z monde).
 *
 * NE PAS faire rotateY : casserait la tangence avec les voisins.
 */
const HEX_GEOMETRY = new THREE.CylinderGeometry(1, 1, TILE_THICKNESS, 6, 1)

// Geometrie d'edges (contour) pre-calculee
const HEX_EDGES = new THREE.EdgesGeometry(HEX_GEOMETRY)

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
