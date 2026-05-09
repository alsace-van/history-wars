// v1.0 (09/05/2026) — L1C.3+ : modele 3D soldier.glb teinte par team, remplace cylindre
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Team } from '@/types/game'
import { COLORS } from '../colors'

const SOLDIER_URL = '/models/soldier.glb'

// Preload : declenche le fetch au mount du module (avant le premier render unit)
useGLTF.preload(SOLDIER_URL)

interface SoldierMeshProps {
  team: Team
  /** Reduction d'opacite si l'unite est epuisee (a deja agi). */
  opacity?: number
  /** Boost emissive si selectionne. */
  selected?: boolean
}

export function SoldierMesh({ team, opacity = 1, selected = false }: SoldierMeshProps) {
  const { scene } = useGLTF(SOLDIER_URL) as unknown as { scene: THREE.Group }

  // Cloner la scene + les materiaux (sinon partage entre toutes les units → tint global)
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true)
    const tint = new THREE.Color(team === 'red' ? COLORS.teamRed : COLORS.teamBlue)

    cloned.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]
      if (Array.isArray(src)) {
        mesh.material = src.map(m => cloneTinted(m, tint, opacity, selected))
      } else {
        mesh.material = cloneTinted(src, tint, opacity, selected)
      }
      mesh.castShadow = false
      mesh.receiveShadow = false
    })

    return cloned
    // depend de team/opacity/selected pour rebuild le tint
  }, [scene, team, opacity, selected])

  return <primitive object={clonedScene} />
}

function cloneTinted(
  src: THREE.MeshStandardMaterial,
  tint: THREE.Color,
  opacity: number,
  selected: boolean
): THREE.MeshStandardMaterial {
  const m = src.clone()
  // baseColorFactor multiplie la texture → teinte preservant les details
  m.color = tint.clone()
  if (opacity < 1) {
    m.transparent = true
    m.opacity = opacity
  }
  if (selected) {
    m.emissive = tint.clone()
    m.emissiveIntensity = 0.45
  }
  return m
}
