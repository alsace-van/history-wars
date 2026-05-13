// v1.0 (11/05/2026) — Phase 2.6 Vague A : tests engine engagement persistant
// Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 2-3-6

import { describe, expect, it } from 'vitest'
import { cube } from '../hex'
import type { UnitState } from '../units/types'
import {
  BREAK_COMBAT_COST_RATIO,
  ENGAGEMENT_MORALE_DELTA_PER_TURN,
  RESERVE_RELIEF_RATE,
  breakCombat,
  getEngagementOpponent,
  isEngagedWith,
  resolveEngagementTick,
  startEngagement,
  type EngagementState,
} from './index'

// -------------------- Fixtures --------------------

function makeUnit(overrides: Partial<UnitState> = {}): UnitState {
  return {
    id: 'u1',
    kind: 'I',
    team: 'blue',
    position: cube(0, 0, 0),
    hp: 100,
    hpMax: 100,
    wounded: 0,
    morale: 80,
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

/** RNG déterministe centré (variance = 1.0 exactement). */
const midRng = () => 0.5

/** RNG max variance haute (=1.05). */
const highRng = () => 0.999

/** RNG min variance basse (=0.95). */
const lowRng = () => 0

// -------------------- resolveEngagementTick --------------------

describe('engine/engagement — resolveEngagementTick', () => {
  it('forces égales I 200 vs I 200 plaine_standard → pertes ~équilibrées et > 0', () => {
    const sideA = makeUnit({ id: 'A', effective: 200, team: 'blue' })
    const sideB = makeUnit({ id: 'B', effective: 200, team: 'red', position: cube(1, 0, -1) })
    const result = resolveEngagementTick({
      sideA,
      sideB,
      terrain: 'plaine_standard',
      currentTurn: 1,
      rng: midRng,
    })
    // À forces égales sur plaine standard (cap 200, attrition 8% × 200 = 16 plancher),
    // les 2 côtés subissent au moins le plancher × variance médiane (1.0) = 16.
    expect(result.sideA.actualDamage).toBeGreaterThanOrEqual(16)
    expect(result.sideB.actualDamage).toBeGreaterThanOrEqual(16)
    // Variance bornée : les pertes A et B ne diffèrent pas de plus de ~5 (variance ±5%)
    expect(Math.abs(result.sideA.actualDamage - result.sideB.actualDamage)).toBeLessThanOrEqual(5)
    expect(result.dissolved).toBe(false)
    expect(result.dissolutionReason).toBe('none')
  })

  it('asymétrie I 800 vs I 400 plaine : les 2 plafonnent au menEngaged terrain (200)', () => {
    // Sur plaine_standard, contactCap = 200. menEngaged identique des deux côtés.
    // Le 800 a donc une "réserve" de 600 (relief 60), le 400 une réserve de 200 (relief 20).
    // Pertes côté A et B sont du même ordre mais le 800 absorbe mieux relativement.
    const sideA = makeUnit({ id: 'A', effective: 800, team: 'blue' })
    const sideB = makeUnit({ id: 'B', effective: 400, team: 'red', position: cube(1, 0, -1) })
    const result = resolveEngagementTick({
      sideA,
      sideB,
      terrain: 'plaine_standard',
      currentTurn: 1,
      rng: midRng,
    })
    expect(result.sideA.menEngagedBefore).toBe(200)
    expect(result.sideB.menEngagedBefore).toBe(200)
    expect(result.sideA.effectiveAfter).toBeLessThan(800)
    expect(result.sideB.effectiveAfter).toBeLessThan(400)
    // Ratio relatif : B perd plus en pourcentage que A
    const ratioLossA = (result.sideA.effectiveBefore - result.sideA.effectiveAfter) / result.sideA.effectiveBefore
    const ratioLossB = (result.sideB.effectiveBefore - result.sideB.effectiveAfter) / result.sideB.effectiveBefore
    expect(ratioLossB).toBeGreaterThan(ratioLossA)
  })

  it('déterminisme : même RNG seed → mêmes pertes', () => {
    const args = {
      sideA: makeUnit({ id: 'A', effective: 800, team: 'blue' }),
      sideB: makeUnit({ id: 'B', effective: 800, team: 'red', position: cube(1, 0, -1) }),
      terrain: 'plaine_standard' as const,
      currentTurn: 1,
    }
    // Deux séquences RNG identiques doivent produire le même résultat.
    let i1 = 0
    const seq = [0.3, 0.7]
    const rng1 = () => seq[i1++ % seq.length]
    let i2 = 0
    const rng2 = () => seq[i2++ % seq.length]
    const r1 = resolveEngagementTick({ ...args, rng: rng1 })
    const r2 = resolveEngagementTick({ ...args, rng: rng2 })
    expect(r1.sideA.actualDamage).toBe(r2.sideA.actualDamage)
    expect(r1.sideB.actualDamage).toBe(r2.sideB.actualDamage)
  })

  it('relève des réserves : I 800 plaine, pertes plafonnées à menEngaged + 10% réserve', () => {
    // menEngaged = 200, reserve = 600, relief = 60 → absorbCapacity = 260
    // À forces égales 200 vs 200 le plancher est 16 — on cherche un cas où damageRaw dépasse 260
    // pour vérifier le plafond. On force avec une variance haute et un attaquant suréquipé.
    // Ici l'objectif est juste de vérifier que actualDamage ne peut pas excéder 260.
    const sideA = makeUnit({ id: 'A', effective: 800, team: 'blue' })
    const sideB = makeUnit({ id: 'B', effective: 800, team: 'red', position: cube(1, 0, -1) })
    const result = resolveEngagementTick({
      sideA,
      sideB,
      terrain: 'plaine_standard',
      currentTurn: 1,
      rng: highRng,
    })
    // sideA absorbCap = 200 (menEngaged) + round(600 × 0.1) = 200 + 60 = 260
    expect(result.sideA.actualDamage).toBeLessThanOrEqual(260)
    expect(result.sideB.actualDamage).toBeLessThanOrEqual(260)
  })

  it('sans réserve : I 200 vs I 200 plaine → menEngaged = 200, pas de relief', () => {
    // effective = 200, menEngaged = 200, reserve = 0, relief = 0 → absorbCap = 200
    const sideA = makeUnit({ id: 'A', effective: 200, team: 'blue' })
    const sideB = makeUnit({ id: 'B', effective: 200, team: 'red', position: cube(1, 0, -1) })
    const result = resolveEngagementTick({
      sideA,
      sideB,
      terrain: 'plaine_standard',
      currentTurn: 1,
      rng: midRng,
    })
    expect(result.sideA.actualDamage).toBeLessThanOrEqual(200)
    expect(result.sideB.actualDamage).toBeLessThanOrEqual(200)
  })

  it('forêt (cap 100) → menEngaged réduit, pertes globalement inférieures vs plaine', () => {
    const sideA = makeUnit({ id: 'A', effective: 800, team: 'blue' })
    const sideB = makeUnit({ id: 'B', effective: 800, team: 'red', position: cube(1, 0, -1) })
    const inPlaine = resolveEngagementTick({
      sideA, sideB, terrain: 'plaine_standard', currentTurn: 1, rng: midRng,
    })
    const inForet = resolveEngagementTick({
      sideA, sideB, terrain: 'foret', currentTurn: 1, rng: midRng,
    })
    expect(inForet.contactCap).toBe(100)
    expect(inPlaine.contactCap).toBe(200)
    // Forêt : menEngaged = 100 (< 200 plaine) ET defBonus 1.5 forêt augmente la résistance
    // → pertes nettement < plaine
    expect(inForet.sideA.actualDamage).toBeLessThan(inPlaine.sideA.actualDamage)
    expect(inForet.sideB.actualDamage).toBeLessThan(inPlaine.sideB.actualDamage)
  })

  it('variance ±5% : 2 ticks aux extrêmes diffèrent peu', () => {
    const sideA = makeUnit({ id: 'A', effective: 800, team: 'blue' })
    const sideB = makeUnit({ id: 'B', effective: 800, team: 'red', position: cube(1, 0, -1) })
    const rLow = resolveEngagementTick({
      sideA, sideB, terrain: 'plaine_standard', currentTurn: 1, rng: lowRng,
    })
    const rHigh = resolveEngagementTick({
      sideA, sideB, terrain: 'plaine_standard', currentTurn: 1, rng: highRng,
    })
    // Variance ±5 % autour de la valeur centrale → écart relatif max ~10 %
    const ratioGap = (rHigh.sideA.actualDamage - rLow.sideA.actualDamage) / Math.max(1, rLow.sideA.actualDamage)
    expect(ratioGap).toBeGreaterThanOrEqual(0)
    expect(ratioGap).toBeLessThanOrEqual(0.20) // marge tolérante pour les arrondis sur petites valeurs
  })

  it('dissolution unilatérale : I 105/800 vs I 800/800 → sideA tombe sous effectiveMin (100)', () => {
    // Le côté A a 105 effective, effectiveMin = 100, va prendre des pertes > 5 → dissolved
    const sideA = makeUnit({ id: 'A', effective: 105, effectiveMin: 100, team: 'blue' })
    const sideB = makeUnit({ id: 'B', effective: 800, team: 'red', position: cube(1, 0, -1) })
    const result = resolveEngagementTick({
      sideA, sideB, terrain: 'plaine_standard', currentTurn: 1, rng: midRng,
    })
    expect(result.sideA.dissolved).toBe(true)
    expect(result.sideB.dissolved).toBe(false)
    expect(result.dissolved).toBe(true)
    expect(result.dissolutionReason).toBe('sideA')
  })

  it('dissolution mutuelle : 2 unités fragiles tombent ensemble → reason="both"', () => {
    // 2 unités à 105/800 avec effectiveMin = 100 : les 2 perdent > 5 et tombent.
    const sideA = makeUnit({ id: 'A', effective: 105, effectiveMin: 100, team: 'blue' })
    const sideB = makeUnit({ id: 'B', effective: 105, effectiveMin: 100, team: 'red', position: cube(1, 0, -1) })
    const result = resolveEngagementTick({
      sideA, sideB, terrain: 'plaine_standard', currentTurn: 1, rng: midRng,
    })
    expect(result.dissolved).toBe(true)
    expect(result.dissolutionReason).toBe('both')
  })

  it('moral : delta inclut ENGAGEMENT_MORALE_DELTA_PER_TURN (-2) en plus des pertes', () => {
    const sideA = makeUnit({ id: 'A', effective: 800, team: 'blue', morale: 80 })
    const sideB = makeUnit({ id: 'B', effective: 800, team: 'red', position: cube(1, 0, -1), morale: 80 })
    const result = resolveEngagementTick({
      sideA, sideB, terrain: 'plaine_standard', currentTurn: 1, rng: midRng,
    })
    // moraleDelta = -round(actualDamage / 4) × supportMult(1.0) + (-2)
    // actualDamage ~= 16 → -4 + -2 = -6. Quel que soit le exact, c'est ≤ -2 (fatigue tour)
    expect(result.sideA.moraleDelta).toBeLessThanOrEqual(ENGAGEMENT_MORALE_DELTA_PER_TURN)
    expect(result.sideB.moraleDelta).toBeLessThanOrEqual(ENGAGEMENT_MORALE_DELTA_PER_TURN)
  })

  it('soutien réduit la perte de moral du défenseur (-2 fatigue reste invariant)', () => {
    const sideA = makeUnit({ id: 'A', effective: 800, team: 'blue', morale: 80 })
    const sideB = makeUnit({ id: 'B', effective: 800, team: 'red', position: cube(1, 0, -1), morale: 80 })
    const noSupport = resolveEngagementTick({
      sideA, sideB, terrain: 'plaine_standard', currentTurn: 1, rng: midRng,
    })
    const withSupport = resolveEngagementTick({
      sideA, sideB, terrain: 'plaine_standard', currentTurn: 1, rng: midRng,
      supportA: { adjacent: 3, nearby: 0, total: 3 },
    })
    // Le delta moral est moins négatif avec support (mais reste ≤ -2 grâce à fatigue)
    expect(withSupport.sideA.moraleDelta).toBeGreaterThanOrEqual(noSupport.sideA.moraleDelta)
    expect(withSupport.sideA.moraleDelta).toBeLessThanOrEqual(ENGAGEMENT_MORALE_DELTA_PER_TURN)
  })

  it('rollUsed propagé pour replay déterministe', () => {
    const seq = [0.42, 0.73]
    let i = 0
    const rng = () => seq[i++ % seq.length]
    const sideA = makeUnit({ id: 'A', effective: 800, team: 'blue' })
    const sideB = makeUnit({ id: 'B', effective: 800, team: 'red', position: cube(1, 0, -1) })
    const result = resolveEngagementTick({
      sideA, sideB, terrain: 'plaine_standard', currentTurn: 5, rng,
    })
    // Convention tick.ts : aToB tire d'abord puis bToA. sideB applique aToB.rollUsed,
    // sideA applique bToA.rollUsed.
    expect(result.sideB.rollUsed).toBe(0.42)
    expect(result.sideA.rollUsed).toBe(0.73)
    expect(result.currentTurn).toBe(5)
  })
})

// -------------------- startEngagement --------------------

describe('engine/engagement — startEngagement', () => {
  it('factory crée EngagementState avec champs corrects', () => {
    const a = makeUnit({ id: 'A', team: 'blue' })
    const b = makeUnit({ id: 'B', team: 'red', position: cube(1, 0, -1) })
    const e = startEngagement(a, b, 3, 'game-xyz', { id: 'eng-1' })
    expect(e.id).toBe('eng-1')
    expect(e.gameId).toBe('game-xyz')
    expect(e.unitAId).toBe('A')
    expect(e.unitBId).toBe('B')
    expect(e.startedTurn).toBe(3)
  })

  it('id vide par défaut (BDD vague B remplit via INSERT)', () => {
    const a = makeUnit({ id: 'A', team: 'blue' })
    const b = makeUnit({ id: 'B', team: 'red', position: cube(1, 0, -1) })
    const e = startEngagement(a, b, 1, 'g1')
    expect(e.id).toBe('')
  })

  it('throw si unitA.id === unitB.id', () => {
    const a = makeUnit({ id: 'X', team: 'blue' })
    const b = makeUnit({ id: 'X', team: 'red' })
    expect(() => startEngagement(a, b, 1, 'g1')).toThrow(/cannot engage a unit with itself/)
  })

  it('throw si même team', () => {
    const a = makeUnit({ id: 'A', team: 'blue' })
    const b = makeUnit({ id: 'B', team: 'blue' })
    expect(() => startEngagement(a, b, 1, 'g1')).toThrow(/opposing teams/)
  })
})

// -------------------- breakCombat --------------------

describe('engine/engagement — breakCombat', () => {
  it('coût 10 % effective appliqué (700/800 → 630, -70)', () => {
    const u = makeUnit({ effective: 700, effectiveMax: 800 })
    const result = breakCombat(u)
    // 700 × 0.1 = 70
    expect(result.actualDamage).toBe(70)
    expect(result.unitAfter.effective).toBe(630)
  })

  it('plancher à 1 perte si effective > 0', () => {
    // effective = 5 → 5 × 0.1 = 0.5 → round = 1 (plancher)
    const u = makeUnit({ effective: 5, effectiveMin: 0 })
    const result = breakCombat(u)
    expect(result.actualDamage).toBe(1)
    expect(result.unitAfter.effective).toBe(4)
  })

  it('ne descend jamais sous effectiveMin (plafond pertes)', () => {
    // effective = 105, effectiveMin = 100, 10 % = 10.5 → 11 brut mais plafonné à 5
    const u = makeUnit({ effective: 105, effectiveMin: 100 })
    const result = breakCombat(u)
    expect(result.actualDamage).toBe(5)
    expect(result.unitAfter.effective).toBe(100)
  })

  // v1.1 (12/05/2026) — Rompre ne consomme plus hasMoved : l'unité doit pouvoir
  // se replier dans le même tour après avoir rompu, sinon l'ennemi adjacent
  // ré-engage immédiatement et la rupture n'a aucun intérêt.
  it('consomme hasAttacked mais préserve hasMoved (mouvement conservé pour repli)', () => {
    const u = makeUnit({ effective: 800, hasMoved: false, hasAttacked: false })
    const result = breakCombat(u)
    expect(result.unitAfter.hasMoved).toBe(false) // peut encore se déplacer
    expect(result.unitAfter.hasAttacked).toBe(true) // mais a consommé son action
  })

  it('ne re-active pas hasMoved si déjà true (cas unité ayant déjà bougé avant de rompre)', () => {
    const u = makeUnit({ effective: 800, hasMoved: true, hasAttacked: false })
    const result = breakCombat(u)
    expect(result.unitAfter.hasMoved).toBe(true) // reste true (passé par spread)
    expect(result.unitAfter.hasAttacked).toBe(true)
  })

  it('killed + woundedAdd = actualDamage (split 60/40)', () => {
    const u = makeUnit({ effective: 800 })
    const result = breakCombat(u)
    expect(result.killed + result.woundedAdd).toBe(result.actualDamage)
    // KILLED_RATIO = 0.6 → 80 × 0.6 = 48 killed, 32 wounded
    expect(result.killed).toBe(48)
    expect(result.woundedAdd).toBe(32)
  })

  it('cumul killed dans UnitState.killed', () => {
    const u = makeUnit({ effective: 800, killed: 100 })
    const result = breakCombat(u)
    expect(result.unitAfter.killed).toBe(100 + result.killed)
  })

  it('constante BREAK_COMBAT_COST_RATIO === 0.1', () => {
    expect(BREAK_COMBAT_COST_RATIO).toBe(0.1)
  })
})

// -------------------- isEngagedWith + getEngagementOpponent --------------------

describe('engine/engagement — lookup helpers', () => {
  const e1: EngagementState = {
    id: 'e1', gameId: 'g1', unitAId: 'A', unitBId: 'B', startedTurn: 1,
  }
  const e2: EngagementState = {
    id: 'e2', gameId: 'g1', unitAId: 'C', unitBId: 'A', startedTurn: 2,
  }
  const e3: EngagementState = {
    id: 'e3', gameId: 'g1', unitAId: 'A', unitBId: 'D', startedTurn: 3,
  }

  it('isEngagedWith trouve les engagements d\'une unité (3× multi-engagement)', () => {
    const result = isEngagedWith('A', [e1, e2, e3])
    expect(result).toHaveLength(3)
    expect(result.map(e => e.id).sort()).toEqual(['e1', 'e2', 'e3'])
  })

  it('isEngagedWith retourne tableau vide si pas engagé', () => {
    const result = isEngagedWith('Z', [e1, e2, e3])
    expect(result).toEqual([])
  })

  it('isEngagedWith filtre correctement quel que soit le côté (A ou B)', () => {
    // C est sideA dans e2 → doit être trouvé
    const resultC = isEngagedWith('C', [e1, e2, e3])
    expect(resultC).toHaveLength(1)
    expect(resultC[0]?.id).toBe('e2')
    // B est sideB dans e1 → doit être trouvé
    const resultB = isEngagedWith('B', [e1, e2, e3])
    expect(resultB).toHaveLength(1)
    expect(resultB[0]?.id).toBe('e1')
  })

  it('getEngagementOpponent retourne l\'id ennemi (depuis sideA)', () => {
    expect(getEngagementOpponent(e1, 'A')).toBe('B')
  })

  it('getEngagementOpponent retourne l\'id ennemi (depuis sideB)', () => {
    expect(getEngagementOpponent(e1, 'B')).toBe('A')
  })

  it('getEngagementOpponent retourne null si unité absente', () => {
    expect(getEngagementOpponent(e1, 'Z')).toBeNull()
  })
})

// -------------------- Constantes --------------------

describe('engine/engagement — constantes plan figé', () => {
  it('RESERVE_RELIEF_RATE === 0.1 (10 % par tour acté plan § 11.2)', () => {
    expect(RESERVE_RELIEF_RATE).toBe(0.1)
  })

  it('BREAK_COMBAT_COST_RATIO === 0.1 (10 % acté plan § 11.3)', () => {
    expect(BREAK_COMBAT_COST_RATIO).toBe(0.1)
  })

  it('ENGAGEMENT_MORALE_DELTA_PER_TURN === -1 (Phase 3.2-bis : abaissé de -2 pour fatigue plus douce)', () => {
    expect(ENGAGEMENT_MORALE_DELTA_PER_TURN).toBe(-1)
  })
})
