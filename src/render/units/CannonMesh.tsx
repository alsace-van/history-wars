// v1.1 (16/05/2026) — Bump scale 2.5 (silhouette artillerie trop petite vs cavalier).
// v1.0 (16/05/2026) — Mesh 3D canon (canonnier.glb) pour subKind 'artillery_heavy' (AC).
//   Pattern aligné sur CavalryMesh : useGLTF + clone scene + teinte d'équipe en emissive.
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Team } from '@/types/game'
import { COLORS } from '../colors'

const CANNON_URL = '/models/canonnier.glb'
useGLTF.preload(CANNON_URL)

// v1.1 — bump scale visuel (silhouette artillerie comparable au cavalier 2.8).
const CANNON_BBOX_SCALE = 2.5

interface CannonMeshProps {
  team: Team
  opacity?: number
  selected?: boolean
}

export function CannonMesh({ team, opacity = 1, selected = false }: CannonMeshProps) {
  const { scene } = useGLTF(CANNON_URL) as unknown as { scene: THREE.Group }

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

  return <primitive object={clonedScene} scale={CANNON_BBOX_SCALE} />
}

function cloneTinted(
  src: THREE.MeshStandardMaterial,
  tint: THREE.Color,
  opacity: number,
  emissiveIntensity: number
): THREE.MeshStandardMaterial {
  const m = src.clone()
  // Texture préservée (color reste blanc), teinte d'équipe en emissive (cohérent avec SoldierMesh/CavalryMesh).
  m.color = new THREE.Color(0xffffff)
  m.emissive = tint.clone()
  m.emissiveIntensity = emissiveIntensity
  if (opacity < 1) {
    m.transparent = true
    m.opacity = opacity
  }
  return m
}
