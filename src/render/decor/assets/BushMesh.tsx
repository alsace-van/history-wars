// v1.0 (17/05/2026) — Phase 5 Lot B.4 : buisson (3 spheres vert sombre cluster)
// Convention : origin centre/sol, hauteur native ~0.25.

interface BushMeshProps {
  scale?: number
}

export function BushMesh({ scale = 1 }: BushMeshProps) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color="#2d5a1f" roughness={0.9} />
      </mesh>
      <mesh position={[0.09, 0.08, 0.03]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color="#356b25" roughness={0.9} />
      </mesh>
      <mesh position={[-0.08, 0.09, -0.05]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial color="#2d5a1f" roughness={0.9} />
      </mesh>
    </group>
  )
}
