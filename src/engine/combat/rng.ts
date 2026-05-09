// v1.0 (09/05/2026) — Phase 1 L1A.3 : Mulberry32 PRNG seede
// Source : PLAN-PHASE-1.md § 2.2 (engine/combat/rng.ts)
// Algo standard, deterministe cross-runtime (client TS / EF Deno).

/**
 * Mulberry32 : PRNG rapide, periode ~2^32, biais negligeable pour usage combat.
 * Retourne une fonction () → number ∈ [0, 1).
 */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
