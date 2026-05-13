// v1.1 (13/05/2026) — Phase 3.2-bis : badge T+N (tours engagés) au milieu de la ligne
// v1.0 (11/05/2026) — Phase 2.6 C : ligne 3D rouge entre 2 pions engagés en mêlée persistante
// Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 8 (indicateur visuel engagement)
//
// Convention render TACTICA : world.x → Three.js X, world.y → Three.js Z (plan sol).
// Y = hauteur (vertical) ; la conversion Y↔Z est encapsulée dans render/ (piège #5).

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { cubeToWorld, type Cube } from '@engine/hex'

export interface EngagementPair {
  /** Identifiant unique de la paire (engagement id BDD). */
  id: string
  positionA: Cube
  positionB: Cube
  /** Phase 3.2-bis : nombre de tours écoulés depuis le début de l'engagement (1 = ce tour). */
  turnsActive?: number
}

interface EngagementOverlayProps {
  /** Liste des engagements actifs à afficher. */
  engagements: ReadonlyArray<EngagementPair>
  hexSize: number
  /** Hauteur Y de la ligne au-dessus du sol (default 0.08m). */
  liftY?: number
  /** Couleur de la ligne (default rouge tactica). */
  color?: string
}

/**
 * Dessine une ligne 3D rouge entre chaque paire d'unités engagées.
 * Animée par pulse d'opacité (0.4 → 0.9) pour signaler la mêlée continue.
 *
 * Pas d'interactivité (overlay visuel pur). Si une unité disparaît (cascade FK),
 * le caller met à jour `engagements` et le composant disparaît au prochain render.
 *
 * Implémentation : `THREE.Line` natif via `<line>` JSX (R3F). On évite drei
 * `<Line>` qui utilise Line2 (typage onUpdate incompatible avec material classique).
 */
export function EngagementOverlay({
  engagements,
  hexSize,
  liftY = 0.08,
  color = '#dc2626',
}: EngagementOverlayProps) {
  // Précalcule les BufferGeometry pour éviter recalculs à chaque frame.
  const segments = useMemo(() => {
    return engagements.map(e => {
      const wa = cubeToWorld(e.positionA, hexSize)
      const wb = cubeToWorld(e.positionB, hexSize)
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [wa.x, liftY, wa.y, wb.x, liftY, wb.y],
          3,
        ),
      )
      const midX = (wa.x + wb.x) / 2
      const midZ = (wa.y + wb.y) / 2
      return { id: e.id, geometry, turnsActive: e.turnsActive, midX, midZ }
    })
  }, [engagements, hexSize, liftY])

  return (
    <group renderOrder={3}>
      {segments.map(s => (
        <group key={s.id}>
          <PulsingLine geometry={s.geometry} color={color} />
          {s.turnsActive != null && s.turnsActive > 0 && (
            <Billboard position={[s.midX, liftY + 0.6, s.midZ]} follow>
              <Text
                fontSize={0.32}
                color="#fef3c7"
                outlineWidth={0.04}
                outlineColor="#7f1d1d"
                anchorX="center"
                anchorY="middle"
              >
                {`⚔ T+${s.turnsActive}`}
              </Text>
            </Billboard>
          )}
        </group>
      ))}
    </group>
  )
}

/**
 * Une ligne dont l'opacité pulse [0.4, 0.9] sur ~1.5s. Cohérent avec l'idée de
 * "mêlée en cours" (signal visuel non-statique pour distinguer du anneau targetable).
 */
function PulsingLine({
  geometry,
  color,
}: {
  geometry: THREE.BufferGeometry
  color: string
}) {
  const materialRef = useRef<THREE.LineBasicMaterial | null>(null)

  useFrame(({ clock }) => {
    const m = materialRef.current
    if (!m) return
    const t = clock.elapsedTime
    m.opacity = 0.65 + 0.25 * Math.sin((t / 1.5) * Math.PI * 2)
  })

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.65}
        depthWrite={false}
        linewidth={3}
      />
    </line>
  )
}
