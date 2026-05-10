// v1.0 (10/05/2026) — Phase 2 2.5 : chiffre rouge flottant au-dessus d'une unité après dégâts
// Billboard 3D auto-orienté caméra, anime Y (montée) + scale (shrink fin) + auto-disparition.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { cubeToWorld, type Cube } from '@engine/hex'

interface DamageFloaterProps {
  cube: Cube
  hexSize: number
  killed: number
  wounded: number
  /** Durée totale de la montée (ms). À 0, le composant ne devrait pas être monté. */
  durationMs: number
  onComplete: () => void
}

const RISE_HEIGHT = 1.6     // m de montée Y
const START_Y = 0.85         // au-dessus du sommet du soldat
const SHRINK_START = 0.7    // ratio à partir duquel on commence à shrink

export function DamageFloater({ cube, hexSize, killed, wounded, durationMs, onComplete }: DamageFloaterProps) {
  const groupRef = useRef<THREE.Group>(null)
  const startRef = useRef<number>(performance.now())
  const doneRef = useRef(false)

  // Reset le timer au mount (un nouveau floater = un nouveau cycle)
  useEffect(() => {
    startRef.current = performance.now()
    doneRef.current = false
  }, [])

  useFrame(() => {
    if (doneRef.current) return
    const g = groupRef.current
    if (!g) return
    const elapsed = performance.now() - startRef.current
    const t = Math.min(1, elapsed / Math.max(durationMs, 1))
    g.position.y = START_Y + t * RISE_HEIGHT
    if (t > SHRINK_START) {
      const fade = 1 - (t - SHRINK_START) / (1 - SHRINK_START)
      g.scale.setScalar(Math.max(0.01, fade))
    } else {
      g.scale.setScalar(1)
    }
    if (t >= 1) {
      doneRef.current = true
      onComplete()
    }
  })

  const world = cubeToWorld(cube, hexSize)
  const hasKilled = killed > 0
  const hasWounded = wounded > 0
  const label = hasKilled && hasWounded
    ? `-${killed} (+${wounded})`
    : hasKilled
      ? `-${killed}`
      : `+${wounded}`
  const color = hasKilled ? '#ef4444' : '#fb923c'

  return (
    <group ref={groupRef} position={[world.x, START_Y, world.y]}>
      <Billboard follow>
        <Text fontSize={0.42} color={color} outlineWidth={0.04} outlineColor="#000000" anchorX="center" anchorY="middle">
          {label}
        </Text>
      </Billboard>
    </group>
  )
}
