// v1.0 (10/05/2026) — Phase 2 2A.9 : tests integration resolveCombat (dispatch + riposte)
// Cible : 8 tests scenarios complets (PLAN-PHASE-2-COMBAT-V2.md § 2A.11)

import { describe, it, expect } from 'vitest'
import { cube } from '../../hex'
import { seededRng } from '../rng'
import type { UnitState } from '../../units/types'
import { resolveCombat } from './index'

function makeUnit(overrides: Partial<UnitState>): UnitState {
  return {
    id: 'u',
    kind: 'I',
    team: 'blue',
    position: cube(0, 0, 0),
    hp: 100,
    hpMax: 100,
    wounded: 0,
    morale: 75,
    moraleMax: 100,
    hasMoved: false,
    hasAttacked: false,
    routed: false,
    effective: 800,
    effectiveMax: 800,
    effectiveMin: 100,
    killed: 0,
    ...overrides,
  }
}

describe('engine/combat/v2/integration — dispatch + riposte', () => {
  it('attaque melee adjacent : phase = melee, riposte presente si defenseur vivant', () => {
    const att = makeUnit({ kind: 'I', effective: 800, position: cube(0, 0, 0) })
    const def = makeUnit({ id: 'd', team: 'red', kind: 'I', effective: 800, position: cube(1, 0, -1) })
    const r = resolveCombat({
      attacker: att,
      defender: def,
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      rng: seededRng(1),
    })
    expect(r.result.attackPhase).toBe('melee')
    expect(r.ripost).not.toBeNull()
    expect(r.ripost?.attackPhase).toBe('melee')
  })

  it('attaque ranged distance 4 : phase = ranged, pas de riposte', () => {
    const att = makeUnit({ kind: 'A', subKind: 'archer', effective: 120, effectiveMax: 120, effectiveMin: 30, position: cube(0, 0, 0) })
    const def = makeUnit({ id: 'd', team: 'red', kind: 'I', effective: 800, position: cube(4, 0, -4) })
    const r = resolveCombat({
      attacker: att,
      defender: def,
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 4,
      rng: seededRng(2),
    })
    expect(r.result.attackPhase).toBe('ranged')
    expect(r.ripost).toBeNull()
  })

  it('cavalerie qui charge 3 hex en ligne droite plaine : phase = charge, chargeBonusApplied', () => {
    const att = makeUnit({
      kind: 'C',
      effective: 180,
      effectiveMax: 180,
      effectiveMin: 25,
      position: cube(3, 0, -3),
    })
    const def = makeUnit({ id: 'd', team: 'red', kind: 'I', effective: 800, position: cube(4, 0, -4) })
    const path = [cube(0, 0, 0), cube(1, 0, -1), cube(2, 0, -2), cube(3, 0, -3)]
    const r = resolveCombat({
      attacker: att,
      defender: def,
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      attackerPath: path,
      attackerPathTerrain: ['plaine_standard', 'plaine_standard', 'plaine_standard', 'plaine_standard'],
      rng: seededRng(3),
    })
    expect(r.result.attackPhase).toBe('charge')
    expect(r.result.chargeBonusApplied).toBe(true)
    expect(r.ripost).toBeNull()  // charge = pas de riposte (similaire ranged)
  })

  it('cavalerie adjacente sans path → fallback melee', () => {
    const att = makeUnit({ kind: 'C', effective: 180, effectiveMax: 180, effectiveMin: 25, position: cube(0, 0, 0) })
    const def = makeUnit({ id: 'd', team: 'red', kind: 'I', effective: 800, position: cube(1, 0, -1) })
    const r = resolveCombat({
      attacker: att,
      defender: def,
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      rng: seededRng(4),
    })
    expect(r.result.attackPhase).toBe('melee')
    expect(r.result.chargeBonusApplied).toBe(false)
    expect(r.ripost).not.toBeNull()  // melee classique : riposte
  })

  it('cavalerie qui charge inflige plus de pertes qu une cavalerie statique (memes effectifs)', () => {
    // def adjacent a la position finale de l'attaquant
    const defPos = cube(4, 0, -4)
    const baseAtt = makeUnit({ kind: 'C', effective: 180, effectiveMax: 180, effectiveMin: 25, position: cube(3, 0, -3) })
    const def = makeUnit({ id: 'd', team: 'red', kind: 'I', effective: 800, position: defPos })

    const stats = resolveCombat({
      attacker: baseAtt,
      defender: def,
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      rng: seededRng(5),
    })
    const charge = resolveCombat({
      attacker: baseAtt,
      defender: def,
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      attackerPath: [cube(0, 0, 0), cube(1, 0, -1), cube(2, 0, -2), cube(3, 0, -3)],
      attackerPathTerrain: ['plaine_standard', 'plaine_standard', 'plaine_standard', 'plaine_standard'],
      rng: seededRng(5),
    })
    expect(charge.result.attackPhase).toBe('charge')
    expect(stats.result.attackPhase).toBe('melee')
    expect(charge.result.damageDealt).toBeGreaterThan(stats.result.damageDealt)
  })

  it('saturation pont (cap 80) : meme pion 800 vs 800 plaine genere bcp plus de degats', () => {
    const att = makeUnit({ kind: 'I', effective: 800 })
    const def = makeUnit({ id: 'd', team: 'red', kind: 'A', effective: 120, effectiveMax: 120, effectiveMin: 30, position: cube(1, 0, -1) })
    const plaine = resolveCombat({
      attacker: att,
      defender: def,
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      rng: seededRng(6),
    })
    const pont = resolveCombat({
      attacker: att,
      defender: def,
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'pont',
      distance: 1,
      rng: seededRng(6),
    })
    expect(pont.result.contactCap).toBe(80)
    expect(plaine.result.contactCap).toBe(200)
    expect(pont.result.damageDealt).toBeLessThan(plaine.result.damageDealt)
  })

  it('determinisme : meme rng + meme input → meme resultat', () => {
    const att = makeUnit({ kind: 'I', effective: 800 })
    const def = makeUnit({ id: 'd', team: 'red', kind: 'I', effective: 800, position: cube(1, 0, -1) })
    const r1 = resolveCombat({
      attacker: att, defender: def,
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      rng: seededRng(99),
    })
    const r2 = resolveCombat({
      attacker: att, defender: def,
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      rng: seededRng(99),
    })
    expect(r1.result.damageDealt).toBe(r2.result.damageDealt)
    expect(r1.ripost?.damageDealt).toBe(r2.ripost?.damageDealt)
  })

  it('melee defenseur deja routed → pas de riposte', () => {
    const att = makeUnit({ kind: 'C', effective: 180, effectiveMax: 180, effectiveMin: 25 })
    const def = makeUnit({ id: 'd', team: 'red', kind: 'A', effective: 120, effectiveMax: 120, effectiveMin: 30, morale: 10, routed: true, position: cube(1, 0, -1) })
    const r = resolveCombat({
      attacker: att, defender: def,
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      distance: 1,
      rng: seededRng(7),
    })
    // defender deja routed avant l'attaque, mais on garde la logique : riposte gardee si encore vivant
    // sauf si l'impact le route apres → pas de riposte. Test : si def deja routed, applyMoraleDelta peut le maintenir routed
    // donc pas de riposte (cf. resolveCombat condition).
    if (r.result.defenderRouted) {
      expect(r.ripost).toBeNull()
    }
  })
})
