// v1.2 (09/05/2026) — L1C.3+ : remplacement cylindre par SoldierMesh (glb teinte team)
// v1.1 (09/05/2026) — L1C.3 : selected ring (amber) + onClick + animation lerp 300ms via useFrame
// v1.0 (09/05/2026) — Placeholder unite : cylindre colore + label Billboard
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Billboard, Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { cubeToWorld } from '@engine/hex'
import type { UnitInstance } from '../types'
import { COLORS } from '../colors'
import { SoldierMesh } from './SoldierMesh'

interface UnitPlaceholderProps {
  unit: UnitInstance
  hexSize: number
  selected?: boolean
  targetable?: boolean
  exhausted?: boolean
  onClick?: (unit: UnitInstance) => void
  onPointerOver?: (unit: UnitInstance) => void
  onPointerOut?: (unit: UnitInstance) => void
}

const SOLDIER_SCALE_RATIO = 0.5 // x hexSize → hauteur ~1 unit (modele 2m centre)
const RING_LIFT = 0.02
const LERP_DURATION_MS = 300

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
  const targetPos = useMemo<[number, number, number]>(() => {
    const w = cubeToWorld(unit.position, hexSize)
    return [w.x, 0, w.y]
  }, [unit.position, hexSize])

  const ringRadius = hexSize * 0.42
  const facingY = unit.team === 'red' ? Math.PI : 0
  const soldierScale = hexSize * SOLDIER_SCALE_RATIO
  // Pieds au sol : modele a min Y=-1 → translate Y de +scale (1*scale)
  const soldierTranslateY = soldierScale

  // ---- Animation lerp position ----
  const groupRef = useRef<THREE.Group>(null)
  const startPosRef = useRef<[number, number, number]>(targetPos)
  const startTimeRef = useRef<number>(0)
  const targetRef = useRef<[number, number, number]>(targetPos)

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(targetPos[0], targetPos[1], targetPos[2])
      startPosRef.current = [targetPos[0], targetPos[1], targetPos[2]]
      targetRef.current = targetPos
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      {/* Ring selection (amber) */}
      {selected && (
        <mesh position={[0, RING_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringRadius * 1.0, ringRadius * 1.3, 32]} />
          <meshBasicMaterial
            color={COLORS.unitSelectedRing}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Halo cible rouge (L1C.4) */}
      {targetable && !selected && (
        <mesh position={[0, RING_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringRadius * 0.95, ringRadius * 1.25, 32]} />
          <meshBasicMaterial
            color={COLORS.unitTargetableHalo}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Hitbox cylindre invisible : zone click/hover stable meme si glb a des trous */}
      <mesh
        position={[0, soldierScale, 0]}
        onClick={handleClick}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        <cylinderGeometry args={[ringRadius, ringRadius, soldierScale * 2, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Soldat 3D teinte par team */}
      <group
        position={[0, soldierTranslateY, 0]}
        rotation={[0, facingY, 0]}
        scale={[soldierScale, soldierScale, soldierScale]}
      >
        <Suspense fallback={null}>
          <SoldierMesh team={unit.team} opacity={opacity} selected={selected} />
        </Suspense>
      </group>

      {/* Label Billboard au-dessus de la tete */}
      <Billboard
        position={[0, soldierScale * 2.2 + 0.2, 0]}
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
