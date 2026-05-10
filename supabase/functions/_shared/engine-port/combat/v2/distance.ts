// v1.0 (10/05/2026) — Phase 2 2C.1 : port combat/v2/distance pour Deno
// Source de verite : src/engine/combat/v2/distance.ts. Duplication controlee (piege #12).

export function distancePrecision(distance: number, range: number, minRange: number = 0): number {
  if (distance < minRange) return 0
  if (distance > range) return 0
  if (distance < 1) return 0
  if (range < 1) return 0

  const sweetLow = Math.max(minRange, Math.round(range * 0.4))
  const sweetHigh = Math.round(range * 0.7)

  if (distance >= sweetLow && distance <= sweetHigh) return 1.0

  if (distance < sweetLow) {
    if (sweetLow === minRange) return 1.0
    const t = (distance - minRange) / (sweetLow - minRange)
    return 0.85 + 0.15 * t
  }

  if (distance > sweetHigh) {
    if (range === sweetHigh) return 1.0
    const t = (distance - sweetHigh) / (range - sweetHigh)
    return 1.0 - 0.5 * t
  }

  return 1.0
}
