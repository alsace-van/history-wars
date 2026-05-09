// v1.1 (09/05/2026) — L1C.3 : selected ring (amber) + onClick + animation lerp 300ms via useFrame
// v1.0 (09/05/2026) — Placeholder unite : cylindre colore + label Billboard
import { useEffect, useMemo, useRef } from 'react'
import { Billboard, Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { cubeToWorld } from '@engine/hex'
import type { UnitInstance } from '../types'
import { COLORS } from '../colors'

interface UnitPlaceholderProps {
  unit: UnitInstance
  hexSize: number
  selected?: boolean
  /** L1C.4 : halo rouge si cible cliquable. */
  targetable?: boolean
  /** Reduit l'opacite si l'unite a deja agi (visuel "epuise"). */
  exhausted?: boolean
  onClick?: (unit: UnitInstance) => void
  onPointerOver?: (unit: UnitInstance) => void
  onPointerOut?: (unit: UnitInstance) => void
}

const UNIT_HEIGHT = 0.6
const UNIT_RADIUS_RATIO = 0.45 // x hexSize
const LERP_DURATION_MS = 300
const SELECTED_RING_LIFT = 0.02

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function UnitPlaceholder({
  unit,
  hexSize,
  selected = false,
  targetable = false,
  exhausted = false,
  onClick,
  onPointerOver,
  onPointerOut,
}: UnitPlaceholderProps) {
  const { fillColor, edgeColor } = useMemo(() => {
    return unit.team === 'red'
      ? { fillColor: COLORS.teamRed, edgeColor: COLORS.teamRedBright }
      : { fillColor: COLORS.teamBlue, edgeColor: COLORS.teamBlueBright }
  }, [unit.team])

  const targetPos = useMemo<[number, number, number]>(() => {
    const w = cubeToWorld(unit.position, hexSize)
    return [w.x, UNIT_HEIGHT / 2 + 0.05, w.y]
  }, [unit.position, hexSize])

  const radius = hexSize * UNIT_RADIUS_RATIO

  // ---- Animation lerp position (piege #34 : nouveau target avant fin → repart de la position courante) ----
  const groupRef = useRef<THREE.Group>(null)
  const startPosRef = useRef<[number, number, number]>(targetPos)
  const startTimeRef = useRef<number>(0)
  const targetRef = useRef<[number, number, number]>(targetPos)

  // Init position au premier mount (sinon le mesh apparait a [0,0,0] le 1er frame)
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(targetPos[0], targetPos[1], targetPos[2])
      startPosRef.current = [targetPos[0], targetPos[1], targetPos[2]]
      targetRef.current = targetPos
    }
    // run once at mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Quand la cible change : capturer la position courante comme nouveau start, demarrer lerp
  useEffect(() => {
    if (!groupRef.current) return
    const cur = groupRef.current.position
    startPosRef.current = [cur.x, cur.y, cur.z]
    targetRef.current = targetPos
    startTimeRef.current = performance.now()
  }, [targetPos])

  useFrame(() => {
    if (!groupRef.current) return
    const elapsed = performance.now() - startTimeRef.current
    const t = Math.min(1, elapsed / LERP_DURATION_MS)
    const e = easeOutCubic(t)
    const [sx, sy, sz] = startPosRef.current
    const [tx, ty, tz] = targetRef.current
    groupRef.current.position.set(sx + (tx - sx) * e, sy + (ty - sy) * e, sz + (tz - sz) * e)
  })

  // ---- Handlers (stopPropagation pour eviter clic hex sous l'unite, piege #33) ----
  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    onClick?.(unit)
  }
  function handleOver(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    onPointerOver?.(unit)
  }
  function handleOut(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    onPointerOut?.(unit)
  }

  const opacity = exhausted ? 0.55 : 1

  return (
    <group ref={groupRef}>
      {/* Anneau selection (amber) au sol, plus grand que le cylindre */}
      {selected && (
        <mesh
          position={[0, -UNIT_HEIGHT / 2 + SELECTED_RING_LIFT, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[radius * 1.15, radius * 1.4, 32]} />
          <meshBasicMaterial
            color={COLORS.unitSelectedRing}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Halo cible (rouge) au sol — L1C.4 */}
      {targetable && !selected && (
        <mesh
          position={[0, -UNIT_HEIGHT / 2 + SELECTED_RING_LIFT, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[radius * 1.1, radius * 1.35, 32]} />
          <meshBasicMaterial
            color={COLORS.unitTargetableHalo}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Cylindre principal */}
      <mesh onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
        <cylinderGeometry args={[radius, radius, UNIT_HEIGHT, 16]} />
        <meshStandardMaterial
          color={fillColor}
          roughness={0.55}
          metalness={0.15}
          emissive={fillColor}
          emissiveIntensity={selected ? 0.35 : 0.15}
          transparent={exhausted}
          opacity={opacity}
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
