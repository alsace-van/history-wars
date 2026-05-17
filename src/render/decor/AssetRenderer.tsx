// v1.1 (17/05/2026) — Phase 5 Lot B.4-bis : support kind 'custom' (GLB uploade) via customAssetsById
// v1.0 (17/05/2026) — Phase 5 Lot B.4 : dispatch AssetKind -> composant Mesh

import { PineTreeMesh } from './PineTreeMesh'
import { LeafTreeMesh } from './assets/LeafTreeMesh'
import { LogMesh } from './assets/LogMesh'
import { RockMesh } from './assets/RockMesh'
import { BushMesh } from './assets/BushMesh'
import { WallMesh } from './assets/WallMesh'
import { TrenchMesh } from './assets/TrenchMesh'
import { WaterMesh } from './assets/WaterMesh'
import { CustomGLBMesh } from './assets/CustomGLBMesh'
import type { AssetKind, PlacedAsset } from '@hooks/useHexTemplates'
import type { HexAsset } from '@hooks/useHexAssets'

const PRESET_MESH: Record<Exclude<AssetKind, 'custom'>, React.FC<{ scale?: number }>> = {
  pine_tree: PineTreeMesh,
  leaf_tree: LeafTreeMesh,
  log: LogMesh,
  rock: RockMesh,
  bush: BushMesh,
  wall: WallMesh,
  trench: TrenchMesh,
  water: WaterMesh,
}

interface AssetRendererProps {
  asset: PlacedAsset
  /** Lookup customAssetId -> HexAsset (URL GLB). Fourni par le parent. */
  customAssetsById?: Map<string, HexAsset>
}

/**
 * Render un PlacedAsset a sa position / scale / rotation locale dans l'hex.
 * Le parent place le groupe a la position monde de l'hex et applique hexSize.
 * dx, dz sont en coordonnees normalisees [-1, 1] (rayon hex = 1).
 *
 * Si asset.kind === 'custom' : resout l'URL via customAssetsById[asset.customAssetId].
 * Si l'asset n'est pas trouve (suppression, pas encore charge), on render null silently.
 */
export function AssetRenderer({ asset, customAssetsById }: AssetRendererProps) {
  let content: React.ReactNode = null
  if (asset.kind === 'custom') {
    const meta = asset.customAssetId ? customAssetsById?.get(asset.customAssetId) : undefined
    if (meta) content = <CustomGLBMesh url={meta.url} scale={asset.scale} />
  } else {
    const Mesh = PRESET_MESH[asset.kind]
    content = <Mesh scale={asset.scale} />
  }
  return (
    <group position={[asset.dx, 0, asset.dz]} rotation={[0, asset.rotationY, 0]}>
      {content}
    </group>
  )
}

/** Helper : nom lisible francais pour la palette / liste (presets uniquement). */
export const ASSET_LABEL: Record<Exclude<AssetKind, 'custom'>, string> = {
  pine_tree: 'Sapin',
  leaf_tree: 'Arbre feuillu',
  log: 'Tronc couche',
  rock: 'Rocher',
  bush: 'Buisson',
  wall: 'Mur',
  trench: 'Tranchee',
  water: 'Eau',
}

export const PRESET_KINDS_ORDERED: Exclude<AssetKind, 'custom'>[] = [
  'pine_tree', 'leaf_tree', 'bush', 'log', 'rock', 'wall', 'trench', 'water',
]

