// v1.0 (10/05/2026) — Phase 2 2A.3 : tests split / merge
// Cible : 8+ tests (PLAN-PHASE-2-COMBAT-V2.md § 2A.3 + 2A.11)

import { describe, it, expect } from 'vitest'
import { cube, neighbor } from '../hex'
import { splitUnit, mergeUnits, isSizingError, type SplitRatio } from './sizing'
import type { UnitState } from './types'

function makeUnit(overrides: Partial<UnitState> = {}): UnitState {
  return {
    id: 'u',
    kind: 'I',
    team: 'blue',
    position: cube(0, 0, 0),
    hp: 100,
    hpMax: 100,
    wounded: 0,
    morale: 100,
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

describe('engine/units/sizing — splitUnit', () => {
  it('split 800 en 50-50 → 400 + 400', () => {
    const source = makeUnit({ effective: 800 })
    const target = neighbor(source.position, 0)
    const result = splitUnit({ source, ratio: 'half', targetPosition: target, newUnitId: 'u2' })
    expect(isSizingError(result)).toBe(false)
    if (isSizingError(result)) return
    expect(result.left.effective).toBe(400)
    expect(result.right.effective).toBe(400)
    expect(result.left.id).toBe('u')
    expect(result.right.id).toBe('u2')
    expect(result.right.position).toEqual(target)
  })

  it('split 800 en 75-25 → 600 + 200', () => {
    const source = makeUnit({ effective: 800 })
    const target = neighbor(source.position, 1)
    const result = splitUnit({ source, ratio: 'three_quarter', targetPosition: target, newUnitId: 'u2' })
    expect(isSizingError(result)).toBe(false)
    if (isSizingError(result)) return
    expect(result.left.effective).toBe(600)
    expect(result.right.effective).toBe(200)
  })

  it('split 800 en 90-10 → 720 + 80 refuse car right < effectiveMin (100)', () => {
    const source = makeUnit({ effective: 800 })
    const target = neighbor(source.position, 2)
    const result = splitUnit({ source, ratio: 'nine_one', targetPosition: target, newUnitId: 'u2' })
    expect(isSizingError(result)).toBe(true)
    if (!isSizingError(result)) return
    expect(result.code).toBe('effective_too_low')
  })

  it('split refuse si effective < 2 * effectiveMin', () => {
    // I : effectiveMin = 100, donc 199 < 200 → refus
    const source = makeUnit({ effective: 199 })
    const target = neighbor(source.position, 0)
    const result = splitUnit({ source, ratio: 'half', targetPosition: target, newUnitId: 'u2' })
    expect(isSizingError(result)).toBe(true)
    if (!isSizingError(result)) return
    expect(result.code).toBe('effective_too_low')
  })

  it('split refuse si target non adjacent', () => {
    const source = makeUnit({ effective: 800 })
    // distance 2
    const result = splitUnit({ source, ratio: 'half', targetPosition: cube(2, 0, -2), newUnitId: 'u2' })
    expect(isSizingError(result)).toBe(true)
    if (!isSizingError(result)) return
    expect(result.code).toBe('target_not_adjacent')
  })

  it('split refuse si pion deja attaque ce tour', () => {
    const source = makeUnit({ effective: 800, hasAttacked: true })
    const target = neighbor(source.position, 0)
    const result = splitUnit({ source, ratio: 'half', targetPosition: target, newUnitId: 'u2' })
    expect(isSizingError(result)).toBe(true)
    if (!isSizingError(result)) return
    expect(result.code).toBe('has_attacked_already')
  })

  it('split marque les 2 pions hasMoved + hasAttacked (1 tour d inactivite offensive)', () => {
    const source = makeUnit({ effective: 800 })
    const target = neighbor(source.position, 0)
    const result = splitUnit({ source, ratio: 'half', targetPosition: target, newUnitId: 'u2' })
    if (isSizingError(result)) throw new Error('unexpected error')
    expect(result.left.hasMoved).toBe(true)
    expect(result.left.hasAttacked).toBe(true)
    expect(result.right.hasMoved).toBe(true)
    expect(result.right.hasAttacked).toBe(true)
  })

  it('split preserve wounded et killed proportionnellement', () => {
    const source = makeUnit({ effective: 800, wounded: 100, killed: 200 })
    const target = neighbor(source.position, 0)
    const result = splitUnit({ source, ratio: 'half', targetPosition: target, newUnitId: 'u2' })
    if (isSizingError(result)) throw new Error('unexpected error')
    expect(result.left.wounded + result.right.wounded).toBe(100)
    expect(result.left.killed + result.right.killed).toBe(200)
    expect(result.left.wounded).toBe(50)
    expect(result.right.wounded).toBe(50)
  })

  it('split d un pion fusionne (effectiveMax 1600) ramene effectiveMax au standard du type', () => {
    const source = makeUnit({ effective: 1200, effectiveMax: 1600, effectiveMin: 200 })
    const target = neighbor(source.position, 0)
    const result = splitUnit({ source, ratio: 'half', targetPosition: target, newUnitId: 'u2' })
    if (isSizingError(result)) throw new Error('unexpected error')
    // I : effectiveMax standard = 800, effectiveMin = 100
    expect(result.left.effectiveMax).toBe(800)
    expect(result.right.effectiveMax).toBe(800)
    expect(result.left.effectiveMin).toBe(100)
    expect(result.right.effectiveMin).toBe(100)
  })
})

describe('engine/units/sizing — mergeUnits', () => {
  it('merge 600 + 700 → 1300 (effectiveMax fusionne 1600)', () => {
    const target = makeUnit({ id: 'a', effective: 600, position: cube(0, 0, 0) })
    const source = makeUnit({ id: 'b', effective: 700, position: cube(1, 0, -1) })
    const result = mergeUnits({ target, source })
    expect(isSizingError(result)).toBe(false)
    if (isSizingError(result)) return
    expect(result.effective).toBe(1300)
    expect(result.effectiveMax).toBe(1600)
    expect(result.id).toBe('a')
  })

  // v1.1 — effectiveMin ne cumule plus (sinon retraite dissout les pions fusionnés très tôt)
  it('merge garde effectiveMin standard du type (pas de cumul)', () => {
    const target = makeUnit({ id: 'a', effective: 800, position: cube(0, 0, 0) })
    const source = makeUnit({ id: 'b', effective: 800, position: cube(1, 0, -1) })
    const result = mergeUnits({ target, source })
    if (isSizingError(result)) throw new Error('unexpected error')
    // I : effectiveMin = 100. Cumul (200) abandonné v1.1.
    expect(result.effectiveMin).toBe(100)
    expect(result.effectiveMax).toBe(1600) // cumul OK
  })

  it('merge refuse si total > effectiveMax fusionne', () => {
    // 2 pions de 800 + 800 + 1 = 1601 > 1600
    const target = makeUnit({ id: 'a', effective: 800, position: cube(0, 0, 0) })
    const source = makeUnit({ id: 'b', effective: 801, position: cube(1, 0, -1) })
    // forcer effectiveMax à 800 sur les 2 (ce qui devrait normalement etre la regle)
    const result = mergeUnits({ target, source })
    expect(isSizingError(result)).toBe(true)
    if (!isSizingError(result)) return
    expect(result.code).toBe('effective_overflow')
  })

  it('merge refuse si types differents', () => {
    const target = makeUnit({ id: 'a', kind: 'I', position: cube(0, 0, 0) })
    const source = makeUnit({ id: 'b', kind: 'C', position: cube(1, 0, -1), effective: 100 })
    const result = mergeUnits({ target, source })
    expect(isSizingError(result)).toBe(true)
    if (!isSizingError(result)) return
    expect(result.code).toBe('kind_mismatch')
  })

  it('merge refuse si teams differentes', () => {
    const target = makeUnit({ id: 'a', team: 'blue', effective: 400, position: cube(0, 0, 0) })
    const source = makeUnit({ id: 'b', team: 'red', effective: 400, position: cube(1, 0, -1) })
    const result = mergeUnits({ target, source })
    expect(isSizingError(result)).toBe(true)
    if (!isSizingError(result)) return
    expect(result.code).toBe('team_mismatch')
  })

  it('merge refuse si pions non adjacents', () => {
    const target = makeUnit({ id: 'a', effective: 400, position: cube(0, 0, 0) })
    const source = makeUnit({ id: 'b', effective: 400, position: cube(2, 0, -2) })
    const result = mergeUnits({ target, source })
    expect(isSizingError(result)).toBe(true)
    if (!isSizingError(result)) return
    expect(result.code).toBe('units_not_adjacent')
  })

  it('merge refuse si l un des pions a deja attaque ce tour', () => {
    const target = makeUnit({ id: 'a', effective: 400, position: cube(0, 0, 0), hasAttacked: true })
    const source = makeUnit({ id: 'b', effective: 400, position: cube(1, 0, -1) })
    const result = mergeUnits({ target, source })
    expect(isSizingError(result)).toBe(true)
    if (!isSizingError(result)) return
    expect(result.code).toBe('has_attacked_already')
  })

  it('merge marque le pion resultant hasMoved + hasAttacked', () => {
    const target = makeUnit({ id: 'a', effective: 400, position: cube(0, 0, 0) })
    const source = makeUnit({ id: 'b', effective: 400, position: cube(1, 0, -1) })
    const result = mergeUnits({ target, source })
    if (isSizingError(result)) throw new Error('unexpected error')
    expect(result.hasMoved).toBe(true)
    expect(result.hasAttacked).toBe(true)
  })

  it('merge somme wounded et killed', () => {
    const target = makeUnit({ id: 'a', effective: 400, wounded: 50, killed: 100, position: cube(0, 0, 0) })
    const source = makeUnit({ id: 'b', effective: 400, wounded: 30, killed: 80, position: cube(1, 0, -1) })
    const result = mergeUnits({ target, source })
    if (isSizingError(result)) throw new Error('unexpected error')
    expect(result.wounded).toBe(80)
    expect(result.killed).toBe(180)
  })

  it('merge calcule morale ponderee + bonus regroupement (cap moraleMax)', () => {
    const target = makeUnit({ id: 'a', effective: 800, morale: 100, position: cube(0, 0, 0) })
    const source = makeUnit({ id: 'b', effective: 200, morale: 50, position: cube(1, 0, -1) })
    const result = mergeUnits({ target, source })
    if (isSizingError(result)) throw new Error('unexpected error')
    // Moyenne pondérée : (100*800 + 50*200) / 1000 = 90, + bonus 25 = 115 → cap à 100.
    expect(result.morale).toBe(100)
  })

  // v1.1 — bonus regroupement permet à 2 pions Brisés de sortir de la déroute
  it('merge applique bonus +25 : 2 pions à moral 0 → moral 25, non routés', () => {
    const target = makeUnit({ id: 'a', effective: 800, morale: 0, routed: true, position: cube(0, 0, 0) })
    const source = makeUnit({ id: 'b', effective: 800, morale: 0, routed: true, position: cube(1, 0, -1) })
    const result = mergeUnits({ target, source })
    if (isSizingError(result)) throw new Error('unexpected error')
    expect(result.morale).toBe(25)
    // MORALE_ROUT_THRESHOLD = 25 → < 25 routed → exact 25 = non routed
    expect(result.routed).toBe(false)
  })

  it('merge refuse si subKind different (ex: archer vs artillery_heavy)', () => {
    const target = makeUnit({ id: 'a', kind: 'A', subKind: 'archer', effective: 60, effectiveMax: 120, effectiveMin: 30, position: cube(0, 0, 0) })
    const source = makeUnit({ id: 'b', kind: 'A', subKind: 'artillery_heavy', effective: 60, effectiveMax: 120, effectiveMin: 30, position: cube(1, 0, -1) })
    const result = mergeUnits({ target, source })
    expect(isSizingError(result)).toBe(true)
    if (!isSizingError(result)) return
    expect(result.code).toBe('kind_mismatch')
  })
})

describe('engine/units/sizing — ratio tests', () => {
  const ratios: SplitRatio[] = ['half', 'three_quarter', 'nine_one']
  it.each(ratios)('chaque ratio retourne effective total = source.effective', ratio => {
    // effective haut pour passer le check effectiveMin sur tous les ratios (sauf nine_one qui peut echouer)
    const source = makeUnit({ effective: 1200, effectiveMax: 1600, effectiveMin: 100 })
    const target = neighbor(source.position, 0)
    const result = splitUnit({ source, ratio, targetPosition: target, newUnitId: 'u2' })
    if (isSizingError(result)) {
      // nine_one sur 1200 → 1080 / 120, OK, pas d erreur attendue
      throw new Error(`unexpected error for ${ratio}: ${result.message}`)
    }
    expect(result.left.effective + result.right.effective).toBe(1200)
  })
})
