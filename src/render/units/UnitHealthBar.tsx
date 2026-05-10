// v1.0 (10/05/2026) — Phase 1.5 : barre PV Billboard multi-segment (vert hp / orange wounded / vide killed)
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'

interface UnitHealthBarProps {
  hp: number
  hpMax: number
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
  hp,
  hpMax,
  wounded,
  yOffset,
  width,
  thickness = 0.09,
}: UnitHealthBarProps) {
  // Clamp ratios pour eviter les bugs si hp + wounded > hpMax (race / migration)
  const hpRatio = Math.max(0, Math.min(1, hp / hpMax))
  const woundedRatio = Math.max(0, Math.min(1 - hpRatio, wounded / hpMax))
  const killedRatio = 1 - hpRatio - woundedRatio

  const hpW = hpRatio * width
  const woundedW = woundedRatio * width
  const killedW = killedRatio * width

  // Positions : alignement depuis gauche (x = -width/2)
  // Centre de chaque segment = -width/2 + cumul + segmentW/2
  const xHp = -width / 2 + hpW / 2
  const xWounded = -width / 2 + hpW + woundedW / 2
  const xKilled = -width / 2 + hpW + woundedW + killedW / 2

  return (
    <Billboard position={[0, yOffset, 0]} follow lockX={false} lockY={false} lockZ={false}>
      {/* Fond / bordure tres legere derriere les 3 segments */}
      <mesh position={[0, 0, -0.001]}>
        <planeGeometry args={[width + 0.04, thickness + 0.04]} />
        <meshBasicMaterial color={COLOR_BORDER} side={THREE.DoubleSide} />
      </mesh>

      {hpW > 0 && (
        <mesh position={[xHp, 0, 0]}>
          <planeGeometry args={[hpW, thickness]} />
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
