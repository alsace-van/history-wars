// v1.0 (21/05/2026) — Phase 5 Lot 5.1 TASK 5.1.2 : parser GeoJSON OSM + mapping biomes/buildings
// Lit un export GeoJSON (Overpass Turbo) et fournit query par lat/lon.

import { readFileSync } from 'node:fs'

export type Biome = 'plain' | 'forest' | 'hill' | 'marsh' | 'water' | 'urban' | 'road'

export type BuildingKind =
  | 'farm'
  | 'hamlet'
  | 'church'
  | 'castle'
  | 'windmill'
  | 'bridge_tower'
  | 'ruin'

export interface OsmFeature {
  type: 'Feature'
  geometry: {
    type: 'Polygon' | 'MultiPolygon' | 'LineString' | 'Point'
    // Polygon : number[][][]  (anneaux x [lon, lat])
    // MultiPolygon : number[][][][]
    // LineString : number[][]
    // Point : number[]
    coordinates: unknown
  }
  properties: Record<string, unknown>
}

export interface OsmCollection {
  type: 'FeatureCollection'
  features: OsmFeature[]
}

export function loadOsm(path: string): OsmCollection {
  const json = readFileSync(path, 'utf8')
  const parsed = JSON.parse(json) as OsmCollection
  if (parsed.type !== 'FeatureCollection') {
    throw new Error(`OSM file must be a GeoJSON FeatureCollection, got ${parsed.type}`)
  }
  return parsed
}

/**
 * Determine le biome d'un point [lon, lat] en cherchant le premier polygon OSM
 * qui le contient. Si plusieurs match : priorite urban > water > marsh > forest > hill > plain.
 *
 * Si rien ne contient le point → 'plain' (defaut).
 */
export function biomeAt(
  lon: number,
  lat: number,
  features: OsmFeature[],
): Biome {
  const candidates: Biome[] = []

  for (const f of features) {
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue
    if (!pointInGeometry(lon, lat, f.geometry)) continue

    const b = tagToBiome(f.properties)
    if (b) candidates.push(b)
  }

  if (candidates.length === 0) return 'plain'

  // Priorite stricte (urban masque tout, water masque sauf urban, etc.)
  const PRIORITY: Biome[] = ['urban', 'water', 'marsh', 'forest', 'hill', 'plain']
  for (const p of PRIORITY) {
    if (candidates.includes(p)) return p
  }
  return 'plain'
}

function tagToBiome(props: Record<string, unknown>): Biome | null {
  const landuse = props.landuse as string | undefined
  const natural = props.natural as string | undefined
  const waterway = props.waterway as string | undefined
  const building = props.building as string | undefined
  const highway = props.highway as string | undefined

  if (building) return 'urban'
  if (landuse === 'residential' || landuse === 'industrial' || landuse === 'commercial') return 'urban'
  if (waterway === 'river' || waterway === 'stream' || waterway === 'canal') return 'water'
  if (natural === 'water') return 'water'
  if (natural === 'wetland' || landuse === 'basin') return 'marsh'
  if (landuse === 'forest' || landuse === 'wood' || natural === 'wood') return 'forest'
  if (highway) return 'road'

  return null
}

/**
 * Liste les buildings de la collection avec leur position centroide.
 * Filtre les buildings avec un kind reconnu.
 */
export function listBuildings(features: OsmFeature[]): Array<{
  lon: number
  lat: number
  kind: BuildingKind
  label?: string
}> {
  const result: Array<{ lon: number; lat: number; kind: BuildingKind; label?: string }> = []

  for (const f of features) {
    const kind = tagToBuildingKind(f.properties)
    if (!kind) continue

    const center = geometryCentroid(f.geometry)
    if (!center) continue

    result.push({
      lon: center.lon,
      lat: center.lat,
      kind,
      label: (f.properties.name as string | undefined) ?? undefined,
    })
  }

  return result
}

