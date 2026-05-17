// v1.0 (17/05/2026) — Phase 5 Lot B.4 : mur de pierre (BoxGeometry)
// Convention : origin centre/sol, oriente le long de l'axe X (rotationY pour pivoter).

interface WallMeshProps {
  scale?: number
}

export function WallMesh({ scale = 1 }: WallMeshProps) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.65, 0.3, 0.08]} />
        <meshStandardMaterial color="#898680" roughness={0.95} />
      </mesh>
    </group>
  )
}
