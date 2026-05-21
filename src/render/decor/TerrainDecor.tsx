// v1.2 (17/05/2026) — Phase 5 Lot B.5 : render des hex_templates customs via CustomHexMesh + AssetRenderer
//                      Quand un hex a un template_id resolu, son rendu natif (grass + arbres) est skipped
// v1.1 (17/05/2026) — bosquet + foret aussi (sol vert + arbres en superposition)
// v1.0 (17/05/2026) — Phase 5 Lot 1 : couche de décors 3D selon terrainType

import { Suspense, useMemo } from 'react'
import type { Cube } from '@engine/hex'
import { cubeToWorld, parseCubeKey } from '@engine/hex'
import type { TerrainType } from '@engine/terrain/types'
import { HexGrassMesh, type GrassVariant } from './HexGrassMesh'
import { PineTreeMesh } from './PineTreeMesh'
import { CustomHexMesh } from './CustomHexMesh'
import { AssetRenderer } from './AssetRenderer'
import type { HexTemplate } from '@hooks/useHexTemplates'
import type { HexAsset } from '@hooks/useHexAssets'

interface TerrainDecorProps {
  /** Map cubeKey "q,r" → TerrainType (output de useTerrainTiles). */
  terrainMap: Map<string, TerrainType>
  hexSize: number
  /** Y lift au-dessus du sol pour éviter z-fight avec HexTile (default 0.05). */
  liftY?: number
  /** Phase 5 Lot B.5 : Map cubeKey -> templateId pour les hex avec custom template. */
  templateMap?: Map<string, string>
  /** Phase 5 Lot B.5 : Lookup templateId -> HexTemplate (fourni par parent). */
  templatesById?: Map<string, HexTemplate>
  /** Phase 5 Lot B.5 : Lookup assetId -> HexAsset pour les GLB customs places sur les templates. */
  customAssetsById?: Map<string, HexAsset>
}

// v1.0 — Set des terrains "herbeux" qui reçoivent une tuile hex_grass.glb.
// v1.1 — bosquet + foret aussi (sol vert + arbres en superposition).
const GRASS_TERRAINS: ReadonlySet<TerrainType> = new Set<TerrainType>([
  'plaine_ouverte',
  'plaine_standard',
  'bosquet',
  'foret',
])

// v1.1 — Nombre d'arbres par hex selon densité du terrain.
const TREES_PER_TERRAIN: Readonly<Partial<Record<TerrainType, number>>> = {
  bosquet: 2,
  foret: 5,
}

interface DecorEntry {
  key: string
  cube: Cube
  kind: 'grass'
  variant: GrassVariant
  /** Rotation Y en radians (multiple de π/3 pour rester aligné sur l'hex). */
  rotationY: number
}

/** v1.1 — Description d'un arbre individuel à placer dans un hex (bosquet/foret). */
interface TreeEntry {
  key: string
  /** Position monde (déjà calculée). */
  worldX: number
  worldZ: number
  /** Scale individuel (0.7-1.3 pour variété). */
  scale: number
  /** Rotation Y aléatoire. */
  rotationY: number
}

/**
 * Hash déterministe d'un cube → int positif stable.
 * Coefficients premiers (73856093, 19349663) — recette standard de hashing 2D.
 */
function hashCube(cube: Cube): number {
  return Math.abs((cube.q | 0) * 73856093 ^ (cube.r | 0) * 19349663)
}

function rotationIndexForCube(cube: Cube): number {
  return hashCube(cube) % 6
}

/**
 * Répartition pondérée des 6 variantes herbe avec gradient de densité de fleurs
 * pour transitions très douces entre hex adjacents :
 *   - 30% grass              (herbe pure, base)
 *   - 15% dirt               (herbe + plaques de terre)
 *   - 18% flowers_mid        (~33% fleurs)
 *   - 15% flowers_half       (~50% fleurs)
 *   - 12% flowers_two_thirds (~66% fleurs)
 *   - 10% flowers            (~100% fleurs, le plus rare)
 * Utilise un second hash décalé pour décorréler de la rotation.
 */
/**
 * Génère N positions d'arbres dans un hex donné (rayon = hexSize × 0.7 max pour rester
 * dans l'apothème = 0.866 × hexSize, marge). Positions seedées par cube + indice arbre
 * pour stabilité visuelle frame-à-frame.
 */
function treePositionsForCube(cube: Cube, count: number, hexSize: number): Array<{
  dx: number
  dz: number
  scale: number
  rotationY: number
}> {
  const seed = hashCube(cube)
  const out: Array<{ dx: number; dz: number; scale: number; rotationY: number }> = []
  const maxRadius = hexSize * 0.7
  for (let i = 0; i < count; i++) {
    // Hash dérivé pour chaque arbre i (multiplicateur premier différent)
    const h = ((seed + i * 2654435761) ^ (i * 374761393)) >>> 0
    const angle = (h % 360) * (Math.PI / 180)
    const radius = ((h >>> 8) % 100) / 100 * maxRadius
    const scale = 0.7 + ((h >>> 16) % 100) / 100 * 0.6 // 0.7..1.3
    const rotationY = (((h >>> 24) % 360) * Math.PI) / 180
    out.push({
      dx: Math.cos(angle) * radius,
      dz: Math.sin(angle) * radius,
      scale,
      rotationY,
    })
  }
  return out
}

