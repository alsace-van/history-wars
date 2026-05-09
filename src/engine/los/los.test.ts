// v1.0 (09/05/2026) — Phase 1 L1A.3 : tests LoS
// Cible : 5 tests

import { describe, it, expect } from 'vitest'
import { cube, cubeKey } from '../hex'
import { hasLineOfSight } from './los'

const NO_BLOCK = new Set<string>()

describe('engine/los', () => {
  it('voisin direct (distance 1) → true (pas d\'intermediaire) — piege #16', () => {
    const from = cube(0, 0, 0)
    const to = cube(1, 0, -1)
    expect(hasLineOfSight(from, to, NO_BLOCK)).toBe(true)
    // meme avec un blocker partout, distance 1 reste true (aucun intermediaire a verifier)
    const everywhere = new Set<string>([cubeKey(from), cubeKey(to)])
    expect(hasLineOfSight(from, to, everywhere)).toBe(true)
  })

  it('ligne libre distance 4 → true', () => {
    const from = cube(0, 0, 0)
    const to = cube(4, 0, -4)
    expect(hasLineOfSight(from, to, NO_BLOCK)).toBe(true)
  })

  it('bloqueur au milieu → false', () => {
    const from = cube(0, 0, 0)
    const to = cube(4, 0, -4)
    const mid = cube(2, 0, -2)
    expect(hasLineOfSight(from, to, new Set([cubeKey(mid)]))).toBe(false)
  })

  it('bloqueur sur from ou to → ignore (true)', () => {
    const from = cube(0, 0, 0)
    const to = cube(3, 0, -3)
    expect(hasLineOfSight(from, to, new Set([cubeKey(from)]))).toBe(true)
    expect(hasLineOfSight(from, to, new Set([cubeKey(to)]))).toBe(true)
  })

  it('bloqueur a cote de la ligne mais pas dessus → true', () => {
    const from = cube(0, 0, 0)
    const to = cube(4, 0, -4)
    // hex hors-ligne : (2,-1,-1) est voisin de la ligne mais pas dessus
    const aside = cube(2, -1, -1)
    expect(hasLineOfSight(from, to, new Set([cubeKey(aside)]))).toBe(true)
  })
})
