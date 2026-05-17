// v1.6 (17/05/2026) — Perf : Canvas dpr [1, 1.5] (vs Retina 2x/3x natif)
// v1.5 (17/05/2026) — Phase 5 Lot B.4-bis : prop placeholderHex
// v1.4 (17/05/2026) — Phase 5 Lot B.4-bis : passe customAssetsById a AssetRenderer
// v1.3 (17/05/2026) — Phase 5 Lot B.4 : render des placed assets 3D au-dessus de l'hex

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { CustomHexMesh } from '@render/decor/CustomHexMesh'
import { AssetRenderer } from '@render/decor/AssetRenderer'
import type { PlacedAsset } from '@hooks/useHexTemplates'
import type { HexAsset } from '@hooks/useHexAssets'

interface HexPreview3DProps {
  textureUrl: string | null
  textureScale: number
  textureMode: 'stretch' | 'tile'
  /** Dimension du carre canvas en px (default 280). */
  size?: number
  /** Assets 3D a render au-dessus de l'hex. */
  assets?: PlacedAsset[]
  /** Lookup customAssetId -> HexAsset pour resoudre les GLB custom. */
  customAssetsById?: Map<string, HexAsset>
  /** Si true et textureUrl=null : affiche un hex placeholder gris (pour preview "assets seuls"). */
  placeholderHex?: boolean
}

// Geometrie hex placeholder (memoize au module-level, partage entre toutes les instances).
const PLACEHOLDER_HEX_GEOM = (() => {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3
    const x = Math.cos(angle)
    const y = -Math.sin(angle)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const g = new THREE.ShapeGeometry(shape)
  g.rotateX(-Math.PI / 2)
  return g
})()

export function HexPreview3D({
  textureUrl,
  textureScale,
  textureMode,
  size = 280,
  assets = [],
  customAssetsById,
  placeholderHex = false,
}: HexPreview3DProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: 'rgba(2, 6, 23, 0.5)',
        border: '1px solid rgba(239, 159, 39, 0.25)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{ position: [1.0, 3.0, 1.8], fov: 38 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 2]} intensity={1.0} />
        <Suspense fallback={null}>
          {textureUrl ? (
            <CustomHexMesh
              textureUrl={textureUrl}
              textureScale={textureScale}
              textureMode={textureMode}
              hexSize={1}
            />
          ) : placeholderHex ? (
            <mesh geometry={PLACEHOLDER_HEX_GEOM}>
              <meshStandardMaterial color="#2a3142" roughness={0.95} />
            </mesh>
          ) : null}
          {assets.map((a, i) => (
            <AssetRenderer key={i} asset={a} customAssetsById={customAssetsById} />
          ))}
        </Suspense>
      </Canvas>
    </div>
  )
}
