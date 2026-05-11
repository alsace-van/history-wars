// v1.0 (11/05/2026) — Phase 2.5 C.2 : anneau d'état permanent sous l'unité (couleur selon pertes + cohésion)
// Source : docs/PLAN-MORAL-COHESION.md § 6 (système visuel multi-anneaux)
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CohesionState } from '@engine/cohesion'

interface UnitStatusRingProps {
  /** Rayon du ring (typiquement hexSize * 0.42, identique aux autres anneaux). */
  radius: number
  /** Hauteur Y au-dessus du sol (typiquement RING_LIFT). */
  liftY: number
  /** Ratio effectif vivant / effectiveMax (∈ [0, 1]). */
  effectiveRatio: number
  /** État cohésion. Si 'broken' → orange foncé clignotant. */
  cohesionState: CohesionState
  /** Si true, opacité augmentée (sélection ou hover). */
  prominent?: boolean
}

/**
 * Anneau de couleur indiquant l'état général de l'unité. Présent en permanence
 * sous chaque pion (opacité 0.4 idle, 0.8 prominent). Couleur dérivée :
 *
 *   Vert       : pertes < 25% ET cohesion 'nominal'
 *   Jaune      : pertes 25-50% OU cohesion 'shaken'
 *   Orange clair : pertes 50-75%
 *   Orange foncé : pertes > 75% OU cohesion 'broken' → clignotement subtil
 *
 * Performance : 1 mesh par unité, peu coûteux. Rendu en `meshBasicMaterial`
 * (pas d'éclairage), transparent + depthWrite=false (anti z-fight grille).
 */
export function UnitStatusRing({
  radius,
  liftY,
  effectiveRatio,
  cohesionState,
  prominent = false,
}: UnitStatusRingProps) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  // Décision couleur — combine pertes + état cohésion. cohesion 'broken' force orange foncé.
  const color = useMemo<number>(() => {
    if (cohesionState === 'broken') return 0xc2410c  // orange foncé (Tailwind orange-700)
    const losses = 1 - effectiveRatio  // 0 = intact, 1 = mort
    if (cohesionState === 'shaken') return 0xeab308  // jaune (= shaken déjà)
    if (losses < 0.25) return 0x22c55e  // vert
    if (losses < 0.5) return 0xeab308   // jaune
    if (losses < 0.75) return 0xfb923c  // orange clair
    return 0xc2410c                     // orange foncé
  }, [effectiveRatio, cohesionState])

  const baseOpacity = prominent ? 0.8 : 0.4

  // Clignotement subtil si Brisé (1.5s période, amplitude ±0.15).
  useFrame((state) => {
    if (!matRef.current) return
    if (cohesionState === 'broken') {
      const breath = (Math.sin(state.clock.elapsedTime * 4.2) + 1) / 2  // [0, 1]
      matRef.current.opacity = baseOpacity * (0.75 + 0.25 * breath)
    } else {
      matRef.current.opacity = baseOpacity
    }
  })

  return (
    <group position={[0, liftY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh renderOrder={0}>
        <ringGeometry args={[radius * 0.86, radius * 1.02, 48]} />
        <meshBasicMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={baseOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
