// v1.2 (12/05/2026) — Scale ×2.8 (silhouette visuelle cavalier plus tassée que soldat debout)
// v1.1 (12/05/2026) — Scale ×2 : bbox cavalier (Y ∈ [-0.5, 0.5]) vs soldier (Y ∈ [-1, 1])
// v1.0 (12/05/2026) — Mesh 3D cavalerie (cavalier.glb) — même logique de teinte que SoldierMesh
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Team } from '@/types/game'
import { COLORS } from '../colors'

const CAVALRY_URL = '/models/cavalier.glb'
useGLTF.preload(CAVALRY_URL)

// v1.2 — Bbox Y unitaire = 1.0 (vs 2.0 pour soldier). Le ratio strict serait ×2.0
// mais la silhouette d'un cavalier (homme étalé horizontalement sur un cheval) paraît
// visuellement plus tassée qu'un soldat debout droit. On surcompense à ×2.8 pour que
// le cavalier domine légèrement sur le plateau, comme dans la réalité historique.
const CAVALRY_BBOX_SCALE = 2.8

interface CavalryMeshProps {
  team: Team
  opacity?: number
  selected?: boolean
}

export function CavalryMesh({ team, opacity = 1, selected = false }: CavalryMeshProps) {
  const { scene } = useGLTF(CAVALRY_URL) as unknown as { scene: THREE.Group }

  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true)
    const tint = new THREE.Color(team === 'red' ? COLORS.teamRed : COLORS.teamBlue)
    const emissiveIntensity = selected ? 0.85 : 0.55

    cloned.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]
      if (Array.isArray(src)) {
        mesh.material = src.map(m => cloneTinted(m, tint, opacity, emissiveIntensity))
      } else {
        mesh.material = cloneTinted(src, tint, opacity, emissiveIntensity)
      }
    })

    return cloned
  }, [scene, team, opacity, selected])

  return <primitive object={clonedScene} scale={CAVALRY_BBOX_SCALE} />
}

function cloneTinted(
  src: THREE.MeshStandardMaterial,
  tint: THREE.Color,
  opacity: number,
  emissiveIntensity: number
): THREE.MeshStandardMaterial {
  const m = src.clone()
  // Texture préservée (color reste blanc), teinte d'équipe en emissive (cohérent avec SoldierMesh v1.1).
  m.color = new THREE.Color(0xffffff)
  m.emissive = tint.clone()
  m.emissiveIntensity = emissiveIntensity
  if (opacity < 1) {
    m.transparent = true
    m.opacity = opacity
  }
  return m
}