function tagToBuildingKind(props: Record<string, unknown>): BuildingKind | null {
  const building = props.building as string | undefined
  const historic = props.historic as string | undefined
  const amenity = props.amenity as string | undefined
  const manMade = props.man_made as string | undefined
  const ruins = props.ruins as string | undefined

  if (ruins === 'yes' || historic === 'ruins') return 'ruin'
  if (historic === 'castle' || building === 'castle') return 'castle'
  if (amenity === 'place_of_worship' || building === 'church' || building === 'chapel') return 'church'
  if (building === 'windmill' || manMade === 'windmill' || building === 'mill') return 'windmill'
  if (building === 'farm' || building === 'farm_auxiliary' || building === 'barn') return 'farm'
  if (building === 'house' || building === 'residential' || building === 'detached') return 'farm'

  return null
}

/**
 * Liste les routes (LineString) pour marquer les hex `road`.
 * Retourne juste les coords [lon, lat][] de chaque route.
 */
export function listRoads(features: OsmFeature[]): Array<Array<[number, number]>> {
  const result: Array<Array<[number, number]>> = []
  for (const f of features) {
    if (f.geometry.type !== 'LineString') continue
    if (!(f.properties.highway as string | undefined)) continue
    result.push(f.geometry.coordinates as Array<[number, number]>)
  }
  return result
}

/**
 * Liste les rivieres/cours d'eau (LineString avec waterway).
 */
export function listWaterways(features: OsmFeature[]): Array<Array<[number, number]>> {
  const result: Array<Array<[number, number]>> = []
  for (const f of features) {
    if (f.geometry.type !== 'LineString') continue
    if (!(f.properties.waterway as string | undefined)) continue
    result.push(f.geometry.coordinates as Array<[number, number]>)
  }
  return result
}

/**
 * Liste les ponts (Way avec bridge=yes/viaduct).
 * Retourne le segment [lon, lat] (centre du pont).
 */
export function listBridges(features: OsmFeature[]): Array<{ lon: number; lat: number }> {
  const result: Array<{ lon: number; lat: number }> = []
  for (const f of features) {
    const bridge = f.properties.bridge as string | undefined
    if (!bridge || bridge === 'no') continue
    const center = geometryCentroid(f.geometry)
    if (center) result.push(center)
  }
  return result
}

// ----------------------------------------------------------------------------
// Helpers geometrie
// ----------------------------------------------------------------------------

function pointInGeometry(lon: number, lat: number, geom: OsmFeature['geometry']): boolean {
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates as number[][][]
    return pointInPolygon(lon, lat, rings)
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates as number[][][][]
    for (const rings of polys) {
      if (pointInPolygon(lon, lat, rings)) return true
    }
    return false
  }
  return false
}

/**
 * Ray-casting point-in-polygon. Premier anneau = outer, autres = trous.
 * Pour simplicite, on ignore les trous (rares dans OSM courant).
 */
function pointInPolygon(x: number, y: number, rings: number[][][]): boolean {
  if (rings.length === 0) return false
  const outer = rings[0]
  let inside = false
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const xi = outer[i][0]
    const yi = outer[i][1]
    const xj = outer[j][0]
    const yj = outer[j][1]
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function geometryCentroid(geom: OsmFeature['geometry']): { lon: number; lat: number } | null {
  if (geom.type === 'Point') {
    const [lon, lat] = geom.coordinates as number[]
    return { lon, lat }
  }
  if (geom.type === 'Polygon') {
    const ring = (geom.coordinates as number[][][])[0]
    return ringCentroid(ring)
  }
  if (geom.type === 'MultiPolygon') {
    // Premier polygon
    const ring = (geom.coordinates as number[][][][])[0]?.[0]
    if (!ring) return null
    return ringCentroid(ring)
  }
  if (geom.type === 'LineString') {
    const coords = geom.coordinates as number[][]
    const mid = coords[Math.floor(coords.length / 2)]
    return { lon: mid[0], lat: mid[1] }
  }
  return null
}

function ringCentroid(ring: number[][]): { lon: number; lat: number } {
  let lonSum = 0
  let latSum = 0
  for (const [lon, lat] of ring) {
    lonSum += lon
    latSum += lat
  }
  return { lon: lonSum / ring.length, lat: latSum / ring.length }
}
