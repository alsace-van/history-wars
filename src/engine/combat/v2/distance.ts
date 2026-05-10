// v1.0 (10/05/2026) — Phase 2 2A.8 : courbe de precision pour attaque distance
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.8

/**
 * Multiplicateur de precision selon la distance, la portee max, et la portee min.
 *
 * Comportement :
 *  - distance < minRange    → 0   (tir impossible / interdit)
 *  - distance > range       → 0   (hors portee)
 *  - sweet spot 50-70 % de range → ~1.0 (precision optimale)
 *  - tres pres (juste au-dessus de minRange) → ~0.85 (vise pas calee)
 *  - portee max (range)     → ~0.5 (tail-off)
 *
 * Modele lineaire piecewise simple :
 *   sweet_low  = max(minRange, round(range * 0.4))
 *   sweet_high = round(range * 0.7)
 *   - dans le sweet spot              → 1.0
 *   - entre minRange et sweet_low     → lerp 0.85 → 1.0
 *   - entre sweet_high et range       → lerp 1.0 → 0.5
 *
 * Tests § 2A.8 du plan :
 *  - artillerie minRange=2, distance=1 → 0
 *  - archer range=4, distance=2 → 1.0 (sweet spot)
 *  - archer range=4, distance=4 → 0.5 (tail-off max)
 */
export function distancePrecision(
  distance: number,
  range: number,
  minRange: number = 0,
): number {
  if (distance < minRange) return 0
  if (distance > range) return 0
  if (distance < 1) return 0           // melee gere ailleurs
  if (range < 1) return 0              // pas une unite a distance

  const sweetLow = Math.max(minRange, Math.round(range * 0.4))
  const sweetHigh = Math.round(range * 0.7)

  // Sweet spot : precision maximale 1.0
  if (distance >= sweetLow && distance <= sweetHigh) return 1.0

  // Pre-sweet (entre minRange et sweetLow) : lerp 0.85 → 1.0
  if (distance < sweetLow) {
    if (sweetLow === minRange) return 1.0
    const t = (distance - minRange) / (sweetLow - minRange)
    return 0.85 + 0.15 * t
  }

  // Post-sweet (entre sweetHigh et range) : lerp 1.0 → 0.5
  if (distance > sweetHigh) {
    if (range === sweetHigh) return 1.0
    const t = (distance - sweetHigh) / (range - sweetHigh)
    return 1.0 - 0.5 * t
  }

  return 1.0  // unreachable, fallback
}
