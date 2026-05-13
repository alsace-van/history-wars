// v2.1 (13/05/2026) — Phase 3.2-bis : lerp imperatif des segments effective/wounded sur ~600ms (clarté combat continu)
// v2.0 (10/05/2026) — Phase 2 2E.2 : segments effective/wounded/killed (au lieu de hp legacy)
// v1.0 (10/05/2026) — Phase 1.5 : barre PV Billboard multi-segment (vert hp / orange wounded / vide killed)
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
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

const LERP_DURATION_MS = 600

function clampRatio(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function UnitHealthBar({
  effective,
  effectiveMax,
  wounded,
  yOffset,
  width,
  thickness = 0.09,
}: UnitHealthBarProps) {
  // Refs pour update imperatif (evite re-render React 60fps).
  const effRef = useRef<THREE.Mesh>(null)
  const woundedRef = useRef<THREE.Mesh>(null)
  const killedRef = useRef<THREE.Mesh>(null)

  // Etat anim : valeurs cibles vs valeurs courantes affichees.
  const targetRef = useRef({ eff: 0, wounded: 0 })
  const currentRef = useRef({ eff: 0, wounded: 0 })
  const animRef = useRef({ from: { eff: 0, wounded: 0 }, startedAt: 0, active: false })
  const initRef = useRef(false)

  // Synchroniser cible quand props changent. Au premier mount : snap (pas d'anim).
  useEffect(() => {
    const safeMax = Math.max(1, effectiveMax)
    const targetEff = clampRatio(effective / safeMax)
    const targetWounded = clampRatio(wounded / safeMax)
    targetRef.current = { eff: targetEff, wounded: targetWounded }
    if (!initRef.current) {
      initRef.current = true
      currentRef.current = { eff: targetEff, wounded: targetWounded }
      animRef.current.active = false
      applyToMeshes(currentRef.current)
      return
    }
    // Demarrer une nouvelle anim depuis la valeur courante.
    animRef.current = {
      from: { ...currentRef.current },
      startedAt: performance.now(),
      active: true,
    }
  }, [effective, wounded, effectiveMax])

  // Mise a jour imperative des scales/positions a chaque frame durant l'anim.
  function applyToMeshes(values: { eff: number; wounded: number }) {
    const effRatio = values.eff
    // Cap wounded pour que eff + wounded <= 1 (garde-fou si race effective+wounded > effectiveMax).
    const woundedRatio = clampRatio(Math.min(values.wounded, 1 - effRatio))
    const killedRatio = clampRatio(1 - effRatio - woundedRatio)
    const effW = effRatio * width
    const woundedW = woundedRatio * width
    const killedW = killedRatio * width
    const xEff = -width / 2 + effW / 2
    const xWounded = -width / 2 + effW + woundedW / 2
    const xKilled = -width / 2 + effW + woundedW + killedW / 2
    const eff = effRef.current
    if (eff) {
      eff.visible = effW > 0
      if (effW > 0) {
        eff.scale.x = effW
        eff.position.x = xEff
      }
    }
    const wnd = woundedRef.current
    if (wnd) {
      wnd.visible = woundedW > 0
      if (woundedW > 0) {
        wnd.scale.x = woundedW
        wnd.position.x = xWounded
      }
    }
    const kld = killedRef.current
    if (kld) {
      kld.visible = killedW > 0
      if (killedW > 0) {
        kld.scale.x = killedW
        kld.position.x = xKilled
      }
    }
  }

  useFrame(() => {
    const a = animRef.current
    if (!a.active) return
    const elapsed = performance.now() - a.startedAt
    const t = Math.min(1, elapsed / LERP_DURATION_MS)
    const e = easeOutCubic(t)
    const target = targetRef.current
    const next = {
      eff: a.from.eff + (target.eff - a.from.eff) * e,
      wounded: a.from.wounded + (target.wounded - a.from.wounded) * e,
    }
    currentRef.current = next
    applyToMeshes(next)
    if (t >= 1) a.active = false
  })

  return (
    <Billboard position={[0, yOffset, 0]} follow lockX={false} lockY={false} lockZ={false}>
      {/* Fond / bordure tres legere derriere les 3 segments */}
      <mesh position={[0, 0, -0.001]}>
        <planeGeometry args={[width + 0.04, thickness + 0.04]} />
        <meshBasicMaterial color={COLOR_BORDER} side={THREE.DoubleSide} />
      </mesh>
      {/* Geometries unit width=1 ; on scale.x = largeur effective dans useFrame. */}
      <mesh ref={effRef} position={[0, 0, 0]}>
        <planeGeometry args={[1, thickness]} />
        <meshBasicMaterial color={COLOR_HEALTHY} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={woundedRef} position={[0, 0, 0]}>
        <planeGeometry args={[1, thickness]} />
        <meshBasicMaterial color={COLOR_WOUNDED} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={killedRef} position={[0, 0, 0]}>
        <planeGeometry args={[1, thickness]} />
        <meshBasicMaterial color={COLOR_KILLED} side={THREE.DoubleSide} />
      </mesh>
    </Billboard>
  )
}
