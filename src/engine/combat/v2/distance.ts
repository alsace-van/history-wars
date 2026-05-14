// v1.1 (14/05/2026) — Phase 3.3 : optionnel optimalRangeMax (zone optimale explicite ; falloff au-delà)
// v1.0 (10/05/2026) — Phase 2 2A.8 : courbe de precision pour attaque distance
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.8

/** Multiplicateur de précision minimal en queue de portée (Phase 3.3 explicit mode). */
export const RANGED_PRECISION_FLOOR = 0.4

/**
 * Multiplicateur de precision selon la distance, la portee max, et la portee min.
 *
 * Phase 3.3 — 2 modes selon `optimalRangeMax` :
 *
 *  **Mode explicit** (optimalRangeMax fourni, typique artillerie light/heavy) :
 *   - distance < minRange ou > range → 0
 *   - distance ∈ [minRange, optimalRangeMax] → 1.0 (zone optimale, dégâts pleins)
 *   - distance ∈ (optimalRangeMax, range] → lerp 1.0 → RANGED_PRECISION_FLOOR (0.4)
 *   - Si optimalRangeMax >= range : pas de falloff, 1.0 sur tout [minRange, range].
 *
 *  **Mode legacy** (optimalRangeMax absent, archer historique) :
 *   - sweet_low  = max(minRange, round(range * 0.4))
 *   - sweet_high = round(range * 0.7)
 *   - dans le sweet spot              → 1.0
 *   - entre minRange et sweet_low     → lerp 0.85 → 1.0
 *   - entre sweet_high et range       → lerp 1.0 → 0.5
 *
 * Tests § 2A.8 du plan + Phase 3.3 :
 *  - artillerie minRange=2, distance=1 → 0
 *  - archer range=4, distance=2 → 1.0 (sweet spot legacy)
 *  - archer range=4, distance=4 → 0.5 (tail-off legacy)
 *  - artillery_heavy range=6, minRange=2, optimalMax=3, distance=3 → 1.0
 *  - artillery_heavy range=6, optimalMax=3, distance=6 → 0.4 (floor)
 *  - artillery_light range=3, optimalMax=3, distance=3 → 1.0 (max=optimal, pas de falloff)
 */
export function distancePrecision(
  distance: number,
  range: number,
  minRange: number = 0,
  optimalRangeMax?: number,
): number {
  if (distance < minRange) return 0
  if (distance > range) return 0
  if (distance < 1) return 0           // melee gere ailleurs
  if (range < 1) return 0              // pas une unite a distance

  // Phase 3.3 — mode explicit (optimalRangeMax fourni).
  if (optimalRangeMax !== undefined) {
    if (distance <= optimalRangeMax) return 1.0
    if (range <= optimalRangeMax) return 1.0  // max = optimal → pas de falloff possible
    const t = (distance - optimalRangeMax) / (range - optimalRangeMax)
    return 1.0 - (1.0 - RANGED_PRECISION_FLOOR) * t
  }

  // Mode legacy (auto sweet spot 40-70%).
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

  return 1.0  // unreachable, fallback
}
