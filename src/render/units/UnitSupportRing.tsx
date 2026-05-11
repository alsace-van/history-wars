// v1.0 (11/05/2026) — Phase 2.5 C.2 : anneau bleu de soutien (1-3 cercles selon alliés adjacents)
// Source : docs/PLAN-MORAL-COHESION.md § 6
import * as THREE from 'three'
import type { SupportCount } from '@engine/cohesion'

interface UnitSupportRingProps {
  /** Rayon de base du ring (typiquement hexSize * 0.42). */
  radius: number
  /** Hauteur Y au-dessus du sol (au-dessus du status ring). */
  liftY: number
  support: SupportCount
}

/**
 * Cercle(s) bleu(s) concentrique(s) selon le soutien (alliés non-Brisés rayon 1+2).
 *
 *   0 allié rayon 1, 0 rayon 2  → rien
 *   1 adjacent                  → 1 cercle fin
 *   2 adjacents                 → 1 cercle plus épais
 *   3 adjacents                 → 1 cercle épais + glow
 *
 * Le rayon 2 contribue moins visuellement (épaisseur +1 si nearby ≥ 2).
 */
export function UnitSupportRing({ radius, liftY, support }: UnitSupportRingProps) {
  const { adjacent, nearby } = support
  if (adjacent === 0 && nearby === 0) return null

  // Calcule "intensité" visuelle (0-3 environ)
  const intensity = Math.min(3, adjacent + (nearby >= 2 ? 1 : 0))
  const opacity = 0.35 + intensity * 0.18  // 0.35, 0.53, 0.71, 0.89
  const thickness = 0.03 + intensity * 0.015 // 0.03, 0.045, 0.06, 0.075
  const innerR = radius * 1.05
  const outerR = innerR + thickness * radius

  return (
    <group position={[0, liftY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh renderOrder={1}>
        <ringGeometry args={[innerR, outerR, 48]} />
        <meshBasicMaterial
          color={0x3b82f6}  // bleu (Tailwind blue-500)
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {intensity >= 3 && (
        // Glow additif fin pour 3+ alliés
        <mesh renderOrder={2}>
          <ringGeometry args={[outerR, outerR + 0.04 * radius, 48]} />
          <meshBasicMaterial
            color={0x60a5fa}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  )
}
