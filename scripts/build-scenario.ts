// v1.0 (21/05/2026) — Phase 5 Lot 5.1 TASK 5.1.2 : importeur DEM/OSM → SQL scenario
// Standalone Node script (tsx). Prend en input :
//   --heightmap PNG (Tangram Heightmapper export)
//   --osm GeoJSON (Overpass Turbo export)
//   --bbox "lat_min,lon_min,lat_max,lon_max" (zone geo de la carte)
//   --slug "azincourt-1415" (slug du scenario)
//   --label "Azincourt 1415" (libelle UI)
//   --meters-per-hex 50 (echelle hex)
//   --board-radius 40 (rayon spiral)
//   --elevation-min -10 --elevation-max 50 (range metres pour heightmap PNG)
//   --output path/to/output.sql
//
// Emet un fichier SQL avec INSERT hex_maps + INSERT hex_map_buildings + INSERT
// hex_map_edges. Affiche un audit en fin de generation.

import { writeFileSync } from 'node:fs'
import { argv, exit } from 'node:process'
import {
  cube,
  cubeKey,
  cubeToLatLon,
  spiral,
  type Cube,
} from './lib/hex-utils.ts'
import {
  loadHeightmap,
  sampleHeightmap,
  heightmapValueToMeters,
} from './lib/heightmap-sampler.ts'
import {
  loadOsm,
  biomeAt,
  listBuildings,
  listRoads,
  listWaterways,
  listBridges,
  type Biome,
  type BuildingKind,
} from './lib/osm-mapper.ts'

const TAG = '[build-scenario v1.0]'

// ============================================================================
// CLI args parsing
// ============================================================================

interface Args {
  heightmap: string
  osm: string
  bbox: { lat_min: number; lat_max: number; lon_min: number; lon_max: number }
  slug: string
  label: string
  metersPerHex: number
  boardRadius: number
  elevationMin: number
  elevationMax: number
  output: string
}

function parseArgs(): Args {
  const args: Record<string, string> = {}
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
    args[key] = value
  }

  const required = [
    'heightmap',
    'osm',
    'bbox',
    'slug',
    'label',
    'meters-per-hex',
    'board-radius',
    'output',
  ]
  for (const k of required) {
    if (!args[k]) {
      console.error(`${TAG} Missing required arg --${k}`)
      console.error(`
Usage: npx tsx scripts/build-scenario.ts \\
  --heightmap PATH \\
  --osm PATH \\
  --bbox "lat_min,lon_min,lat_max,lon_max" \\
  --slug SLUG \\
  --label "Libelle" \\
  --meters-per-hex 50 \\
  --board-radius 40 \\
  --elevation-min -10 \\
  --elevation-max 50 \\
  --output PATH.sql
`)
      exit(1)
    }
  }

  const [latMin, lonMin, latMax, lonMax] = args.bbox.split(',').map(Number)
  if (Number.isNaN(latMin) || Number.isNaN(latMax)) {
    console.error(`${TAG} Invalid --bbox format. Expected "lat_min,lon_min,lat_max,lon_max"`)
    exit(1)
  }

  return {
    heightmap: args.heightmap,
    osm: args.osm,
    bbox: { lat_min: latMin, lat_max: latMax, lon_min: lonMin, lon_max: lonMax },
    slug: args.slug,
    label: args.label,
    metersPerHex: Number(args['meters-per-hex']),
    boardRadius: Number(args['board-radius']),
    elevationMin: Number(args['elevation-min'] ?? '-10'),
    elevationMax: Number(args['elevation-max'] ?? '100'),
    output: args.output,
  }
}

// ============================================================================
// Mapping biome → template_id (devra etre resolu cote client ou via lookup BDD)
// MVP : on stocke juste le biome dans hex_maps.tiles JSONB { cubeKey → biome }
// au lieu de { cubeKey → templateId }. Lot 5.2 fera le mapping biome → template.
// ============================================================================

interface HexCellData {
  cube: Cube
  biome: Biome
  elevationM: number
  hasRoad: boolean
  hasWater: boolean
}

interface ScenarioBuild {
  hexMap: {
    slug: string
    label: string
    radius: number
    metersPerHex: number
    bbox: { lat_min: number; lat_max: number; lon_min: number; lon_max: number }
    tiles: Record<string, { biome: Biome; elevation_m: number }>
  }
  buildings: Array<{
    cube: Cube
    kind: BuildingKind
    label?: string
  }>
  edges: Array<{
    a: Cube
    b: Cube
    kind: 'bridge' | 'river_block'
  }>
}

