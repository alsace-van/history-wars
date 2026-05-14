// v1.0 (13/05/2026) — Phase 3.2 Vague A : tests évaluation ordres conditionnels
// Cible : 18+ tests (PLAN-PHASE-3-2 Vague A)

import { describe, expect, it } from 'vitest'
import { cube, cubeKey, spiral } from '../hex'
import type { CohesionState } from '../cohesion'
import type { UnitState } from '../units'
import { evaluateOrders } from './evaluate'
import { evaluateTrigger, isCohesionBroken, isEnemyInRange, isEnemyLos, isOnAttacked } from './triggers'
import { pickChargeTarget, pickFireTarget, pickRetreatHex } from './actions'
import type { EvaluateOrdersContext, Posture } from './types'

function makeUnit(overrides: Partial<UnitState> & { id: string }): UnitState {
  return {
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
    effective: 400,
    effectiveMax: 800,
    effectiveMin: 100,
    killed: 0,
    ...overrides,
  }
}

function bigBoard(radius = 8): Set<string> {
  return new Set(spiral(cube(0, 0, 0), radius).map(cubeKey))
}

function makePosture(overrides: Partial<Posture> & { id: string; unitId: string }): Posture {
  return {
    priority: 1,
    active: true,
    trigger: { kind: 'on_attacked' },
    action: { kind: 'hold' },
    ...overrides,
  }
}

function buildCtx(units: UnitState[], opts: {
  engaged?: string[]
  visible?: string[]
  cohesion?: Record<string, CohesionState>
  boardRadius?: number
} = {}): EvaluateOrdersContext {
  const board = bigBoard(opts.boardRadius ?? 8)
  return {
    allUnits: units,
    engagedUnitIds: new Set(opts.engaged ?? []),
    visibleEnemyIds: new Set(opts.visible ?? []),
    visibleTileKeys: board,
    cohesionByUnit: new Map(Object.entries(opts.cohesion ?? {})),
  }
}

describe('engine/orders — triggers', () => {
  it('1. isOnAttacked = true si unitId dans engagedUnitIds', () => {
    const u = makeUnit({ id: 'u' })
    const ctx = buildCtx([u], { engaged: ['u'] })
    expect(isOnAttacked(u, ctx)).toBe(true)
  })

  it('2. isOnAttacked = false si pas engagé', () => {
    const u = makeUnit({ id: 'u' })
    const ctx = buildCtx([u])
    expect(isOnAttacked(u, ctx)).toBe(false)
  })

  it('3. isEnemyInRange = true si ennemi visible à distance ≤ range', () => {
    const u = makeUnit({ id: 'u', team: 'blue', position: cube(0, 0, 0) })
    const e = makeUnit({ id: 'e', team: 'red', position: cube(2, 0, -2) })
    const ctx = buildCtx([u, e], { visible: ['e'] })
    expect(isEnemyInRange(u, { kind: 'enemy_in_range', params: { range: 3 } }, ctx)).toBe(true)
  })

  it('4. isEnemyInRange = false si ennemi hidden (fog Phase 3.1)', () => {
    const u = makeUnit({ id: 'u', team: 'blue', position: cube(0, 0, 0) })
    const e = makeUnit({ id: 'e', team: 'red', position: cube(2, 0, -2) })
    const ctx = buildCtx([u, e], { visible: [] })
    expect(isEnemyInRange(u, { kind: 'enemy_in_range', params: { range: 3 } }, ctx)).toBe(false)
  })

  it('5. isCohesionBroken = true si état broken dans la map', () => {
    const u = makeUnit({ id: 'u' })
    const ctx = buildCtx([u], { cohesion: { u: 'broken' } })
    expect(isCohesionBroken(u, ctx)).toBe(true)
  })

  it('6. isCohesionBroken = false si état nominal ou shaken', () => {
    const u = makeUnit({ id: 'u' })
    expect(isCohesionBroken(u, buildCtx([u], { cohesion: { u: 'nominal' } }))).toBe(false)
    expect(isCohesionBroken(u, buildCtx([u], { cohesion: { u: 'shaken' } }))).toBe(false)
  })

  it('7. isEnemyLos = true si au moins 1 ennemi visible', () => {
    const u = makeUnit({ id: 'u', team: 'blue' })
    const e = makeUnit({ id: 'e', team: 'red', position: cube(3, 0, -3) })
    const ctx = buildCtx([u, e], { visible: ['e'] })
    expect(isEnemyLos(u, ctx)).toBe(true)
  })

  it('8. isEnemyLos = false si aucun ennemi visible', () => {
    const u = makeUnit({ id: 'u', team: 'blue' })
    const e = makeUnit({ id: 'e', team: 'red', position: cube(3, 0, -3) })
    const ctx = buildCtx([u, e], { visible: [] })
    expect(isEnemyLos(u, ctx)).toBe(false)
  })

  it('9. evaluateTrigger dispatcher route vers les bons prédicats', () => {
    const u = makeUnit({ id: 'u' })
    const ctx = buildCtx([u], { engaged: ['u'], cohesion: { u: 'broken' } })
    expect(evaluateTrigger(u, { kind: 'on_attacked' }, ctx)).toBe(true)
    expect(evaluateTrigger(u, { kind: 'cohesion_broken' }, ctx)).toBe(true)
  })
})

