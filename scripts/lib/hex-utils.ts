// v1.0 (21/05/2026) — Phase 5 Lot 5.1 TASK 5.1.2 : helpers hex pour script build-scenario standalone
// DUPLICATION CONTROLEE de src/engine/hex/* — le script ne peut pas resoudre les path
// aliases Vite (@engine/*). Maintenir parite manuellement (cf. piege #12).

/**
 * Coord cubique flat-top, invariant q+r+s=0.
 */
export interface Cube {
  readonly q: number
  readonly r: number
  readonly s: number
}

export function cube(q: number, r: number): Cube {
  return { q, r, s: -q - r }
}

export function cubeKey(c: Cube): string {
  return `${c.q},${c.r}`
}

export function cubeDistance(a: Cube, b: Cube): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2
}

/**
 * Spiral autour de center avec rayon donne.
 * Convention identique a src/engine/hex/neighbors.ts.
 */
export function spiral(center: Cube, radius: number): Cube[] {
  const result: Cube[] = []
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r
      if (Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(s) <= radius) {
        result.push({ q: center.q + q, r: center.r + r, s: center.s + s })
      }
    }
  }
  return result
}

/**
 * Convertit cube hex flat-top en coords monde 2D (x, y plan).
 * hexSize = rayon du cercle circonscrit a l'hex.
 */
export function cubeToWorld(c: Cube, hexSize: number = 1): { x: number; y: number } {
  const x = hexSize * (3 / 2) * c.q
  const y = hexSize * (Math.sqrt(3) / 2 * c.q + Math.sqrt(3) * c.r)
  return { x, y }
}

/**
 * Convertit lat/lon vers cube hex en utilisant une bbox + dimensions de la grille.
 * Approximation projection plate (acceptable pour zones < 50 km).
 */
export function latLonToCube(
  lat: number,
  lon: number,
  bbox: { lat_min: number; lat_max: number; lon_min: number; lon_max: number },
  boardRadius: number,
  hexSize: number = 1,
): Cube {
  // Normalise lat/lon dans [-1, +1] vs bbox
  const latCenter = (bbox.lat_min + bbox.lat_max) / 2
  const lonCenter = (bbox.lon_min + bbox.lon_max) / 2
  const latRange = bbox.lat_max - bbox.lat_min
  const lonRange = bbox.lon_max - bbox.lon_min

  // Position monde normalisee : centre bbox = (0, 0)
  // Convention : x = est-ouest (lon), y = nord-sud (lat).
  // boardRadius hex en monde ≈ hexSize × 1.5 × boardRadius horizontalement.
  const worldWidth = hexSize * 1.5 * 2 * boardRadius
  const worldHeight = hexSize * Math.sqrt(3) * 2 * boardRadius

  const x = ((lon - lonCenter) / lonRange) * worldWidth
  const y = -((lat - latCenter) / latRange) * worldHeight  // nord = -y (convention écran)

  // Inversion cubeToWorld → coord cubique fractionnaire
  const q = (2 / 3) * x / hexSize
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / hexSize
  const s = -q - r

  return cubeRound({ q, r, s })
}

/**
 * Arrondit cube fractionnaire vers cube entier le plus proche.
 * Preserve l'invariant q+r+s=0.
 */
export function cubeRound(c: Cube): Cube {
  let rq = Math.round(c.q)
  let rr = Math.round(c.r)
  let rs = Math.round(c.s)

  const dq = Math.abs(rq - c.q)
  const dr = Math.abs(rr - c.r)
  const ds = Math.abs(rs - c.s)

  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  else rs = -rq - rr

  return { q: rq, r: rr, s: rs }
}

/**
 * Convertit cube → lat/lon (inverse de latLonToCube).
 * Utilise pour echantillonner la heightmap au centre de chaque hex.
 */
export function cubeToLatLon(
  c: Cube,
  bbox: { lat_min: number; lat_max: number; lon_min: number; lon_max: number },
  boardRadius: number,
  hexSize: number = 1,
): { lat: number; lon: number } {
  const latCenter = (bbox.lat_min + bbox.lat_max) / 2
  const lonCenter = (bbox.lon_min + bbox.lon_max) / 2
  const latRange = bbox.lat_max - bbox.lat_min
  const lonRange = bbox.lon_max - bbox.lon_min

  const worldWidth = hexSize * 1.5 * 2 * boardRadius
  const worldHeight = hexSize * Math.sqrt(3) * 2 * boardRadius

  const w = cubeToWorld(c, hexSize)
  const lon = lonCenter + (w.x / worldWidth) * lonRange
  const lat = latCenter - (w.y / worldHeight) * latRange  // inverse de y = -lat

  return { lat, lon }
}
