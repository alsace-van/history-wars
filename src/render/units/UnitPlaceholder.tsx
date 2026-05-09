// v1.0 (09/05/2026) — Placeholder unite : cylindre colore + label Billboard
import { useMemo } from 'react'
import { Billboard, Text } from '@react-three/drei'
import { cubeToWorld } from '@engine/hex'
import type { UnitInstance } from '../types'
import { COLORS } from '../colors'

interface UnitPlaceholderProps {
  unit: UnitInstance
  hexSize: number
}

const UNIT_HEIGHT = 0.6
const UNIT_RADIUS_RATIO = 0.45 // x hexSize

export function UnitPlaceholder({ unit, hexSize }: UnitPlaceholderProps) {
  const { fillColor, edgeColor } = useMemo(() => {
    return unit.team === 'red'
      ? { fillColor: COLORS.teamRed, edgeColor: COLORS.teamRedBright }
      : { fillColor: COLORS.teamBlue, edgeColor: COLORS.teamBlueBright }
  }, [unit.team])

  const position = useMemo<[number, number, number]>(() => {
    const w = cubeToWorld(unit.position, hexSize)
    return [w.x, UNIT_HEIGHT / 2 + 0.05, w.y]
  }, [unit.position, hexSize])

  const radius = hexSize * UNIT_RADIUS_RATIO

  return (
    <group position={position}>
      {/* Cylindre principal */}
      <mesh>
        <cylinderGeometry args={[radius, radius, UNIT_HEIGHT, 16]} />
        <meshStandardMaterial
          color={fillColor}
          roughness={0.55}
          metalness={0.15}
          emissive={fillColor}
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Anneau bordure haut */}
      <mesh position={[0, UNIT_HEIGHT / 2 - 0.04, 0]}>
        <torusGeometry args={[radius, 0.025, 8, 24]} />
        <meshStandardMaterial color={edgeColor} roughness={0.4} />
      </mesh>
      {/* Label Billboard, toujours face camera */}
      <Billboard
        position={[0, UNIT_HEIGHT / 2 + 0.4, 0]}
        follow
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <Text
          fontSize={0.32}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#000000"
        >
          {unit.kind}
        </Text>
        {unit.count !== undefined && (
          <Text
            position={[0, -0.32, 0]}
            fontSize={0.18}
            color="#e2e8f0"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.018}
            outlineColor="#000000"
          >
            {unit.count}
          </Text>
        )}
      </Billboard>
    </group>
  )
}
