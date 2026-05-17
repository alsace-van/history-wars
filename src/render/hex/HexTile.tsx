// v1.6 (17/05/2026) — bords (lineSegments) atténués en idle visible (opacity 0.15)
// v1.5 (17/05/2026) — Overlay highlight au-dessus de la texture terrain (Phase 5 Lot 1) :
//   illuminations (hover/selected/reachable/etc.) rendues sur un mesh hex PLAT semi-transparent
//   à Y au-dessus de TerrainDecor.liftY (0.05). Les bords (lineSegments) aussi remontés.
// v1.4 (12/05/2026) — Phase 3.1 fix : hex hidden rendu en noir opaque (masque PageBackground qui leak à travers)
// v1.3 (10/05/2026) — Phase 2 2D.6 : support state 'split-target' (ambre, case adjacente pour scinder)
// v1.2 (10/05/2026) — P1-L1C4-04 : support state 'dangerous' (ZoC ennemie, orange amorti)
// v1.1 (09/05/2026) — L1C.3 : support states 'reachable' (cyan) + 'targetable' (rouge, prepare L1C.4)
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

/**
 * Geometrie hex : Shape construit explicitement avec sommets aux angles
 * 0,60,...,300° puis ExtrudeGeometry.
 */
function buildHexGeometry(): THREE.ExtrudeGeometry {
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
}

const HEX_GEOMETRY = buildHexGeometry()

// v1.5 — Géométrie hex PLATE (sans extrusion) pour l'overlay d'illumination
// au-dessus de la texture terrain. Convention identique au sol (vertex EST i=0,
// sens horaire vu d'au-dessus avec y = -sin).
// Exportée pour réutilisation par CustomHexMesh (Phase 5 Lot B.2).
export const HEX_FLAT_GEOMETRY = (() => {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3
    const x = Math.cos(angle)
    const y = -Math.sin(angle)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geom = new THREE.ShapeGeometry(shape)
  geom.rotateX(-Math.PI / 2)
  return geom
})()

// v1.5 — Y au-dessus de TerrainDecor.liftY (0.05) pour que l'overlay et les bords
// soient visibles par-dessus la texture d'herbe.
const OVERLAY_LIFT = 0.07

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
    if (state === 'reachable') return { fillColor: COLORS.tileReachable, edgeColor: COLORS.tileReachableEdge }
    if (state === 'targetable') return { fillColor: COLORS.tileTargetable, edgeColor: COLORS.tileTargetableEdge }
    if (state === 'dangerous') return { fillColor: COLORS.tileDangerous, edgeColor: COLORS.tileDangerousEdge }
    if (state === 'split-target') return { fillColor: COLORS.tileSplitTarget, edgeColor: COLORS.tileSplitTargetEdge }
    if (state === 'retreat-target') return { fillColor: COLORS.tileRetreatTarget, edgeColor: COLORS.tileRetreatTargetEdge }
    return { fillColor: COLORS.tileIdle, edgeColor: COLORS.tileIdleEdge }
  }, [state, visibility])

  const position = useMemo<[number, number, number]>(() => {
    const w = cubeToWorld(cube, hexSize)
    return [w.x, elevation, w.y]
  }, [cube, hexSize, elevation])

  // v1.4 — hex hidden : rendu opaque noir (masque PageBackground qui transparait sinon).
  // meshBasicMaterial : pas affecté par la lumière (uniformité parfaite). Pas d'edges, pas d'event handlers
  // (le hex est invisible au joueur, autant ne pas le rendre cliquable/hoverable).
  if (visibility === 'hidden') {
    return (
      <group position={position}>
        <mesh geometry={HEX_GEOMETRY} scale={[hexSize, 1, hexSize]}>
          <meshBasicMaterial color={0x000000} />
        </mesh>
      </group>
    )
  }

  // v1.5 — Overlay highlight au-dessus de la texture terrain (Phase 5).
  // Affiché si state non-idle ET visibility visible. Couleur fillColor semi-transparente.
  const showOverlay = state !== 'idle' && visibility === 'visible'

  return (
    <group position={position}>
      {/* Sol HexTile : cliquable + colore selon state (caché sous la texture en pratique,
          mais reste utile pour le raycast et pour les hex sans texture terrain). */}
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
      {/* v1.5 — Overlay illumination AU-DESSUS de la texture (Y=0.07) */}
      {showOverlay && (
        <mesh
          geometry={HEX_FLAT_GEOMETRY}
          scale={[hexSize, 1, hexSize]}
          position={[0, OVERLAY_LIFT, 0]}
        >
          <meshBasicMaterial
            color={fillColor}
            transparent
            opacity={0.45}
            depthWrite={false}
          />
        </mesh>
      )}
      {/* v1.6 — Bords remontés. Atténués (opacity 0.15) en idle visible pour adoucir
          le quadrillage sur la texture. Plein opacity quand state actif. */}
      <lineSegments
        geometry={HEX_EDGES}
        scale={[hexSize, 1, hexSize]}
        position={[0, OVERLAY_LIFT + 0.001, 0]}
      >
        <lineBasicMaterial
          color={edgeColor}
          transparent
          opacity={state === 'idle' && visibility === 'visible' ? 0.15 : 1}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

export const HexTile = memo(HexTileBase)