describe('engine/orders — actions (pick*)', () => {
  it('10. pickChargeTarget choisit l\'ennemi adjacent', () => {
    const u = makeUnit({ id: 'u', team: 'blue', position: cube(0, 0, 0) })
    const e = makeUnit({ id: 'e', team: 'red', position: cube(1, 0, -1), effective: 300 })
    const ctx = buildCtx([u, e], { visible: ['e'] })
    const result = pickChargeTarget(u, ctx)
    expect(result.targetUnitId).toBe('e')
    expect(result.destHex).toEqual(u.position)
  })

  it('11a. pickFireTarget Infanterie (range=1) à 3 hex → null (hors portée)', () => {
    const u = makeUnit({ id: 'u', kind: 'I', position: cube(0, 0, 0) })
    const e = makeUnit({ id: 'e', team: 'red', position: cube(3, 0, -3) })
    const ctx = buildCtx([u, e], { visible: ['e'] })
    expect(pickFireTarget(u, ctx).targetUnitId).toBeNull()
  })

  it('11b. pickFireTarget Infanterie (range=1) adjacent → cible (Phase 3.3 mode alerte)', () => {
    const u = makeUnit({ id: 'u', kind: 'I', position: cube(0, 0, 0) })
    const e = makeUnit({ id: 'e', team: 'red', position: cube(1, 0, -1) })
    const ctx = buildCtx([u, e], { visible: ['e'] })
    expect(pickFireTarget(u, ctx).targetUnitId).toBe('e')
  })

  it('12. pickFireTarget pour Artillerie (range 6) trouve l\'ennemi à 3 hex', () => {
    const u = makeUnit({ id: 'u', kind: 'A', team: 'blue', position: cube(0, 0, 0) })
    const e = makeUnit({ id: 'e', team: 'red', position: cube(3, 0, -3) })
    const ctx = buildCtx([u, e], { visible: ['e'] })
    expect(pickFireTarget(u, ctx).targetUnitId).toBe('e')
  })

  it('13. pickRetreatHex retourne null si encerclement total (tous voisins occupés)', () => {
    const u = makeUnit({ id: 'u', team: 'blue', position: cube(0, 0, 0) })
    // Encercler avec 6 ennemis adjacents
    const enemies = [
      makeUnit({ id: 'e1', team: 'red', position: cube(1, 0, -1) }),
      makeUnit({ id: 'e2', team: 'red', position: cube(1, -1, 0) }),
      makeUnit({ id: 'e3', team: 'red', position: cube(0, -1, 1) }),
      makeUnit({ id: 'e4', team: 'red', position: cube(-1, 0, 1) }),
      makeUnit({ id: 'e5', team: 'red', position: cube(-1, 1, 0) }),
      makeUnit({ id: 'e6', team: 'red', position: cube(0, 1, -1) }),
    ]
    const ctx = buildCtx([u, ...enemies], { visible: enemies.map(e => e.id) })
    expect(pickRetreatHex(u, ctx).destHex).toBeNull()
  })
})

