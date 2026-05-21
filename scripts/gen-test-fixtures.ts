// v1.0 (21/05/2026) — Phase 5 Lot 5.1 : genere fixtures synthetiques pour tester build-scenario
// PNG heightmap basique + GeoJSON OSM minimal. Permet de valider le pipeline end-to-end
// sans dependre d'un export Tangram/Overpass externe.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { PNG } from 'pngjs'

const OUT_DIR = 'scripts/test-fixtures'

mkdirSync(OUT_DIR, { recursive: true })

// ----------------------------------------------------------------------------
// 1. PNG heightmap synthetique : 256x256, colline au centre + plaine
// ----------------------------------------------------------------------------

const SIZE = 256
const png = new PNG({ width: SIZE, height: SIZE })

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const cx = SIZE / 2
    const cy = SIZE / 2
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    const norm = Math.max(0, 1 - dist / (SIZE / 3))
    const value = Math.round(64 + norm * 191)  // 64 (plaine) - 255 (sommet colline)
    const idx = (y * SIZE + x) << 2
    png.data[idx] = value
    png.data[idx + 1] = value
    png.data[idx + 2] = value
    png.data[idx + 3] = 255
  }
}

const pngPath = `${OUT_DIR}/test-heightmap.png`
const buf = PNG.sync.write(png)
writeFileSync(pngPath, buf)
console.log(`Wrote ${pngPath} (${SIZE}×${SIZE})`)

// ----------------------------------------------------------------------------
// 2. GeoJSON OSM minimal : 1 forêt, 1 route, 1 hameau, 1 rivière
// ----------------------------------------------------------------------------

// bbox de test : carré 2 km au centre de la France métropolitaine
const BBOX = { lat_min: 47.0, lat_max: 47.02, lon_min: 2.5, lon_max: 2.52 }

const geojson = {
  type: 'FeatureCollection',
  features: [
    // Forêt nord-est
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [2.512, 47.015], [2.518, 47.015], [2.518, 47.019], [2.512, 47.019], [2.512, 47.015],
        ]],
      },
      properties: { landuse: 'forest', name: 'Bois Test' },
    },
    // Rivière sud (LineString)
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.500, 47.003], [2.505, 47.005], [2.510, 47.003], [2.515, 47.004], [2.520, 47.003],
        ],
      },
      properties: { waterway: 'river', name: 'Rivière Test' },
    },
    // Route est-ouest (LineString)
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.500, 47.010], [2.520, 47.010],
        ],
      },
      properties: { highway: 'primary', name: 'Route Principale' },
    },
    // Hameau ouest (cluster de bâtiments → on en met 3 dans une zone restreinte)
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [2.502, 47.011] },
      properties: { building: 'house', name: 'Maison 1' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [2.504, 47.012] },
      properties: { building: 'farm', name: 'Ferme 1' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [2.503, 47.010] },
      properties: { building: 'church', name: 'Chapelle Test' },
    },
    // Pont
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [2.510, 47.005] },
      properties: { bridge: 'yes', highway: 'primary' },
    },
  ],
}

const osmPath = `${OUT_DIR}/test-osm.geojson`
writeFileSync(osmPath, JSON.stringify(geojson, null, 2))
console.log(`Wrote ${osmPath}`)

console.log('')
console.log('Test command:')
console.log(`  npx tsx scripts/build-scenario.ts \\`)
console.log(`    --heightmap ${pngPath} \\`)
console.log(`    --osm ${osmPath} \\`)
console.log(`    --bbox "${BBOX.lat_min},${BBOX.lon_min},${BBOX.lat_max},${BBOX.lon_max}" \\`)
console.log(`    --slug test-fixture \\`)
console.log(`    --label "Test Fixture" \\`)
console.log(`    --meters-per-hex 50 \\`)
console.log(`    --board-radius 15 \\`)
console.log(`    --elevation-min 100 \\`)
console.log(`    --elevation-max 250 \\`)
console.log(`    --output scripts/test-fixtures/test-output.sql`)