// ============================================================================
// Pipeline
// ============================================================================

function buildScenario(args: Args): ScenarioBuild {
  console.log(`${TAG} Loading heightmap ${args.heightmap}...`)
  const hm = loadHeightmap(args.heightmap)
  console.log(`${TAG}   → ${hm.width}×${hm.height} px, bit depth ${hm.bitDepth}`)

  console.log(`${TAG} Loading OSM ${args.osm}...`)
  const osm = loadOsm(args.osm)
  console.log(`${TAG}   → ${osm.features.length} features`)

  console.log(`${TAG} Listing OSM features...`)
  const buildings = listBuildings(osm.features)
  const roads = listRoads(osm.features)
  const waterways = listWaterways(osm.features)
  const bridges = listBridges(osm.features)
  console.log(
    `${TAG}   → ${buildings.length} buildings, ${roads.length} roads, ${waterways.length} waterways, ${bridges.length} bridges`,
  )

  console.log(`${TAG} Generating hex grid spiral(radius=${args.boardRadius})...`)
  const cubes = spiral(cube(0, 0), args.boardRadius)
  console.log(`${TAG}   → ${cubes.length} hex`)

  // Pre-calcule un set des cubes proches d'une route (rayon 1 cube ≈ adjacence)
  const roadCubeKeys = new Set<string>()
  for (const road of roads) {
    for (const [lon, lat] of road) {
      const c = latLonToCubeFast(lat, lon, args.bbox, args.boardRadius, args.metersPerHex)
      if (c) roadCubeKeys.add(cubeKey(c))
    }
  }

  const waterCubeKeys = new Set<string>()
  for (const wway of waterways) {
    for (const [lon, lat] of wway) {
      const c = latLonToCubeFast(lat, lon, args.bbox, args.boardRadius, args.metersPerHex)
      if (c) waterCubeKeys.add(cubeKey(c))
    }
  }

  // Pour chaque hex, calculer biome + elevation
  const tiles: Record<string, { biome: Biome; elevation_m: number }> = {}
  for (const c of cubes) {
    const { lat, lon } = cubeToLatLon(c, args.bbox, args.boardRadius)
    const rawElev = sampleHeightmap(hm, lat, lon, args.bbox)
    const elevationM = Math.round(
      heightmapValueToMeters(rawElev, args.elevationMin, args.elevationMax),
    )

    let biome = biomeAt(lon, lat, osm.features)
    const key = cubeKey(c)
    if (roadCubeKeys.has(key) && biome === 'plain') biome = 'road'
    if (waterCubeKeys.has(key)) biome = 'water'

    tiles[key] = { biome, elevation_m: elevationM }
  }

  // Buildings → cube
  const buildingsOut: ScenarioBuild['buildings'] = []
  for (const b of buildings) {
    const c = latLonToCubeFast(b.lat, b.lon, args.bbox, args.boardRadius, args.metersPerHex)
    if (!c) continue
    buildingsOut.push({ cube: c, kind: b.kind, label: b.label })
  }

  // Edges : ponts (lat/lon → 2 cubes adjacents). MVP simple : on retrouve l'edge le plus proche.
  // Approche : prendre le cube du pont + son voisin dans la direction de la rivière la plus proche.
  // Phase 5 Lot 5.2+ : detection plus precise via intersection LineString.
  const edgesOut: ScenarioBuild['edges'] = []
  for (const br of bridges) {
    const c = latLonToCubeFast(br.lat, br.lon, args.bbox, args.boardRadius, args.metersPerHex)
    if (!c) continue
    // Cherche un voisin water pour creer l'edge bridge
    const neighbors: Cube[] = [
      { q: c.q + 1, r: c.r, s: c.s - 1 },
      { q: c.q + 1, r: c.r - 1, s: c.s },
      { q: c.q, r: c.r - 1, s: c.s + 1 },
      { q: c.q - 1, r: c.r, s: c.s + 1 },
      { q: c.q - 1, r: c.r + 1, s: c.s },
      { q: c.q, r: c.r + 1, s: c.s - 1 },
    ]
    for (const n of neighbors) {
      const nKey = cubeKey(n)
      if (waterCubeKeys.has(nKey)) {
        // Ordre canonique pour CHECK ((q1,r1) < (q2,r2)) : compare lexico
        const [a, b] = compareCubeKey(c, n) < 0 ? [c, n] : [n, c]
        edgesOut.push({ a, b, kind: 'bridge' })
        break
      }
    }
  }

  return {
    hexMap: {
      slug: args.slug,
      label: args.label,
      radius: args.boardRadius,
      metersPerHex: args.metersPerHex,
      bbox: args.bbox,
      tiles,
    },
    buildings: buildingsOut,
    edges: edgesOut,
  }
}

