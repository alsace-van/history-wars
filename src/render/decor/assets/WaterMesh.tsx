// v1.0 (17/05/2026) — Phase 5 Lot B.4 : plan d'eau (carre bleu translucide legerement au-dessus du sol)
// Convention : origin centre/sol. Pas de shader anime (a venir Phase 5+).

interface WaterMeshProps {
  scale?: number
}

export function WaterMesh({ scale = 1 }: WaterMeshProps) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshStandardMaterial
          color="#2a6fa3"
          roughness={0.3}
          metalness={0.1}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}
