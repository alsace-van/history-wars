// v2.0 (10/05/2026) — Phase 2 2E.2 : segments effective/wounded/killed (au lieu de hp legacy)
// v1.0 (10/05/2026) — Phase 1.5 : barre PV Billboard multi-segment (vert hp / orange wounded / vide killed)
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'

interface UnitHealthBarProps {
  /** Hommes vivants combattants (Phase 2 v2). */
  effective: number
  /** Capacite plein regiment (Phase 2 v2). */
  effectiveMax: number
  /** Hommes blesses (Phase 2 v2). */
  wounded: number
  /** Position Y au-dessus du soldat (deja calcule dans le parent). */
  yOffset: number
  /** Largeur totale de la barre en unites world. */
  width: number
  /** Epaisseur de la barre. */
  thickness?: number
}

const COLOR_HEALTHY = 0x22c55e
const COLOR_WOUNDED = 0xfb923c
const COLOR_KILLED = 0x1f2937
const COLOR_BORDER = 0x0f172a

export function UnitHealthBar({
  effective,
  effectiveMax,
  wounded,
  yOffset,
  width,
  thickness = 0.09,
}: UnitHealthBarProps) {
  // Clamp ratios pour eviter les bugs si effective + wounded > effectiveMax (race)
  const effectiveRatio = Math.max(0, Math.min(1, effective / Math.max(1, effectiveMax)))
  const woundedRatio = Math.max(0, Math.min(1 - effectiveRatio, wounded / Math.max(1, effectiveMax)))
  const killedRatio = 1 - effectiveRatio - woundedRatio

  const effW = effectiveRatio * width
  const woundedW = woundedRatio * width
  const killedW = killedRatio * width

  const xEff = -width / 2 + effW / 2
  const xWounded = -width / 2 + effW + woundedW / 2
  const xKilled = -width / 2 + effW + woundedW + killedW / 2

  return (
    <Billboard position={[0, yOffset, 0]} follow lockX={false} lockY={false} lockZ={false}>
      {/* Fond / bordure tres legere derriere les 3 segments */}
      <mesh position={[0, 0, -0.001]}>
        <planeGeometry args={[width + 0.04, thickness + 0.04]} />
        <meshBasicMaterial color={COLOR_BORDER} side={THREE.DoubleSide} />
      </mesh>

      {effW > 0 && (
        <mesh position={[xEff, 0, 0]}>
          <planeGeometry args={[effW, thickness]} />
          <meshBasicMaterial color={COLOR_HEALTHY} side={THREE.DoubleSide} />
        </mesh>
      )}
      {woundedW > 0 && (
        <mesh position={[xWounded, 0, 0]}>
          <planeGeometry args={[woundedW, thickness]} />
          <meshBasicMaterial color={COLOR_WOUNDED} side={THREE.DoubleSide} />
        </mesh>
      )}
      {killedW > 0 && (
        <mesh position={[xKilled, 0, 0]}>
          <planeGeometry args={[killedW, thickness]} />
          <meshBasicMaterial color={COLOR_KILLED} side={THREE.DoubleSide} />
        </mesh>
      )}
    </Billboard>
  )
}
