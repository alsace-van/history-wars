// v1.6 (17/05/2026) — Perf zoom : cache module shared scene par url + clone materials
//                      seulement si highlighted (sinon partage via clone hierarchy uniquement)
// v1.5 (17/05/2026) — Fix : invalidate() apres mutation material (sinon frameloop="demand"
//                      ne redessine pas et le highlight reste a l'etat initial)
// v1.4 (17/05/2026) — Clone materials par instance + prop highlighted (emissive ambre)
// v1.3 (17/05/2026) — Log triangle count au chargement

import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

const HIGHLIGHT_COLOR = new THREE.Color('#EF9F27')
const HIGHLIGHT_INTENSITY = 0.55

interface CustomGLBMeshProps {
  url: string
  scale?: number
  /** Si true, applique un emissive ambre sur tous les materials du GLB (selection visuelle). */
  highlighted?: boolean
}

/**
 * Cache module-level d'une scene "prete a l'emploi" (recentree X/Z, base Y=0) par url.
 * Toutes les instances non-highlighted clonent cette scene partagee (hierarchy uniquement,
 * geometry + material partages par reference) → 1 set de materials/GPU buffers pour N instances.
 * Sans ce cache, chaque instance faisait scene.clone(true) + clone de tous les materials.
 */
const sharedSceneCache = new Map<string, THREE.Group>()

function getOrPrepareSharedScene(scene: THREE.Group, url: string): THREE.Group {
  const cached = sharedSceneCache.get(url)
  if (cached) return cached

  const prepared = scene.clone(true)

  // Centre X/Z + base au sol Y=0.
  const box = new THREE.Box3().setFromObject(prepared)
  const size = new THREE.Vector3()
  box.getSize(size)
  const center = new THREE.Vector3()
  box.getCenter(center)
  prepared.position.set(-center.x, -box.min.y, -center.z)

  let tris = 0
  let meshes = 0
  let transparentCount = 0
  prepared.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    meshes++
    const g = mesh.geometry as THREE.BufferGeometry
    const idx = g.index?.count ?? g.attributes.position?.count ?? 0
    tris += idx / 3
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      if ((m as THREE.Material).transparent) transparentCount++
    }
  })

  const triCount = Math.round(tris)
  // eslint-disable-next-line no-console
  console.log('[CustomGLBMesh v1.6]', 'GLB prepare (1x par url)', {
    url,
    nativeSize: { x: +size.x.toFixed(4), y: +size.y.toFixed(4), z: +size.z.toFixed(4) },
    meshes,
    triangles: triCount,
    transparent: transparentCount,
    heavy: tris > 100000 ? '⚠ lourd' : 'ok',
    transparentWarn: transparentCount > 0 ? '⚠ alpha blending = lent au zoom' : 'ok',
  })
  // Warnings tres visibles si le GLB est probleme.
  if (triCount > 50000) {
    // eslint-disable-next-line no-console
    console.warn(`[CustomGLBMesh] ⚠⚠⚠ GLB TROP LOURD : ${triCount.toLocaleString()} triangles (${url}). Decimer dans Blender avec Decimate Modifier (target < 30k tris) puis recompresser avec glb-compressor.`)
  }
  if (transparentCount > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[CustomGLBMesh] ⚠ ${transparentCount} material(s) transparent dans ${url} → overdraw GPU au zoom in. Verifier que l'alpha est necessaire ou utiliser alphaTest.`)
  }

  sharedSceneCache.set(url, prepared)
  return prepared
}

export function CustomGLBMesh({ url, scale = 1, highlighted = false }: CustomGLBMeshProps) {
  const { scene } = useGLTF(url) as unknown as { scene: THREE.Group }
  const invalidate = useThree(s => s.invalidate)

  const cloned = useMemo(() => {
    const shared = getOrPrepareSharedScene(scene, url)

    if (!highlighted) {
      // Hierarchy clonee, materials/geometry partages → cheap. Pas de mutation possible.
      return shared.clone(true)
    }

    // Highlighted : on clone aussi les materials pour pouvoir muter emissive sans
    // affecter les autres instances (qui partagent les materials du shared).
    const c = shared.clone(true)
    c.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh || !mesh.material) return
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(m => m.clone())
      } else {
        mesh.material = mesh.material.clone()
      }
    })
    return c
  }, [scene, url, highlighted])

  // Highlight emissive : applique UNIQUEMENT quand highlighted (materials per-instance).
  // Quand highlighted bascule a false, le useMemo recree un cloned avec materials partages
  // (non mutes), donc l'emissive disparait naturellement via remount du primitive.
  useEffect(() => {
    if (!highlighted) return
    cloned.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh || !mesh.material) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial
        if (!std.emissive) continue
        std.emissive = HIGHLIGHT_COLOR
        std.emissiveIntensity = HIGHLIGHT_INTENSITY
        std.needsUpdate = true
      }
    })
    invalidate()
  }, [cloned, highlighted, invalidate])

  return (
    <group scale={scale}>
      <primitive object={cloned} />
    </group>
  )
}
