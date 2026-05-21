// v1.0 (17/05/2026) — Phase 5 Lot B.4 : rocher icosaedrique flat-shaded
// Convention : origin centre/sol, hauteur native ~0.3.

interface RockMeshProps {
  scale?: number
}

export function RockMesh({ scale = 1 }: RockMeshProps) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.12, 0]}>
        <icosahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial color="#6e7178" roughness={0.85} flatShading />
      </mesh>
    </group>
  )
}