// Fast lat/lon → cube (interne au script, bypass typage strict pour ne pas alourdir)
function latLonToCubeFast(
  lat: number,
  lon: number,
  bbox: { lat_min: number; lat_max: number; lon_min: number; lon_max: number },
  boardRadius: number,
  _metersPerHex: number,  // futur usage Lot 5.2
): Cube | null {
  if (lat < bbox.lat_min || lat > bbox.lat_max || lon < bbox.lon_min || lon > bbox.lon_max) {
    return null
  }
  // Normalise vs bbox center
  const latCenter = (bbox.lat_min + bbox.lat_max) / 2
  const lonCenter = (bbox.lon_min + bbox.lon_max) / 2
  const latRange = bbox.lat_max - bbox.lat_min
  const lonRange = bbox.lon_max - bbox.lon_min

  const worldWidth = 1.5 * 2 * boardRadius
  const worldHeight = Math.sqrt(3) * 2 * boardRadius

  const x = ((lon - lonCenter) / lonRange) * worldWidth
  const y = -((lat - latCenter) / latRange) * worldHeight

  const q = (2 / 3) * x
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y)
  let rq = Math.round(q)
  let rr = Math.round(r)
  let rs = Math.round(-q - r)

  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - (-q - r))
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  else rs = -rq - rr

  if (Math.abs(rq) > boardRadius || Math.abs(rr) > boardRadius || Math.abs(rs) > boardRadius) return null
  return { q: rq, r: rr, s: rs }
}

function compareCubeKey(a: Cube, b: Cube): number {
  if (a.q !== b.q) return a.q - b.q
  return a.r - b.r
}

// ============================================================================
// SQL emission
// ============================================================================

function emitSql(build: ScenarioBuild): string {
  const lines: string[] = []
  lines.push('-- Generated by scripts/build-scenario.ts')
  lines.push(`-- Scenario : ${build.hexMap.label} (slug=${build.hexMap.slug})`)
  lines.push(`-- Radius : ${build.hexMap.radius}, meters_per_hex : ${build.hexMap.metersPerHex}`)
  lines.push(`-- Generated at : ${new Date().toISOString()}`)
  lines.push('')

  // hex_maps INSERT
  lines.push('-- 1. hex_maps')
  lines.push(`WITH new_map AS (`)
  lines.push(`  INSERT INTO public.hex_maps (`)
  lines.push(`    id, created_by, name, radius, tiles, props,`)
  lines.push(`    meters_per_hex, bbox, source_label`)
  lines.push(`  )`)
  lines.push(`  VALUES (`)
  lines.push(`    gen_random_uuid(),`)
  lines.push(`    (SELECT id FROM auth.users WHERE email = 'alsacevancreation@hotmail.com'),`)
  lines.push(`    ${sqlString(build.hexMap.slug)},`)
  lines.push(`    ${build.hexMap.radius},`)
  lines.push(`    ${sqlString(JSON.stringify(build.hexMap.tiles))}::jsonb,`)
  lines.push(`    '[]'::jsonb,`)
  lines.push(`    ${build.hexMap.metersPerHex},`)
  lines.push(`    ${sqlString(JSON.stringify(build.hexMap.bbox))}::jsonb,`)
  lines.push(`    ${sqlString(build.hexMap.label)}`)
  lines.push(`  )`)
  lines.push(`  RETURNING id`)
  lines.push(`)`)

  // hex_map_buildings INSERT
  if (build.buildings.length > 0) {
    lines.push(`, new_buildings AS (`)
    lines.push(`  INSERT INTO public.hex_map_buildings (hex_map_id, q, r, kind, label)`)
    lines.push(`  SELECT id, b.q, b.r, b.kind, b.label`)
    lines.push(`  FROM new_map, (VALUES`)
    const buildingValues = build.buildings
      .map((b) => `    (${b.cube.q}, ${b.cube.r}, ${sqlString(b.kind)}, ${b.label ? sqlString(b.label) : 'NULL'})`)
      .join(',\n')
    lines.push(buildingValues)
    lines.push(`  ) AS b(q, r, kind, label)`)
    lines.push(`  RETURNING 1`)
    lines.push(`)`)
  }

  // hex_map_edges INSERT
  if (build.edges.length > 0) {
    lines.push(`, new_edges AS (`)
    lines.push(`  INSERT INTO public.hex_map_edges (hex_map_id, q1, r1, q2, r2, edge_kind)`)
    lines.push(`  SELECT id, e.q1, e.r1, e.q2, e.r2, e.kind`)
    lines.push(`  FROM new_map, (VALUES`)
    const edgeValues = build.edges
      .map((e) => `    (${e.a.q}, ${e.a.r}, ${e.b.q}, ${e.b.r}, ${sqlString(e.kind)})`)
      .join(',\n')
    lines.push(edgeValues)
    lines.push(`  ) AS e(q1, r1, q2, r2, kind)`)
    lines.push(`  RETURNING 1`)
    lines.push(`)`)
  }

  lines.push(`SELECT id FROM new_map;`)

  return lines.join('\n')
}

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

