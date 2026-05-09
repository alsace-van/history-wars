// v1.0 (09/05/2026) — Phase 1 L1B.3 : port hex/types pour Deno EF
// Source de verite : src/engine/hex/types.ts. Duplication controlee (piege #12).

export interface Cube {
  readonly q: number
  readonly r: number
  readonly s: number
}

export interface Axial {
  readonly q: number
  readonly r: number
}
