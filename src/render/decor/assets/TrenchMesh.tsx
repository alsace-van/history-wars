// v1.0 (17/05/2026) — Phase 5 Lot B.4 : tranchee (rectangle sombre legerement enfonce + bord)
// Convention : origin centre/sol. Simule un creux par un Box sombre Y negatif + un cadre fin Y=0.
// Oriente le long de l'axe X (rotationY pour pivoter).

interface TrenchMeshProps {
  scale?: number
}

export function TrenchMesh({ scale = 1 }: TrenchMeshProps) {
  return (
    <group scale={scale}>
      {/* Fond creuse (sombre) */}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[0.6, 0.08, 0.18]} />
        <meshStandardMaterial color="#3a2917" roughness={1} />
      </mesh>
      {/* Bord avant */}
      <mesh position={[0, 0.005, -0.11]}>
        <boxGeometry args={[0.6, 0.02, 0.04]} />
        <meshStandardMaterial color="#5a4628" roughness={0.95} />
      </mesh>
      {/* Bord arriere */}
      <mesh position={[0, 0.005, 0.11]}>
        <boxGeometry args={[0.6, 0.02, 0.04]} />
        <meshStandardMaterial color="#5a4628" roughness={0.95} />
      </mesh>
    </group>
  )
}
