// v1.4 (10/05/2026) — Fix ring sélection : RING_LIFT 0.06 → 0.1 anti z-fighting (cf piege #47)
// v1.3 (09/05/2026) — Animation case par case via prop path[] (au lieu de lerp direct A→D)
// v1.2 (09/05/2026) — L1C.3+ : remplacement cylindre par SoldierMesh (glb teinte team)
// v1.1 (09/05/2026) — L1C.3 : selected ring (amber) + onClick + animation lerp 300ms via useFrame
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Billboard, Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { cubeToWorld, type Cube } from '@engine/hex'
import type { UnitInstance } from '../types'
import { COLORS } from '../colors'
import { SoldierMesh } from './SoldierMesh'

interface UnitPlaceholderProps {
  unit: UnitInstance
  hexSize: number
  selected?: boolean
  targetable?: boolean
  exhausted?: boolean
  /**
   * Chemin a animer case par case (incluant start). Si fourni et length>=2,
   * anime segment par segment a SECONDS_PER_HEX par segment. Sinon lerp direct.
   */
  path?: ReadonlyArray<Cube>
  onPathDone?: (unitId: string) => void
  onClick?: (unit: UnitInstance) => void
  onPointerOver?: (unit: UnitInstance) => void
  onPointerOut?: (unit: UnitInstance) => void
}

const SOLDIER_SCALE_RATIO = 0.5
const RING_LIFT = 0.1 // bien au-dessus de TILE_THICKNESS/2 + EDGE_LIFT (0.045) — anti z-fighting (piege #47)
const SECONDS_PER_HEX = 1.0
const SEGMENT_DURATION_MS = SECONDS_PER_HEX * 1000

// Linear : vitesse constante a travers le path, pas de pause a chaque case

function cubeWorld(c: Cube, hexSize: number): [number, number, number] {
  const w = cubeToWorld(c, hexSize)
  return [w.x, 0, w.y]
}

