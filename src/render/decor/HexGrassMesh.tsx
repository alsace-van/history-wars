// v1.5 (17/05/2026) — Debug : log triangles 1x par variant au chargement
// v1.4 (17/05/2026) — 6 variantes : grass | dirt | flowers_mid | flowers_half | flowers_two_thirds | flowers
// v1.2 (17/05/2026) — 4 variantes : grass | dirt | flowers_mid | flowers
// v1.1 (17/05/2026) — 3 variantes : grass | dirt | flowers
//
// Convention :
//   - Hex unitaire (radius 1) plat dans plan XZ, normales +Y
//   - Le composant parent (TerrainDecor) scale par hexSize et place selon (cube → world)
//   - Lifted légèrement (Y=+0.001) au-dessus de TILE_THICKNESS/2 pour éviter z-fight

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export type GrassVariant =
  | 'grass'
  | 'dirt'
  | 'flowers_mid'        // densité fleurs faible (~33%)
  | 'flowers_half'       // densité fleurs ~50%
  | 'flowers_two_thirds' // densité fleurs ~66%
  | 'flowers'            // densité fleurs maximale (~100%)

const VARIANT_URL: Readonly<Record<GrassVariant, string>> = {
  grass: '/models/decor/hex_grass.glb',
  dirt: '/models/decor/hex_grass_dirt.glb',
  flowers_mid: '/models/decor/hex_grass_flowers_mid.glb',
  flowers_half: '/models/decor/hex_grass_flowers_half.glb',
  flowers_two_thirds: '/models/decor/hex_grass_flowers_two_thirds.glb',
  flowers: '/models/decor/hex_grass_flowers.glb',
}

// Préchargement des 6 variantes au mount.
for (const url of Object.values(VARIANT_URL)) useGLTF.preload(url)

// Debug : tris loggés 1x par variant chargée (set guard).
const loggedVariants = new Set<string>()
function logVariantTris(url: string, scene: THREE.Group) {
  if (loggedVariants.has(url)) return
  loggedVariants.add(url)
  let tris = 0
  let meshes = 0
  scene.traverse(obj => {
    const m = obj as THREE.Mesh
    if (!m.isMesh || !m.geometry) return
    meshes++
    const g = m.geometry as THREE.BufferGeometry
    const idx = g.index?.count ?? g.attributes.position?.count ?? 0
    tris += idx / 3
  })
  // eslint-disable-next-line no-console
  console.log('[HexGrassMesh v1.5]', 'variant chargee', { url, meshes, triangles: Math.round(tris) })
}

interface HexGrassMeshProps {
  scale: number
  /** Variante de texture (default 'grass'). */
  variant?: GrassVariant
  opacity?: number
}

export function HexGrassMesh({ scale, variant = 'grass', opacity = 1 }: HexGrassMeshProps) {
  const url = VARIANT_URL[variant]
  const { scene } = useGLTF(url) as unknown as { scene: THREE.Group }
  logVariantTris(url, scene)

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true)
    cloned.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]
      const apply = (m: THREE.MeshStandardMaterial) => {
        const mat = m.clone()
        if (opacity < 1) {
          mat.transparent = true
          mat.opacity = opacity
        }
        mat.roughness = 0.95
        mat.metalness = 0
        return mat
      }
      mesh.material = Array.isArray(src) ? src.map(apply) : apply(src)
    })
    return cloned
  }, [scene, opacity])

  return <primitive object={clonedScene} scale={scale} />
}
