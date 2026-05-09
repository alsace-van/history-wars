// v1.0 (09/05/2026) — Camera orbitale contrainte par SCALE_CONFIG[scale].camera
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { Scale } from '@/types/game'
import { SCALE_CONFIG } from '@engine/scales'

interface CameraControllerProps {
  scale: Scale
  target?: [number, number, number]
}

export function CameraController({
  scale,
  target = [0, 0, 0],
}: CameraControllerProps) {
  const { camera } = SCALE_CONFIG[scale]
  const initialDistance = (camera.minDistance + camera.maxDistance) / 2

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, initialDistance * 0.7, initialDistance * 0.7]}
        fov={45}
        near={0.1}
        far={1000}
      />
      <OrbitControls
        target={target}
        enableDamping
        dampingFactor={0.08}
        minDistance={camera.minDistance}
        maxDistance={camera.maxDistance}
        minPolarAngle={camera.minPolarAngle}
        maxPolarAngle={camera.maxPolarAngle}
        // Pas de panning illimite : on contraint au plan XZ
        screenSpacePanning={false}
        // Pas de rotation tilt complet
        enablePan
      />
    </>
  )
}
