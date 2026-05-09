// v1.0 (09/05/2026) — Eclairage de scene : ambient + directional principale + fill
export function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.6} color={0xb8c4d8} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.1}
        color={0xfff4e0}
        castShadow={false}
      />
      {/* Fill light cote oppose pour adoucir les ombres */}
      <directionalLight
        position={[-8, 10, -6]}
        intensity={0.35}
        color={0x6e8eb8}
      />
    </>
  )
}