function variantForCube(cube: Cube): GrassVariant {
  const h = (hashCube(cube) * 2654435761) >>> 0
  const r = h % 100
  if (r < 30) return 'grass'
  if (r < 45) return 'dirt'
  if (r < 63) return 'flowers_mid'
  if (r < 78) return 'flowers_half'
  if (r < 90) return 'flowers_two_thirds'
  return 'flowers'
}

export function TerrainDecor({
  terrainMap,
  hexSize,
  liftY = 0.05,
  templateMap,
  templatesById,
  customAssetsById,
}: TerrainDecorProps) {
  // Phase 5 Lot B.5 : hex avec un template applique. Resolu en couple { cube, template }
  // (skip silencieux si templateId pointe vers un template inconnu = pas encore charge ou supprime).
  const customHexEntries = useMemo<Array<{ key: string; cube: Cube; template: HexTemplate }>>(() => {
    if (!templateMap || !templatesById) return []
    const out: Array<{ key: string; cube: Cube; template: HexTemplate }> = []
    for (const [key, templateId] of templateMap) {
      const template = templatesById.get(templateId)
      if (!template) continue
      out.push({ key, cube: parseCubeKey(key), template })
    }
    return out
  }, [templateMap, templatesById])

  const customHexKeys = useMemo(() => {
    const s = new Set<string>()
    for (const e of customHexEntries) s.add(e.key)
    return s
  }, [customHexEntries])

  const entries = useMemo<DecorEntry[]>(() => {
    const out: DecorEntry[] = []
    for (const [key, type] of terrainMap) {
      if (customHexKeys.has(key)) continue  // template custom override le decor natif
      if (GRASS_TERRAINS.has(type)) {
        const cube = parseCubeKey(key)
        const rotationY = (rotationIndexForCube(cube) * Math.PI) / 3
        const variant = variantForCube(cube)
        out.push({ key, cube, kind: 'grass', variant, rotationY })
      }
    }
    return out
  }, [terrainMap, customHexKeys])

  // v1.1 — Arbres pour bosquet/foret (positions seedées par cube)
  const trees = useMemo<TreeEntry[]>(() => {
    const out: TreeEntry[] = []
    for (const [key, type] of terrainMap) {
      if (customHexKeys.has(key)) continue  // template custom override le decor natif
      const count = TREES_PER_TERRAIN[type]
      if (!count) continue
      const cube = parseCubeKey(key)
      const w = cubeToWorld(cube, hexSize)
      const positions = treePositionsForCube(cube, count, hexSize)
      positions.forEach((p, i) => {
        out.push({
          key: `${key}:tree${i}`,
          worldX: w.x + p.dx,
          worldZ: w.y + p.dz,
          scale: p.scale,
          rotationY: p.rotationY,
        })
      })
    }
    return out
  }, [terrainMap, hexSize, customHexKeys])

  // Échelle de référence : sapin Blender = 1.18m natif, on veut ~hexSize × 0.6 visible.
  const treeBaseScale = hexSize * 0.55

  return (
    <group>
      {entries.map(e => {
        const w = cubeToWorld(e.cube, hexSize)
        return (
          <group key={e.key} position={[w.x, liftY, w.y]} rotation={[0, e.rotationY, 0]}>
            {e.kind === 'grass' && <HexGrassMesh scale={hexSize} variant={e.variant} />}
          </group>
        )
      })}
      {trees.map(t => (
        <group key={t.key} position={[t.worldX, liftY, t.worldZ]} rotation={[0, t.rotationY, 0]}>
          <PineTreeMesh scale={treeBaseScale * t.scale} />
        </group>
      ))}
      {/* Phase 5 Lot B.5 : hex avec custom template (CustomHexMesh + assets places). */}
      <Suspense fallback={null}>
        {customHexEntries.map(e => {
          const w = cubeToWorld(e.cube, hexSize)
          return (
            <group key={`${e.key}:tpl`} position={[w.x, liftY, w.y]}>
              <CustomHexMesh
                textureUrl={e.template.texture_url}
                textureScale={e.template.texture_scale}
                textureMode={e.template.texture_mode}
                hexSize={hexSize}
              />
              <group scale={hexSize}>
                {e.template.assets_3d.map((a, i) => (
                  <AssetRenderer key={i} asset={a} customAssetsById={customAssetsById} />
                ))}
              </group>
            </group>
          )
        })}
      </Suspense>
    </group>
  )
}
