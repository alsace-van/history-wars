// v2.13 (14/05/2026) — Phase 3.3 : pictogrammes activeOrder thématiques (♞ charge / ⚔ fire / ↩ retreat / 🛡 hold)
// v2.12 (14/05/2026) — Phase 3.3 : activeOrder déplacé sous le count (au-dessus était masqué par la barre PV)
// v2.11 (14/05/2026) — Phase 3.3 : marge icônes ⚔/⬢ augmentée (anti-chevauchement label)
// v2.10 (14/05/2026) — Phase 3.3 Lot B : icône activeOrder (→/↗/↖/◆) au-dessus du label
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Billboard, Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { CohesionState, SupportCount } from '@engine/cohesion'
import { cubeToWorld, type Cube } from '@engine/hex'
import type { Team } from '@/types/game'
import type { UnitInstance } from '../types'
import type { UnitKind } from '@/types/game'
import { COLORS } from '../colors'
import { SoldierMesh } from './SoldierMesh'
import { CavalryMesh } from './CavalryMesh'
import { UnitHealthBar } from './UnitHealthBar'
import { UnitStatusRing } from './UnitStatusRing'
import { UnitSupportRing } from './UnitSupportRing'

interface UnitPlaceholderProps {
  unit: UnitInstance
  hexSize: number
  selected?: boolean
  targetable?: boolean
  /** v2.3 : unité proposée comme cible de fusion (halo bleu cyan statique). */
  mergeTarget?: boolean
  exhausted?: boolean
  /** Phase 1.5 : unité impliquée dans le rapport combat actif → halo jaune pulsant pour identification visuelle. */
  highlighted?: boolean
  /**
   * Equipe du joueur courant. Si renseigne et que `unit.team === viewerTeam`,
   * la barre PV detaillee (vert/orange/morts) est affichee. Sinon — fog of war.
   */
  viewerTeam?: Team | null
  /**
   * Chemin a animer case par case (incluant start). Si fourni et length>=2,
   * anime segment par segment a SECONDS_PER_HEX par segment. Sinon lerp direct.
   */
  path?: ReadonlyArray<Cube>
  onPathDone?: (unitId: string) => void
  onClick?: (unit: UnitInstance) => void
  onPointerOver?: (unit: UnitInstance) => void
  onPointerOut?: (unit: UnitInstance) => void
  /** Phase 2.5 C.2 : état cohésion (nominal/shaken/broken) — couleur anneau état. */
  cohesionState?: CohesionState
  /** Phase 2.5 C.2 : décompte soutien — cercles bleus superposés. */
  support?: SupportCount
  /**
   * Phase 3.1-B : silhouette = ennemi repéré sans identification. Mesh atténué (opacity 0.35),
   * pas de label kind, pas d'anneaux cohésion/soutien, pas de healthbar. Reste cliquable
   * pour QW2 (panel "Identification incomplète").
   */
  silhouette?: boolean
}

const SOLDIER_SCALE_RATIO = 0.5
const RING_LIFT = 0.1 // halo : bien au-dessus de TILE_THICKNESS/2 + EDGE_LIFT (0.045) — piege #47
const RING_NET_LIFT = RING_LIFT + 0.004 // net : 4mm au-dessus du halo — anti z-fight coplanaire (piege #47)

// v2.2 : vitesse d'animation par UnitKind (secondes par hex traverse).
// La cavalerie galope (rapide), l'infanterie 800h marche au pas (lente),
// l'artillerie tracte ses pieces (la plus lente). Pure cosmetique, n'affecte
// pas la logique de combat ni la portee de mouvement (UNIT_STATS_V2.movement).
const SECONDS_PER_HEX_BY_KIND: Readonly<Record<UnitKind, number>> = {
  C: 0.45,
  I: 1.40,
  A: 1.80,
}
const DEFAULT_SECONDS_PER_HEX = 1.0

