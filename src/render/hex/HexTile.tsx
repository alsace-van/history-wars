// v1.0c (09/05/2026) — Fix : Shape + ExtrudeGeometry, sommets explicitement aux angles 0,60,...,300
// v1.0b (09/05/2026) — Fix : edges custom (CylinderGeometry edges incluait diagonales internes)
// v1.0a (09/05/2026) — Fix : rotation hex retiree
// v1.0 (09/05/2026) — Un hex
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
 * Geometrie hex : Shape construit explicitement avec sommets aux angles
 * 0,60,...,300° puis ExtrudeGeometry. Trois.js CylinderGeometry utilise
 * (sin θ, cos θ) ce qui désaligne avec la convention cubeToWorld (cos, sin).
 *
 * On crée le shape dans le plan XY avec sin négatif, puis rotateX(-π/2)
 * pour mettre dans le plan XZ avec extrusion verticale (Y).
 *
 * Sommets résultants en monde :
 *   (1,0,0), (0.5,0,0.866), (-0.5,0,0.866), (-1,0,0), (-0.5,0,-0.866), (0.5,0,-0.866)
 * = exactement les sommets attendus pour cubeToWorld flat-top.
 */
function buildHexGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3
    const x = Math.cos(angle)
    // sin negatif : compense le retournement Z apres rotateX(-π/2) plus bas
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
  // Plan XY -> plan XZ : (x, y, z) -> (x, z, -y)
  // L'extrusion Z initiale (0..TILE_THICKNESS) va en +Y monde.
  // Le shape Y devient -Z monde, ce qui combine avec sin negatif
  // pour donner +Z = +sin(angle).
  geom.rotateX(-Math.PI / 2)
  // L'extrusion va de Y=0 a Y=TILE_THICKNESS. Centrer sur Y=0.
  geom.translate(0, -TILE_THICKNESS / 2, 0)
  return geom
}

const HEX_GEOMETRY = buildHexGeometry()

/**
 * Edges : 6 segments du contour top, mêmes angles que la geometry mesh.
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
