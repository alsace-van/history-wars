// v1.0 (17/05/2026) — Phase 5 Lot 1 : sapin stylisé (4 étages cônes + tronc cylindre)
// Asset Blender généré : 7.7KB, 3 primitives. Hauteur native ~1.18m.

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const PINE_URL = '/models/decor/pine_tree.glb'
useGLTF.preload(PINE_URL)

interface PineTreeMeshProps {
  /** Scale appliqué (default 1 = arbre 1.18m de hauteur). */
  scale?: number
}

export function PineTreeMesh({ scale = 1 }: PineTreeMeshProps) {
  const { scene } = useGLTF(PINE_URL) as unknown as { scene: THREE.Group }
  const cloned = useMemo(() => scene.clone(true), [scene])
  return <primitive object={cloned} scale={scale} />
}
