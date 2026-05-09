// v1.0 (09/05/2026) — Wrapper Canvas R3F : Suspense + tone mapping + bg transparent
import { Suspense, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { SceneLoader } from './SceneLoader'

interface SceneShellProps {
  children: ReactNode
  className?: string
}

export function SceneShell({ children, className }: SceneShellProps) {
  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        // Fond transparent pour laisser passer le PageBackground (Austerlitz)
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={<SceneLoader />}>{children}</Suspense>
      </Canvas>
    </div>
  )
}
