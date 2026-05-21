// v1.0 (17/05/2026) — Phase 5 Lot B.4 : tronc couche (cylindre horizontal, axe Z)
// Convention : origin centre, base touche le sol (Y = radius).

interface LogMeshProps {
  scale?: number
}

export function LogMesh({ scale = 1 }: LogMeshProps) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 10]} />
        <meshStandardMaterial color="#5c3e22" roughness={0.95} />
      </mesh>
    </group>
  )
}
