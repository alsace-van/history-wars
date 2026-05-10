// v1.0 (10/05/2026) — Phase 2 2A.6 : tests pipeline contact (effectif, charge, terrain, saturation)
// Cible : 14 tests (PLAN-PHASE-2-COMBAT-V2.md § 2A.11)

import { describe, it, expect } from 'vitest'
import { cube } from '../../hex'
import { seededRng } from '../rng'
import type { UnitState, UnitSubKind } from '../../units/types'
import type { TerrainType } from '../../terrain/types'
import { resolveContact } from './contact'
import type { AttackPhase } from './types'

function makeUnit(overrides: Partial<UnitState>): UnitState {
  return {
    id: 'u',
    kind: 'I',
    team: 'blue',
    position: cube(0, 0, 0),
    hp: 100,
    hpMax: 100,
    wounded: 0,
    morale: 75,   // morale neutre par défaut (pas de bonus combat)
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

interface ContactRunOpts {
  attacker?: Partial<UnitState>
  defender?: Partial<UnitState>
  phase?: AttackPhase
  attackerTerrain?: TerrainType
  defenderTerrain?: TerrainType
  distance?: number
  chargeMult?: number
  seed?: number
  subKindAtt?: UnitSubKind
  subKindDef?: UnitSubKind
}

function runContact(opts: ContactRunOpts = {}) {
  const attacker = makeUnit({ ...(opts.subKindAtt ? { subKind: opts.subKindAtt } : {}), ...opts.attacker })
  const defender = makeUnit({
    id: 'd',
    team: 'red',
    position: cube(1, 0, -1),
    ...(opts.subKindDef ? { subKind: opts.subKindDef } : {}),
    ...opts.defender,
  })
  return resolveContact({
    attacker,
    defender,
    phase: opts.phase ?? 'melee',
    attackerTerrain: opts.attackerTerrain ?? 'plaine_standard',
    defenderTerrain: opts.defenderTerrain ?? 'plaine_standard',
    distance: opts.distance ?? 1,
    chargeMult: opts.chargeMult ?? 1.0,
    rng: seededRng(opts.seed ?? 1),
  })
}

describe('engine/combat/v2/contact — effectif elastique', () => {
  it('un bataillon de 100 inflige + de degats qu un de 50 (effectif compte sub-saturation)', () => {
    // sub-saturation : plaine_standard cap 200, on reste largement sous le cap.
    // Defenseur faible (50) pour que la difference d'attaquants se voie clairement.
    const small = runContact({
      attacker: { effective: 50, effectiveMax: 800 },
      defender: { effective: 50 },
      phase: 'melee',
      seed: 1,
    })
    const big = runContact({
      attacker: { effective: 100, effectiveMax: 800 },
      defender: { effective: 50 },
      phase: 'melee',
      seed: 1,
    })
    // big a 2x plus d'attaquants → big.damageDealt > small.damageDealt
    expect(big.damageDealt).toBeGreaterThan(small.damageDealt)
  })

  it('saturation plaine_standard : 1800 vs 800 ne fait pas plus de degats que 800 vs 800 (cap 200)', () => {
    const sat1 = runContact({
      attacker: { effective: 800, effectiveMax: 1600 },
      defender: { effective: 800 },
      phase: 'melee',
      seed: 3,
    })
    const sat2 = runContact({
      attacker: { effective: 1800, effectiveMax: 1600 },
      defender: { effective: 800 },
      phase: 'melee',
      seed: 3,
    })
    // Meme seed → meme rng → meme variance → meme damage
    expect(sat2.menEngagedAttacker).toBe(sat1.menEngagedAttacker)  // 200 dans les 2 cas
    expect(sat2.damageDealt).toBe(sat1.damageDealt)
  })

  it('Thermopyles : 100 sur breche (cap 50) tient presque autant que 800 sur breche', () => {
    const small = runContact({
      attacker: { effective: 800 },
      defender: { effective: 100 },
      attackerTerrain: 'breche',
      defenderTerrain: 'breche',
      seed: 5,
    })
    const big = runContact({
      attacker: { effective: 800 },
      defender: { effective: 800 },
      attackerTerrain: 'breche',
      defenderTerrain: 'breche',
      seed: 5,
    })
    // Cap breche = 50, donc menEngagedDefender = 50 dans les 2 cas
    expect(small.menEngagedDefender).toBe(50)
    expect(big.menEngagedDefender).toBe(50)
    // Donc damageDealt identique (même puissance face à même résistance)
    expect(small.damageDealt).toBe(big.damageDealt)
  })
})

describe('engine/combat/v2/contact — charge cavalerie', () => {
  it('charge cav inflige plus de degats que melee classique cav vs inf', () => {
    const noCharge = runContact({
      attacker: { kind: 'C', effective: 180, effectiveMax: 180, effectiveMin: 25 },
      defender: { effective: 800 },
      phase: 'melee',
      chargeMult: 1.0,
      seed: 11,
    })
    const charge = runContact({
      attacker: { kind: 'C', effective: 180, effectiveMax: 180, effectiveMin: 25 },
      defender: { effective: 800 },
      phase: 'charge',
      chargeMult: 1.5,   // 4+ hex parcourus
      seed: 11,
    })
    expect(charge.damageDealt).toBeGreaterThan(noCharge.damageDealt)
    expect(charge.chargeBonusApplied).toBe(true)
  })

  it('charge applique chargeMult dans le breakdown', () => {
    const charge = runContact({
      attacker: { kind: 'C', effective: 180, effectiveMax: 180, effectiveMin: 25 },
      defender: { effective: 800 },
      phase: 'charge',
      chargeMult: 1.4,
      seed: 12,
    })
    const chargeEntry = charge.bonusBreakdown.find(b => b.label === 'Charge cav')
    expect(chargeEntry).toBeDefined()
    expect(chargeEntry?.multiplier).toBe(1.4)
  })
})

describe('engine/combat/v2/contact — terrain', () => {
  it('foret cap 100 et def +50% : defenseur faible (A) en foret encaisse moins de degats', () => {
    // I (att 1.0, 800 hommes) vs A (def 0.3, 120 hommes) → matchup melee 1.5
    // Plaine cap 200 → att 200, def 120, power 200×1.5=300, resistance 120×0.3=36 → damage ~264
    // Foret cap 100 → att 100, def 100, power 100×1.5=150, resistance 100×0.3×1.5=45 → damage ~105
    const plaine = runContact({
      attacker: { kind: 'I', effective: 800 },
      defender: { kind: 'A', effective: 120, effectiveMax: 120, effectiveMin: 30 },
      defenderTerrain: 'plaine_standard',
      seed: 21,
    })
    const foret = runContact({
      attacker: { kind: 'I', effective: 800 },
      defender: { kind: 'A', effective: 120, effectiveMax: 120, effectiveMin: 30 },
      defenderTerrain: 'foret',
      seed: 21,
    })
    expect(foret.damageDealt).toBeLessThan(plaine.damageDealt)
  })

  it('contactCap utilise = min(att, def)', () => {
    const r = runContact({
      attacker: { effective: 800 },
      defender: { effective: 800 },
      attackerTerrain: 'plaine_ouverte',  // cap 300
      defenderTerrain: 'pont',             // cap 80
      seed: 22,
    })
    expect(r.contactCap).toBe(80)
    expect(r.menEngagedAttacker).toBe(80)
    expect(r.menEngagedDefender).toBe(80)
  })
})

describe('engine/combat/v2/contact — matchup matriciel', () => {
  it('infanterie vs artillerie en melee : avantage net (matchup 1.5)', () => {
    const r = runContact({
      attacker: { kind: 'I', effective: 800 },
      defender: { kind: 'A', effective: 120, effectiveMax: 120, effectiveMin: 30 },
      seed: 31,
    })
    const matchupEntry = r.bonusBreakdown.find(b => b.label.startsWith('Type'))
    expect(matchupEntry).toBeDefined()
    expect(matchupEntry?.multiplier).toBe(1.5)
  })

  it('artillerie vs infanterie en melee : gros desavantage (matchup 0.5)', () => {
    const r = runContact({
      attacker: { kind: 'A', effective: 120, effectiveMax: 120, effectiveMin: 30 },
      defender: { kind: 'I', effective: 800 },
      seed: 32,
    })
    const matchupEntry = r.bonusBreakdown.find(b => b.label.startsWith('Type'))
    expect(matchupEntry?.multiplier).toBe(0.5)
  })
})

describe('engine/combat/v2/contact — distance', () => {
  it('artillerie tire a distance 1 (sous minRange=2) → 0 degats', () => {
    const r = runContact({
      attacker: { kind: 'A', effective: 120, effectiveMax: 120, effectiveMin: 30 },
      defender: { effective: 800 },
      phase: 'ranged',
      distance: 1,
      seed: 41,
    })
    expect(r.damageDealt).toBe(0)
  })

  it('artillerie tire a distance optimale (3-5) > distance max (7)', () => {
    const optimal = runContact({
      attacker: { kind: 'A', effective: 120, effectiveMax: 120, effectiveMin: 30 },
      defender: { effective: 800 },
      phase: 'ranged',
      distance: 4,
      seed: 42,
    })
    const farMax = runContact({
      attacker: { kind: 'A', effective: 120, effectiveMax: 120, effectiveMin: 30 },
      defender: { effective: 800 },
      phase: 'ranged',
      distance: 7,
      seed: 42,
    })
    expect(optimal.damageDealt).toBeGreaterThan(farMax.damageDealt)
  })

  it('archer (subKind=archer) range=4, distance=2 → sweet spot, distance=4 → tail-off', () => {
    const sweet = runContact({
      attacker: { kind: 'A', subKind: 'archer', effective: 120, effectiveMax: 120, effectiveMin: 30 },
      defender: { effective: 800 },
      phase: 'ranged',
      distance: 2,
      seed: 43,
    })
    const max = runContact({
      attacker: { kind: 'A', subKind: 'archer', effective: 120, effectiveMax: 120, effectiveMin: 30 },
      defender: { effective: 800 },
      phase: 'ranged',
      distance: 4,
      seed: 43,
    })
    expect(sweet.damageDealt).toBeGreaterThan(max.damageDealt)
  })
})

describe('engine/combat/v2/contact — invariants', () => {
  it('killed + woundedAdd === actualDamage', () => {
    const r = runContact({
      attacker: { kind: 'C', effective: 180, effectiveMax: 180, effectiveMin: 25 },
      defender: { effective: 800 },
      phase: 'charge',
      chargeMult: 1.5,
      seed: 51,
    })
    expect(r.killed + r.woundedAdd).toBe(r.actualDamage)
  })

  it('defenderEffectiveAfter <= defender.effective', () => {
    const r = runContact({
      attacker: { effective: 800 },
      defender: { effective: 800 },
      seed: 52,
    })
    expect(r.defenderEffectiveAfter).toBeLessThanOrEqual(800)
  })

  it('rng deterministe : meme seed → meme resultat', () => {
    const r1 = runContact({ attacker: { effective: 800 }, defender: { effective: 800 }, seed: 99 })
    const r2 = runContact({ attacker: { effective: 800 }, defender: { effective: 800 }, seed: 99 })
    expect(r1.damageDealt).toBe(r2.damageDealt)
    expect(r1.rollUsed).toBe(r2.rollUsed)
  })

  it('breakdown contient TIR base au lieu de ATK base en ranged', () => {
    const r = runContact({
      attacker: { kind: 'A', effective: 120, effectiveMax: 120, effectiveMin: 30 },
      defender: { effective: 800 },
      phase: 'ranged',
      distance: 4,
      seed: 53,
    })
    expect(r.bonusBreakdown.some(b => b.label === 'TIR base')).toBe(true)
    expect(r.bonusBreakdown.some(b => b.label === 'ATK base')).toBe(false)
  })

  // Phase 2.5 balance : plancher d'attrition proportionnel
  it('regression: 800I vs 800I plaine_standard inflige >= baseAttrition (pas 1)', () => {
    // Bug user 10/05/2026 : a forces parfaitement egales (power = resistance), l'ancien
    // plancher fixe 1 donnait 1 degat. Nouveau plancher = round(menEngaged * 0.08) = 16.
    // Variance ±15 % s'applique mais le plancher reste enforce.
    const r = runContact({
      attacker: { effective: 800, morale: 75 },
      defender: { effective: 800, morale: 75 },
      attackerTerrain: 'plaine_standard',
      defenderTerrain: 'plaine_standard',
      phase: 'melee',
      seed: 7,
    })
    // contactCap plaine_standard = 200, attrition 8 % = 16 pertes minimum
    expect(r.menEngagedAttacker).toBe(200)
    expect(r.damageDealt).toBeGreaterThanOrEqual(16)
  })

  it('plancher attrition scale avec contactCap (breche cap 50 → ~4 pertes min)', () => {
    const r = runContact({
      attacker: { effective: 800, morale: 75 },
      defender: { effective: 800, morale: 75 },
      attackerTerrain: 'breche',
      defenderTerrain: 'breche',
      phase: 'melee',
      seed: 11,
    })
    // contactCap breche = 50, attrition 8 % = max(1, round(50 * 0.08)) = 4
    expect(r.menEngagedAttacker).toBe(50)
    expect(r.damageDealt).toBeGreaterThanOrEqual(4)
  })
})
