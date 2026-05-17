// v1.0 (17/05/2026) — Phase 5 Lot B.4 : arbre feuillu stylise (tronc cylindre + sphere feuillage)
// Convention : origin centre/sol (Y=0), hauteur native ~0.75 unite hex.

interface LeafTreeMeshProps {
  scale?: number
}

export function LeafTreeMesh({ scale = 1 }: LeafTreeMeshProps) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.3, 8]} />
        <meshStandardMaterial color="#6b4423" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color="#4a7c2e" roughness={0.85} />
      </mesh>
    </group>
  )
}