export function UnitPlaceholder({
  unit,
  hexSize,
  selected = false,
  targetable = false,
  exhausted = false,
  path,
  onPathDone,
  onClick,
  onPointerOver,
  onPointerOut,
}: UnitPlaceholderProps) {
  const targetPos = useMemo<[number, number, number]>(() => cubeWorld(unit.position, hexSize), [unit.position, hexSize])

  const ringRadius = hexSize * 0.42
  const facingY = unit.team === 'red' ? Math.PI : 0
  const soldierScale = hexSize * SOLDIER_SCALE_RATIO
  const soldierTranslateY = soldierScale

  // ---- Refs animation (path step par step OU lerp direct) ----
  const groupRef = useRef<THREE.Group>(null)
  const segIdxRef = useRef(0)
  const segStartRef = useRef<[number, number, number]>(targetPos)
  const segEndRef = useRef<[number, number, number]>(targetPos)
  const segStartTimeRef = useRef(0)
  const segDurationRef = useRef(SEGMENT_DURATION_MS)
  const pathRef = useRef<ReadonlyArray<Cube> | null>(null)
  const animatingRef = useRef(false)
  const doneCalledRef = useRef(false)

  // Mount initial : pose direct (pas d'animation)
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(targetPos[0], targetPos[1], targetPos[2])
      segStartRef.current = [targetPos[0], targetPos[1], targetPos[2]]
      segEndRef.current = [targetPos[0], targetPos[1], targetPos[2]]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Quand path change : demarrer animation segment par segment
  useEffect(() => {
    if (!groupRef.current) return
    if (path && path.length >= 2) {
      pathRef.current = path
      segIdxRef.current = 1 // path[0] = start (deja la), on vise path[1]
      const cur = groupRef.current.position
      segStartRef.current = [cur.x, cur.y, cur.z]
      segEndRef.current = cubeWorld(path[1], hexSize)
      segDurationRef.current = SEGMENT_DURATION_MS
      segStartTimeRef.current = performance.now()
      animatingRef.current = true
      doneCalledRef.current = false
    }
    // Si pas de path → on laisse le useEffect targetPos prendre le relais
  }, [path, hexSize])

  // Si pas d'animation path en cours, lerp direct sur target change (Realtime fallback)
  useEffect(() => {
    if (!groupRef.current) return
    if (animatingRef.current) return // une anim path est en cours, on ne perturbe pas
    const cur = groupRef.current.position
    const dx = cur.x - targetPos[0]
    const dy = cur.y - targetPos[1]
    const dz = cur.z - targetPos[2]
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001 && Math.abs(dz) < 0.001) return
    // Demarrer un lerp direct (1 segment, duree = 300ms)
    pathRef.current = null
    segIdxRef.current = 1
    segStartRef.current = [cur.x, cur.y, cur.z]
    segEndRef.current = targetPos
    segDurationRef.current = 300
    segStartTimeRef.current = performance.now()
    animatingRef.current = true
    doneCalledRef.current = true // pas de path → pas de onPathDone
  }, [targetPos])

  useFrame(() => {
    if (!animatingRef.current || !groupRef.current) return
    const elapsed = performance.now() - segStartTimeRef.current
    const t = Math.min(1, elapsed / segDurationRef.current)
    const e = t // linear, pas de freinage par segment
    const [sx, sy, sz] = segStartRef.current
    const [ex, ey, ez] = segEndRef.current
    groupRef.current.position.set(sx + (ex - sx) * e, sy + (ey - sy) * e, sz + (ez - sz) * e)

    if (t >= 1) {
      // Segment fini
      const p = pathRef.current
      const nextIdx = segIdxRef.current + 1
      if (p && nextIdx < p.length) {
        segIdxRef.current = nextIdx
        segStartRef.current = [...segEndRef.current] as [number, number, number]
        segEndRef.current = cubeWorld(p[nextIdx], hexSize)
        segStartTimeRef.current = performance.now()
      } else {
        animatingRef.current = false
        if (!doneCalledRef.current && p) {
          doneCalledRef.current = true
          onPathDone?.(unit.id)
        }
      }
    }
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
      {selected && (
        <group position={[0, RING_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          {/* Halo flou (opacite faible, plus large) */}
          <mesh>
            <ringGeometry args={[ringRadius * 0.95, ringRadius * 1.55, 48]} />
            <meshBasicMaterial color={COLORS.unitSelectedRing} transparent opacity={0.25} side={THREE.DoubleSide} />
          </mesh>
          {/* Ring net */}
          <mesh>
            <ringGeometry args={[ringRadius * 1.05, ringRadius * 1.25, 48]} />
            <meshBasicMaterial color={COLORS.unitSelectedRing} transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      {targetable && !selected && (
        <group position={[0, RING_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <ringGeometry args={[ringRadius * 0.9, ringRadius * 1.45, 48]} />
            <meshBasicMaterial color={COLORS.unitTargetableHalo} transparent opacity={0.2} side={THREE.DoubleSide} />
          </mesh>
          <mesh>
            <ringGeometry args={[ringRadius * 1.0, ringRadius * 1.2, 48]} />
            <meshBasicMaterial color={COLORS.unitTargetableHalo} transparent opacity={0.75} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      <mesh position={[0, soldierScale, 0]} onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
        <cylinderGeometry args={[ringRadius, ringRadius, soldierScale * 2, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group position={[0, soldierTranslateY, 0]} rotation={[0, facingY, 0]} scale={[soldierScale, soldierScale, soldierScale]}>
        <Suspense fallback={null}>
          <SoldierMesh team={unit.team} opacity={opacity} selected={selected} />
        </Suspense>
      </group>

      <Billboard position={[0, soldierScale * 2.2 + 0.2, 0]} follow lockX={false} lockY={false} lockZ={false}>
        <Text fontSize={0.32} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.025} outlineColor="#000000">
          {unit.kind}
        </Text>
        {unit.count !== undefined && (
          <Text position={[0, -0.32, 0]} fontSize={0.18} color="#e2e8f0" anchorX="center" anchorY="middle" outlineWidth={0.018} outlineColor="#000000">
            {unit.count}
          </Text>
        )}
      </Billboard>
    </group>
  )
}
