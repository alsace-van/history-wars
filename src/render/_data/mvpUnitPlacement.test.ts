// v1.2 (14/05/2026) — Phase 3.3 : 10 unites (2I+1C+1A_light+1A_heavy par equipe)
// v1.1 (12/05/2026) — MVP tweak : 8 unites (2I+1C+1A par equipe)
import { describe, it, expect } from 'vitest'
import { buildMvpUnitPlacement } from './mvpUnitPlacement'
import { cubeDistance } from '@engine/hex'

describe('buildMvpUnitPlacement', () => {
  const units = buildMvpUnitPlacement()

  it('genere 10 unites', () => {
    expect(units).toHaveLength(10)
  })

  it('5 par equipe', () => {
    expect(units.filter(u => u.team === 'blue')).toHaveLength(5)
    expect(units.filter(u => u.team === 'red')).toHaveLength(5)
  })

  it('2 Infanterie + 1 Cavalerie + 2 Artillerie par equipe', () => {
    const blueKinds = units.filter(u => u.team === 'blue').map(u => u.kind).sort()
    const redKinds = units.filter(u => u.team === 'red').map(u => u.kind).sort()
    expect(blueKinds).toEqual(['A', 'A', 'C', 'I', 'I'])
    expect(redKinds).toEqual(['A', 'A', 'C', 'I', 'I'])
  })

  it('Phase 3.3 : 1 artillerie légère + 1 lourde par equipe', () => {
    const blueArt = units.filter(u => u.team === 'blue' && u.kind === 'A').map(u => u.subKind).sort()
    const redArt = units.filter(u => u.team === 'red' && u.kind === 'A').map(u => u.subKind).sort()
    expect(blueArt).toEqual(['artillery_heavy', 'artillery_light'])
    expect(redArt).toEqual(['artillery_heavy', 'artillery_light'])
  })

  it('blue cote ouest (q<0), red cote est (q>0)', () => {
    for (const u of units) {
      if (u.team === 'blue') expect(u.position.q).toBeLessThan(0)
      else expect(u.position.q).toBeGreaterThan(0)
    }
  })

  it('distance min blue<->red >= 4 hex', () => {
    const blues = units.filter(u => u.team === 'blue')
    const reds = units.filter(u => u.team === 'red')
    for (const b of blues) {
      for (const r of reds) {
        expect(cubeDistance(b.position, r.position)).toBeGreaterThanOrEqual(4)
      }
    }
  })

  it('ids uniques', () => {
    const ids = new Set(units.map(u => u.id))
    expect(ids.size).toBe(units.length)
  })
})
