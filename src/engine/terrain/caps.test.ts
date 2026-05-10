// v1.0 (10/05/2026) — Phase 2 2A.4 : tests TERRAIN_CAPS
// Cible : 4 tests (PLAN-PHASE-2-COMBAT-V2.md § 2A.4)

import { describe, it, expect } from 'vitest'
import { TERRAIN_CAPS, getTerrainCaps, isChargeAllowed } from './caps'
import { TERRAIN_TYPES } from './types'
import type { TerrainType } from './types'

describe('engine/terrain/caps', () => {
  it('tous les terrains sont definis et accessibles via getTerrainCaps', () => {
    for (const t of TERRAIN_TYPES) {
      const caps = getTerrainCaps(t)
      expect(caps).toBeDefined()
      expect(caps.contactCap).toBeGreaterThan(0)
      expect(caps.defBonus).toBeGreaterThan(0)
      expect(caps.atkPenalty).toBeGreaterThan(0)
      expect(caps.cavMovementPenalty).toBeGreaterThanOrEqual(0)
      expect(typeof caps.chargeAllowed).toBe('boolean')
    }
  })

  it('plafonds croissants : breche < pont < foret < bosquet < plaine_standard < plaine_ouverte', () => {
    const order: TerrainType[] = ['breche', 'pont', 'foret', 'bosquet', 'plaine_standard', 'plaine_ouverte']
    for (let i = 1; i < order.length; i++) {
      expect(TERRAIN_CAPS[order[i]].contactCap).toBeGreaterThan(TERRAIN_CAPS[order[i - 1]].contactCap)
    }
    // valeurs absolues conformes au brainstorm
    expect(TERRAIN_CAPS.breche.contactCap).toBe(50)
    expect(TERRAIN_CAPS.pont.contactCap).toBe(80)
    expect(TERRAIN_CAPS.foret.contactCap).toBe(100)
    expect(TERRAIN_CAPS.bosquet.contactCap).toBe(150)
    expect(TERRAIN_CAPS.plaine_standard.contactCap).toBe(200)
    expect(TERRAIN_CAPS.plaine_ouverte.contactCap).toBe(300)
  })

  it('charge cavalerie autorisee uniquement sur plaines, interdite sinon', () => {
    expect(isChargeAllowed('plaine_ouverte')).toBe(true)
    expect(isChargeAllowed('plaine_standard')).toBe(true)
    expect(isChargeAllowed('bosquet')).toBe(false)
    expect(isChargeAllowed('foret')).toBe(false)
    expect(isChargeAllowed('pont')).toBe(false)
    expect(isChargeAllowed('breche')).toBe(false)
  })

  it('terrain difficile = bonus defense > 1, malus attaque <= 1', () => {
    // Forêt : combat dispersé, gros avantage défensif
    expect(TERRAIN_CAPS.foret.defBonus).toBeGreaterThan(1)
    expect(TERRAIN_CAPS.foret.atkPenalty).toBeLessThanOrEqual(1)
    // Brèche / Thermopyles : défense forte
    expect(TERRAIN_CAPS.breche.defBonus).toBeGreaterThan(1)
    // Plaine : neutre
    expect(TERRAIN_CAPS.plaine_standard.defBonus).toBe(1.0)
    expect(TERRAIN_CAPS.plaine_standard.atkPenalty).toBe(1.0)
  })

  it('table TERRAIN_CAPS et chacune de ses entrees sont frozen runtime', () => {
    expect(Object.isFrozen(TERRAIN_CAPS)).toBe(true)
    for (const t of TERRAIN_TYPES) {
      expect(Object.isFrozen(TERRAIN_CAPS[t])).toBe(true)
    }
  })
})