describe('engine/orders — evaluateOrders', () => {
  it('14. Priorité : ordre prio 1 gagne sur prio 2 quand les 2 triggers vrais', () => {
    const u = makeUnit({ id: 'u' })
    const ctx = buildCtx([u], { engaged: ['u'], cohesion: { u: 'broken' } })
    const p1 = makePosture({ id: 'p1', unitId: 'u', priority: 1, trigger: { kind: 'on_attacked' }, action: { kind: 'hold' } })
    const p2 = makePosture({ id: 'p2', unitId: 'u', priority: 2, trigger: { kind: 'cohesion_broken' }, action: { kind: 'retreat' } })
    const result = evaluateOrders(u, [p1, p2], ctx)
    expect(result?.posture.id).toBe('p1')
    expect(result?.resolvedAction).toBe('hold')
  })

  it('15. Brisée bloque charge → skipped=broken, on cherche posture suivante exécutable', () => {
    const u = makeUnit({ id: 'u', team: 'blue', position: cube(0, 0, 0) })
    const e = makeUnit({ id: 'e', team: 'red', position: cube(1, 0, -1) })
    const ctx = buildCtx([u, e], { visible: ['e'], cohesion: { u: 'broken' } })
    const p1 = makePosture({ id: 'p1', unitId: 'u', priority: 1, trigger: { kind: 'enemy_in_range', params: { range: 3 } }, action: { kind: 'charge' } })
    const p2 = makePosture({ id: 'p2', unitId: 'u', priority: 2, trigger: { kind: 'cohesion_broken' }, action: { kind: 'retreat' } })
    const result = evaluateOrders(u, [p1, p2], ctx)
    expect(result?.posture.id).toBe('p2')
    expect(result?.resolvedAction).toBe('retreat')
    expect(result?.skipped).toBeUndefined()
  })

  it('16. hasMoved bloque charge → skipped=has_moved, fallback hold', () => {
    const u = makeUnit({ id: 'u', team: 'blue', position: cube(0, 0, 0), hasMoved: true })
    const e = makeUnit({ id: 'e', team: 'red', position: cube(1, 0, -1) })
    const ctx = buildCtx([u, e], { visible: ['e'] })
    const p1 = makePosture({ id: 'p1', unitId: 'u', priority: 1, trigger: { kind: 'enemy_in_range', params: { range: 2 } }, action: { kind: 'charge' } })
    const p2 = makePosture({ id: 'p2', unitId: 'u', priority: 2, trigger: { kind: 'enemy_in_range', params: { range: 2 } }, action: { kind: 'hold' } })
    const result = evaluateOrders(u, [p1, p2], ctx)
    expect(result?.posture.id).toBe('p2')
    expect(result?.resolvedAction).toBe('hold')
  })

  it('17. Aucun trigger vrai → null', () => {
    const u = makeUnit({ id: 'u' })
    const ctx = buildCtx([u])
    const p1 = makePosture({ id: 'p1', unitId: 'u', priority: 1, trigger: { kind: 'on_attacked' }, action: { kind: 'retreat' } })
    expect(evaluateOrders(u, [p1], ctx)).toBeNull()
  })

  it('18. Unité routed → null d\'office (aucun ordre évalué)', () => {
    const u = makeUnit({ id: 'u', routed: true })
    const ctx = buildCtx([u], { engaged: ['u'] })
    const p1 = makePosture({ id: 'p1', unitId: 'u', priority: 1, trigger: { kind: 'on_attacked' }, action: { kind: 'hold' } })
    expect(evaluateOrders(u, [p1], ctx)).toBeNull()
  })

  it('19. Action retreat avec encerclement → skipped=no_target', () => {
    const u = makeUnit({ id: 'u', team: 'blue', position: cube(0, 0, 0) })
    const enemies = [
      makeUnit({ id: 'e1', team: 'red', position: cube(1, 0, -1) }),
      makeUnit({ id: 'e2', team: 'red', position: cube(1, -1, 0) }),
      makeUnit({ id: 'e3', team: 'red', position: cube(0, -1, 1) }),
      makeUnit({ id: 'e4', team: 'red', position: cube(-1, 0, 1) }),
      makeUnit({ id: 'e5', team: 'red', position: cube(-1, 1, 0) }),
      makeUnit({ id: 'e6', team: 'red', position: cube(0, 1, -1) }),
    ]
    const ctx = buildCtx([u, ...enemies], {
      visible: enemies.map(e => e.id),
      cohesion: { u: 'broken' },
    })
    const p1 = makePosture({ id: 'p1', unitId: 'u', priority: 1, trigger: { kind: 'cohesion_broken' }, action: { kind: 'retreat' } })
    const result = evaluateOrders(u, [p1], ctx)
    expect(result?.skipped).toBe('no_target')
  })

  it('20. Posture inactive ignorée même si trigger vrai', () => {
    const u = makeUnit({ id: 'u' })
    const ctx = buildCtx([u], { engaged: ['u'] })
    const p1 = makePosture({ id: 'p1', unitId: 'u', priority: 1, active: false, trigger: { kind: 'on_attacked' }, action: { kind: 'hold' } })
    expect(evaluateOrders(u, [p1], ctx)).toBeNull()
  })
})
