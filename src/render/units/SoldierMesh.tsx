// v1.1 (09/05/2026) — Fix : texture preservee (color=white), teinte team via emissive
// v1.0 (09/05/2026) — L1C.3+ : modele 3D soldier.glb teinte par team
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Team } from '@/types/game'
import { COLORS } from '../colors'

const SOLDIER_URL = '/models/soldier.glb'
useGLTF.preload(SOLDIER_URL)

interface SoldierMeshProps {
  team: Team
  opacity?: number
  selected?: boolean
}

export function SoldierMesh({ team, opacity = 1, selected = false }: SoldierMeshProps) {
  const { scene } = useGLTF(SOLDIER_URL) as unknown as { scene: THREE.Group }

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

  return <primitive object={clonedScene} />
}

function cloneTinted(
  src: THREE.MeshStandardMaterial,
  tint: THREE.Color,
  opacity: number,
  emissiveIntensity: number
): THREE.MeshStandardMaterial {
  const m = src.clone()
  // Texture preservee (color reste blanc → multiplication texture x white = texture).
  // Teinte d'equipe appliquee en emissive : visible, ne tue pas la texture sombre.
  m.color = new THREE.Color(0xffffff)
  m.emissive = tint.clone()
  m.emissiveIntensity = emissiveIntensity
  if (opacity < 1) {
    m.transparent = true
    m.opacity = opacity
  }
  return m
}