// ============================================================================
// Audit
// ============================================================================

function auditScenario(build: ScenarioBuild): void {
  const totalHex = Object.keys(build.hexMap.tiles).length
  const biomeCount: Record<string, number> = {}
  let praticables = 0
  let elevations: number[] = []

  for (const tile of Object.values(build.hexMap.tiles)) {
    biomeCount[tile.biome] = (biomeCount[tile.biome] ?? 0) + 1
    if (tile.biome !== 'water') praticables++
    elevations.push(tile.elevation_m)
  }

  const buildingCount: Record<string, number> = {}
  for (const b of build.buildings) {
    buildingCount[b.kind] = (buildingCount[b.kind] ?? 0) + 1
  }

  const edgeCount: Record<string, number> = {}
  for (const e of build.edges) {
    edgeCount[e.kind] = (edgeCount[e.kind] ?? 0) + 1
  }

  const minElev = Math.min(...elevations)
  const maxElev = Math.max(...elevations)
  const praticablePct = ((praticables / totalHex) * 100).toFixed(1)

  console.log('')
  console.log(`=== AUDIT SCENARIO "${build.hexMap.label}" ===`)
  console.log(`- Total hex : ${totalHex} (board_radius=${build.hexMap.radius})`)
  console.log(`- Praticables (biome ≠ water) : ${praticables} (${praticablePct}%)`)
  console.log(`- Biomes :`)
  for (const [biome, count] of Object.entries(biomeCount).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${biome}: ${count} (${((count / totalHex) * 100).toFixed(1)}%)`)
  }
  console.log(`- Bâtiments : ${build.buildings.length}`)
  if (build.buildings.length > 0) {
    for (const [kind, count] of Object.entries(buildingCount).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${kind}: ${count}`)
    }
  }
  console.log(`- Edges : ${build.edges.length}`)
  if (build.edges.length > 0) {
    for (const [kind, count] of Object.entries(edgeCount).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${kind}: ${count}`)
    }
  }
  console.log(`- Altitude min/max : ${minElev} / ${maxElev} m (var. ${maxElev - minElev} m)`)
  console.log('')

  // Critères validation MVP
  const warnings: string[] = []
  if (parseFloat(praticablePct) < 60) {
    warnings.push(`% praticables < 60% (${praticablePct}%) — risque d'injouabilité`)
  }
  if (build.buildings.length === 0) {
    warnings.push(`Aucun bâtiment — pas de couvert défensif disponible`)
  }
  if (warnings.length > 0) {
    console.log(`⚠ WARNINGS :`)
    for (const w of warnings) console.log(`  - ${w}`)
    console.log('')
  } else {
    console.log(`✓ Tous les critères MVP validés.`)
    console.log('')
  }
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  const args = parseArgs()
  const build = buildScenario(args)
  auditScenario(build)
  const sql = emitSql(build)
  writeFileSync(args.output, sql, 'utf8')
  console.log(`${TAG} SQL written to ${args.output}`)
  console.log(`${TAG} Done.`)
}

main()