// v2.5 — hauteur visuelle du mesh par kind (en unités locales × soldierScale).
// Sert à positionner le label kind ("I", "C", "A") au-dessus du sommet du mesh.
// Soldier : bbox unitaire Y ∈ [-1, 1] → top à 2 × soldierScale.
// Cavalier : bbox interne × CAVALRY_BBOX_SCALE=2.8 → top à 2.8 × soldierScale.
const MESH_TOP_HEIGHT_BY_KIND: Readonly<Record<UnitKind, number>> = {
  I: 2.0,
  C: 2.8,
  A: 2.0,
}

// Scale visuel selon effective / effectiveMax. Plage 0.35-1.0 amplifiee Phase 2
// pour mieux differencier visuellement un pion de 100 vs 800 hommes.
const MIN_SOLDIER_SCALE_FACTOR = 0.35
const MAX_SOLDIER_SCALE_FACTOR = 1.0

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
  mergeTarget = false,
  exhausted = false,
  highlighted = false,
  viewerTeam,
  path,
  onPathDone,
  onClick,
  onPointerOver,
  onPointerOut,
  cohesionState,
  support,
  silhouette = false,
}: UnitPlaceholderProps) {
  const targetPos = useMemo<[number, number, number]>(() => cubeWorld(unit.position, hexSize), [unit.position, hexSize])

  const ringRadius = hexSize * 0.42
  const facingY = unit.team === 'red' ? Math.PI : 0

  // Scale soldat Phase 2 : ratio effective/effectiveMax (effectif elastique).
  // Visible par les 2 equipes (observation de la masse). Fallback hp/hpMax v1 si effective absent.
  const eff = unit.effective ?? unit.hp ?? 1
  const effMax = unit.effectiveMax ?? unit.hpMax ?? 1
  const effectiveRatio = effMax > 0 ? Math.max(0, Math.min(1, eff / effMax)) : 1
  const scaleFactor = MIN_SOLDIER_SCALE_FACTOR + (MAX_SOLDIER_SCALE_FACTOR - MIN_SOLDIER_SCALE_FACTOR) * effectiveRatio
  const soldierScale = hexSize * SOLDIER_SCALE_RATIO * scaleFactor
  const soldierTranslateY = soldierScale

  // Hitbox + ring restent a la taille de base (cliquabilite + selection visuelle stables).
  const baseScale = hexSize * SOLDIER_SCALE_RATIO

  // Barre PV detaillee : seulement pour mes propres unites (fog of war partiel)
  const showHealthBar = !!viewerTeam && unit.team === viewerTeam && effMax > 0

  // ---- Refs animation (path step par step OU lerp direct) ----
  const groupRef = useRef<THREE.Group>(null)
  const segIdxRef = useRef(0)
  const segStartRef = useRef<[number, number, number]>(targetPos)
  const segEndRef = useRef<[number, number, number]>(targetPos)
  const segStartTimeRef = useRef(0)
  // v2.2 : duree par hex calculee depuis le kind (galop cav / pas inf / tract art).
  const segmentDurationMsForKind = (SECONDS_PER_HEX_BY_KIND[unit.kind] ?? DEFAULT_SECONDS_PER_HEX) * 1000
  const segDurationRef = useRef(segmentDurationMsForKind)
  const pathRef = useRef<ReadonlyArray<Cube> | null>(null)
  const animatingRef = useRef(false)
  const doneCalledRef = useRef(false)

  // ---- Refs glow selection (breathing pulse) ----
  const glowGroupRef = useRef<THREE.Group>(null)
  const innerRingMatRef = useRef<THREE.MeshBasicMaterial>(null)

  // ---- Refs highlight rapport combat (Phase 1.5 : pulse jaune separe du selection ring) ----
  const highlightGroupRef = useRef<THREE.Group>(null)

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
      segDurationRef.current = segmentDurationMsForKind
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

  useFrame(({ clock }) => {
    // 1. Animation deplacement (segment ou lerp)
    if (animatingRef.current && groupRef.current) {
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
    }

    // 2. Breathing pulse glow selection (halos scale + ring net opacity)
    if (selected) {
      const breath = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.2) // 0..1
      if (glowGroupRef.current) {
        glowGroupRef.current.scale.setScalar(0.97 + 0.06 * breath)
      }
      if (innerRingMatRef.current) {
        innerRingMatRef.current.opacity = 0.7 + 0.25 * breath
      }
    }

    // 3. Pulse highlight rapport combat (Phase 1.5) : amplitude plus large pour attirer l'attention
    if (highlighted && highlightGroupRef.current) {
      const breath = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.0)
      highlightGroupRef.current.scale.setScalar(0.95 + 0.10 * breath)
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

  // v2.6 : silhouette = ennemi repéré, mesh atténué. Override exhausted/normal.
  const opacity = silhouette ? 0.35 : (exhausted ? 0.55 : 1)

  // Phase 2.5 C.2 : ratio effective/effectiveMax pour la couleur du status ring
  const cohesionRatio = effMax > 0 ? eff / effMax : 0
  const statusRingLift = RING_LIFT - 0.003  // 3mm sous les anneaux d'action (anti z-fight)
  const supportRingLift = RING_LIFT - 0.001 // 1mm sous (mais au-dessus du status)

  return (
    <group ref={groupRef}>
      {/* Phase 2.5 C.2 — couche basse : anneau d'état permanent (vert/jaune/orange).
          v2.6 : masqué en mode silhouette (l'observateur ne connaît pas la cohésion exacte). */}
      {!silhouette && cohesionState && (
        <UnitStatusRing
          radius={ringRadius}
          liftY={statusRingLift}
          effectiveRatio={cohesionRatio}
          cohesionState={cohesionState}
          routed={unit.routed === true}
          prominent={selected || highlighted}
        />
      )}
      {/* Phase 2.5 C.2 — couche bleue soutien (cercles concentriques selon alliés). */}
      {!silhouette && support && (
        <UnitSupportRing
          radius={ringRadius}
          liftY={supportRingLift}
          support={support}
        />
      )}
      {/* Highlight rapport combat actif (Phase 1.5) : 3 halos jaunes additifs pulsants */}
      {highlighted && (
        <group ref={highlightGroupRef}>
          <group position={[0, RING_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh renderOrder={0}>
              <ringGeometry args={[ringRadius * 1.35, ringRadius * 2.2, 64]} />
              <meshBasicMaterial color={0xfbbf24} transparent opacity={0.10} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh renderOrder={0}>
              <ringGeometry args={[ringRadius * 1.15, ringRadius * 1.7, 64]} />
              <meshBasicMaterial color={0xfbbf24} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh renderOrder={0}>
              <ringGeometry args={[ringRadius * 0.95, ringRadius * 1.4, 64]} />
              <meshBasicMaterial color={0xfbbf24} transparent opacity={0.30} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        </group>
      )}
      {selected && (
        <>
          {/* Halos additifs empilés (scale-pulse via glowGroupRef) → glow doux en gradient */}
          <group ref={glowGroupRef}>
            <group position={[0, RING_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              {/* Halo très large (faible opacité) */}
              <mesh renderOrder={1}>
                <ringGeometry args={[ringRadius * 1.25, ringRadius * 2.0, 64]} />
                <meshBasicMaterial color={COLORS.unitSelectedRing} transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
              {/* Halo médium */}
              <mesh renderOrder={2}>
                <ringGeometry args={[ringRadius * 1.1, ringRadius * 1.55, 64]} />
                <meshBasicMaterial color={COLORS.unitSelectedRing} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
              {/* Halo proche (plus dense) */}
              <mesh renderOrder={3}>
                <ringGeometry args={[ringRadius * 1.0, ringRadius * 1.32, 64]} />
                <meshBasicMaterial color={COLORS.unitSelectedRing} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
            </group>
          </group>
          {/* Ring net (opacity-pulse via innerRingMatRef) — contour clair, normal blending */}
          <group position={[0, RING_NET_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh renderOrder={4}>
              <ringGeometry args={[ringRadius * 1.06, ringRadius * 1.2, 64]} />
              <meshBasicMaterial ref={innerRingMatRef} color={COLORS.unitSelectedRing} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        </>
      )}
      {targetable && !selected && (
        <>
          {/* Halos additifs rouges (statique, pas de pulse) */}
          <group position={[0, RING_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh renderOrder={1}>
              <ringGeometry args={[ringRadius * 1.2, ringRadius * 1.85, 64]} />
              <meshBasicMaterial color={COLORS.unitTargetableHalo} transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh renderOrder={2}>
              <ringGeometry args={[ringRadius * 1.05, ringRadius * 1.45, 64]} />
              <meshBasicMaterial color={COLORS.unitTargetableHalo} transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh renderOrder={3}>
              <ringGeometry args={[ringRadius * 0.95, ringRadius * 1.25, 64]} />
              <meshBasicMaterial color={COLORS.unitTargetableHalo} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
          <group position={[0, RING_NET_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh renderOrder={4}>
              <ringGeometry args={[ringRadius * 1.0, ringRadius * 1.18, 64]} />
              <meshBasicMaterial color={COLORS.unitTargetableHalo} transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        </>
      )}
      {mergeTarget && !selected && (
        <>
          {/* v2.3 — Halos additifs bleus cyan (cible fusion, statique) */}
          <group position={[0, RING_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh renderOrder={1}>
              <ringGeometry args={[ringRadius * 1.2, ringRadius * 1.85, 64]} />
              <meshBasicMaterial color={COLORS.unitMergeTargetHalo} transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh renderOrder={2}>
              <ringGeometry args={[ringRadius * 1.05, ringRadius * 1.45, 64]} />
              <meshBasicMaterial color={COLORS.unitMergeTargetHalo} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh renderOrder={3}>
              <ringGeometry args={[ringRadius * 0.95, ringRadius * 1.25, 64]} />
              <meshBasicMaterial color={COLORS.unitMergeTargetHalo} transparent opacity={0.24} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
          <group position={[0, RING_NET_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh renderOrder={4}>
              <ringGeometry args={[ringRadius * 1.0, ringRadius * 1.18, 64]} />
              <meshBasicMaterial color={COLORS.unitMergeTargetHalo} transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        </>
      )}

      {/* Hitbox cylindre invisible : taille fixe (baseScale) pour stabilite click/hover. */}
      <mesh position={[0, baseScale, 0]} onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
        <cylinderGeometry args={[ringRadius, ringRadius, baseScale * 2, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group position={[0, soldierTranslateY, 0]} rotation={[0, facingY, 0]} scale={[soldierScale, soldierScale, soldierScale]}>
        <Suspense fallback={null}>
          {unit.kind === 'C' ? (
            <CavalryMesh team={unit.team} opacity={opacity} selected={selected} />
          ) : (
            <SoldierMesh team={unit.team} opacity={opacity} selected={selected} />
          )}
        </Suspense>
      </group>

      {/* Phase 2 : barre effectif multi-segment (vert effective / orange wounded / sombre tues) — own only.
          v2.6 : masquée en mode silhouette. */}
      {!silhouette && showHealthBar && (
        <UnitHealthBar
          effective={eff}
          effectiveMax={effMax}
          wounded={unit.wounded ?? 0}
          yOffset={baseScale * 2.2 + 0.55}
          width={baseScale * 1.6}
        />
      )}

      <Billboard position={[0, soldierScale * MESH_TOP_HEIGHT_BY_KIND[unit.kind] + 0.3, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {(() => {
          const labelText = silhouette ? '?' : (unit.ordinalLabel ?? unit.kind)
          // v2.11 : offset = demi-largeur texte + demi-largeur icône + marge.
          // drei <Text> sans-serif fontSize 0.32 → ~0.18 par char en moyenne.
          // demi-largeur label = len * 0.09, demi-largeur icône (fontSize 0.28) ≈ 0.16,
          // marge confort 0.18 → total = len * 0.09 + 0.35. Anti-chevauchement même avec
          // outline 0.028. Bumpé depuis v2.9 (0.28 marge insuffisante : icônes touchaient I.1).
          const iconOffsetX = labelText.length * 0.09 + 0.50
          const orderIcon = !silhouette && showHealthBar ? resolveActiveOrderIcon(unit.activeOrder) : null
          return (
            <>
              {/* v2.7 : ordinalLabel (I.1, C.2…) si dispo, sinon kind ; "?" en silhouette. */}
              <Text fontSize={0.32} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.025} outlineColor="#000000">
                {labelText}
              </Text>
              {/* v2.12 (Lot B) : icône d'ordre conditionnel actif (priority=1) SOUS le count.
                  Placement initial au-dessus (v2.10) chevauchait la barre PV — descendu sous "120".
                  Seulement pour mes pions (RLS owner-only filtre côté Map source). */}
              {orderIcon && (
                <Text
                  position={[0, -0.62, 0]}
                  fontSize={0.24}
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={0.025}
                  outlineColor="#000000"
                  color={orderIcon.color}
                >
                  {orderIcon.char}
                </Text>
              )}
              {/* v2.8 : icônes d'état d'ordres EN LIGNE de part et d'autre du label.
                  ⚔ gauche = attaque · ⬢ droite = mouvement. Vert dispo · orange limité · rouge consommé. */}
              {!silhouette && showHealthBar && (
                <>
                  <Text
                    position={[-iconOffsetX, 0.02, 0]}
                    fontSize={0.28}
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.028}
                    outlineColor="#000000"
                    color={resolveAttackIconColor(unit)}
                  >
                    ⚔
                  </Text>
                  <Text
                    position={[iconOffsetX, 0.02, 0]}
                    fontSize={0.28}
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.028}
                    outlineColor="#000000"
                    color={resolveMoveIconColor(unit)}
                  >
                    ⬢
                  </Text>
                </>
              )}
            </>
          )
        })()}
        {/* Phase 1.5 : effectif chiffre visible uniquement pour mes propres unites (fog of war partiel). */}
        {!silhouette && showHealthBar && unit.count !== undefined && (
          <Text position={[0, -0.32, 0]} fontSize={0.18} color="#e2e8f0" anchorX="center" anchorY="middle" outlineWidth={0.018} outlineColor="#000000">
            {unit.count}
          </Text>
        )}
      </Billboard>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Phase 3.2-bis : couleurs d'état d'ordres (utilisé par UnitPlaceholder ET BattleSidebar).
// ---------------------------------------------------------------------------
const ICON_GREEN = '#22c55e'
const ICON_ORANGE = '#fb923c'
const ICON_RED = '#ef4444'

export function resolveAttackIconColor(unit: UnitInstance): string {
  if (unit.routed) return ICON_RED
  if (unit.hasAttacked) return ICON_RED
  return ICON_GREEN
}

export function resolveMoveIconColor(unit: UnitInstance): string {
  if (unit.hasMoved) return ICON_RED
  if (unit.routed) return ICON_ORANGE  // déroute : 1 hex / tour (mouvement limité)
  if (unit.engaged) return ICON_ORANGE  // engagement : Rompre requis avant mouvement
  return ICON_GREEN
}

// Phase 3.3 Lot B — pictogrammes thématiques pour l'ordre conditionnel actif (priority=1).
// v2.13 : symboles cohérents avec l'action : cavalier=charge, épée=tir/attaque,
// flèche retour=repli, bouclier=tenir position. Couleurs sémantiques inchangées.
const ORDER_ICON: Record<NonNullable<UnitInstance['activeOrder']>, { char: string; color: string }> = {
  charge:  { char: '♞',  color: '#ef4444' },  // chess knight = cavalier (aggressif)
  fire:    { char: '⚔',  color: '#fb923c' },  // épée = attaque
  retreat: { char: '↩',  color: '#60a5fa' },  // flèche retour = repli
  hold:    { char: '🛡',  color: '#94a3b8' },  // bouclier = tenir
}

export function resolveActiveOrderIcon(kind: UnitInstance['activeOrder']): { char: string; color: string } | null {
  if (!kind) return null
  return ORDER_ICON[kind] ?? null
}
