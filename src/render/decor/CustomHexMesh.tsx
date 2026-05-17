// v1.1 (17/05/2026) — Fix UVs : remap [-1,1] -> [0,1] (sinon ClampToEdgeWrapping en mode stretch
//                       montre seulement le quart positif de la texture, le reste etire en stries)
// v1.0 (17/05/2026) — Phase 5 Lot B.2 : mesh hex dynamique avec texture custom
//
// Charge une texture depuis URL Supabase Storage (bucket public hex-textures) et
// l'applique sur un hex flat. Mode 'stretch' = texture étirée sur tout le hex,
// mode 'tile' = texture répétée N×N (N = textureScale).
//
// Convention :
//   - Hex flat dans plan XZ, normales +Y
//   - UVs remappes en [0,1] sur bbox carre [-1,1] (preserve aspect ratio de la texture ;
//     ~14% de la texture en haut/bas n'est pas couverte par l'hex car hex height ~1.732 < width 2)
//   - Le composant parent (TerrainDecor) place via group position + scale par hexSize
//   - Texture clonée par instance pour éviter que plusieurs meshes même URL se
//     marchent dessus sur wrap/repeat (useTexture mémoize la base = shared)

import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

// Geometrie hex flat dediee avec UVs normalises [0,1] (pas reutilisable depuis HexTile dont
// les UVs sont en [-1,1] car non utilises - HexTile ne map jamais de texture).
const HEX_FLAT_GEOMETRY_UV01 = (() => {
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

  // Remap UVs : vertices en [-1,1] -> uv en [0,1]. Bbox carre (preserve aspect texture).
  const pos = geom.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    uv[i * 2] = (x + 1) / 2
    uv[i * 2 + 1] = (y + 1) / 2
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2))

  geom.rotateX(-Math.PI / 2)
  return geom
})()

export interface CustomHexMeshProps {
  textureUrl: string
  /** Si textureMode='tile' : tiling N×N. Ignoré en mode 'stretch'. */
  textureScale: number
  textureMode: 'stretch' | 'tile'
  /** Scale appliqué au mesh (= hexSize du jeu, typiquement 1). */
  hexSize: number
  /** Rotation Y radians (default 0). */
  rotationY?: number
}

export function CustomHexMesh({
  textureUrl,
  textureScale,
  textureMode,
  hexSize,
  rotationY = 0,
}: CustomHexMeshProps) {
  const baseTexture = useTexture(textureUrl) as THREE.Texture

  // Clone par instance : useTexture mémoize la base shared. Si plusieurs hex
  // utilisent la même URL avec scales différents, on doit pouvoir muter wrap/repeat
  // indépendamment.
  const texture = useMemo(() => {
    const t = baseTexture.clone()
    t.needsUpdate = true
    return t
  }, [baseTexture])

  useEffect(() => {
    if (textureMode === 'tile') {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(textureScale, textureScale)
    } else {
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.repeat.set(1, 1)
    }
    texture.needsUpdate = true
  }, [texture, textureMode, textureScale])

  return (
    <mesh
      geometry={HEX_FLAT_GEOMETRY_UV01}
      scale={[hexSize, 1, hexSize]}
      rotation={[0, rotationY, 0]}
    >
      <meshStandardMaterial map={texture} roughness={0.9} metalness={0} />
    </mesh>
  )
}
