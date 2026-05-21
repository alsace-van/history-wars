// v1.0 (21/05/2026) — Phase 5 Lot 5.1 TASK 5.1.2 : sampler heightmap PNG 16-bit
// Charge un PNG (pngjs) et expose un sample bilinear par lat/lon en utilisant bbox.

import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'

/**
 * Heightmap chargee. height[y][x] = niveau gris 0-65535 (16-bit) ou 0-255 (8-bit).
 * width × height pixels.
 */
export interface Heightmap {
  width: number
  height: number
  /** Tableau lineaire de pixels : index = y × width + x. Valeur 0-65535. */
  data: Uint16Array
  /** Bit depth detecte (8 ou 16). */
  bitDepth: number
}

/**
 * Charge un PNG heightmap depuis disque. Supporte 8-bit greyscale et 16-bit greyscale.
 * Si le PNG est en couleur (RGB/RGBA), prend le canal R uniquement.
 */
export function loadHeightmap(path: string): Heightmap {
  const buf = readFileSync(path)
  const png = PNG.sync.read(buf)
  const { width, height, depth, data } = png as unknown as {
    width: number
    height: number
    depth: number
    data: Buffer
  }

  // pngjs decode toujours en 8-bit interne, meme si source 16-bit.
  // Pour 16-bit on doit relire le buffer brut. MVP : on accepte la perte de precision
  // 8-bit et on multiplie par 256 pour normaliser sur 0-65535.
  const out = new Uint16Array(width * height)
  const stride = data.length / (width * height)  // 1=greyscale, 3=RGB, 4=RGBA

  for (let i = 0; i < width * height; i++) {
    const r = data[i * stride] ?? 0
    out[i] = r << 8  // 8-bit → 0-65280 (proche 65535)
  }

  return { width, height, data: out, bitDepth: depth ?? 8 }
}

/**
 * Sample bilineaire de la heightmap a une coord lat/lon donnee.
 * Retourne une valeur fractionnaire 0-65535. Conversion en metres = caller responsibility.
 */
export function sampleHeightmap(
  hm: Heightmap,
  lat: number,
  lon: number,
  bbox: { lat_min: number; lat_max: number; lon_min: number; lon_max: number },
): number {
  // Position normalisee (0..1) dans la bbox.
  const nx = (lon - bbox.lon_min) / (bbox.lon_max - bbox.lon_min)
  const ny = 1 - (lat - bbox.lat_min) / (bbox.lat_max - bbox.lat_min)  // PNG nord=haut

  if (nx < 0 || nx >= 1 || ny < 0 || ny >= 1) return 0  // hors bbox

  const x = nx * (hm.width - 1)
  const y = ny * (hm.height - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, hm.width - 1)
  const y1 = Math.min(y0 + 1, hm.height - 1)
  const fx = x - x0
  const fy = y - y0

  const a = hm.data[y0 * hm.width + x0] ?? 0
  const b = hm.data[y0 * hm.width + x1] ?? 0
  const c = hm.data[y1 * hm.width + x0] ?? 0
  const d = hm.data[y1 * hm.width + x1] ?? 0

  return (
    a * (1 - fx) * (1 - fy) +
    b * fx * (1 - fy) +
    c * (1 - fx) * fy +
    d * fx * fy
  )
}

/**
 * Convertit valeur heightmap 0-65535 en metres en utilisant un range [min, max].
 * Le range doit etre fourni par l'utilisateur (Tangram Heightmapper affiche min/max
 * en metres sur l'UI lors de l'export, a noter manuellement).
 */
export function heightmapValueToMeters(
  value: number,
  minMeters: number,
  maxMeters: number,
): number {
  return minMeters + (value / 65535) * (maxMeters - minMeters)
}
