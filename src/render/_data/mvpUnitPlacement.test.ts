// v1.0 (09/05/2026) — Tests buildMvpUnitPlacement
import { describe, it, expect } from 'vitest'
import { buildMvpUnitPlacement } from './mvpUnitPlacement'
import { cubeDistance } from '@engine/hex'

describe('buildMvpUnitPlacement', () => {
  const units = buildMvpUnitPlacement()

  it('genere 6 unites', () => {
    expect(units).toHaveLength(6)
  })

  it('3 par equipe', () => {
    expect(units.filter(u => u.team === 'blue')).toHaveLength(3)
    expect(units.filter(u => u.team === 'red')).toHaveLength(3)
  })

  it('1 de chaque type par equipe', () => {
    const blueKinds = units.filter(u => u.team === 'blue').map(u => u.kind).sort()
    const redKinds = units.filter(u => u.team === 'red').map(u => u.kind).sort()
    expect(blueKinds).toEqual(['A', 'C', 'I'])
    expect(redKinds).toEqual(['A', 'C', 'I'])
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
