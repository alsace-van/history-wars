// v1.0 (12/05/2026) — Phase 3.1-A : tests fog of war évolué (12 cas)
// Cible : 12 tests
import { describe, it, expect } from 'vitest'
import { cube, cubeKey, spiral } from '../hex'
import type { UnitState } from '../units'
import { visibleHexesFromUnit, visibleHexesFromTeam, visibleEnemiesFromTeam } from './visibility'

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

/** Helper : board carré assez large pour ne pas filtrer accidentellement. */
function bigBoardKeys(radius = 10): Set<string> {
  return new Set(spiral(cube(0, 0, 0), radius).map(cubeKey))
}

const BOARD = bigBoardKeys()

describe('engine/vision', () => {
  it('1. Infanterie vision 3 : ennemi adjacent → identified (dist 1 ≤ vision/2 = 1)', () => {
    const blue = makeUnit({ id: 'b', kind: 'I', team: 'blue', position: cube(0, 0, 0) })
    const red = makeUnit({ id: 'r', kind: 'I', team: 'red', position: cube(1, 0, -1) })
    const m = visibleEnemiesFromTeam('blue', [blue, red], BOARD)
    expect(m.get('r')).toBe('identified')
  })

  it('2. Infanterie vision 3 : ennemi à distance 5 → hidden (hors range)', () => {
    const blue = makeUnit({ id: 'b', kind: 'I', team: 'blue', position: cube(0, 0, 0) })
    const red = makeUnit({ id: 'r', kind: 'I', team: 'red', position: cube(5, 0, -5) })
    const m = visibleEnemiesFromTeam('blue', [blue, red], BOARD)
    expect(m.has('r')).toBe(false)
  })

  it('3. Cavalerie vision 5 : ennemi à distance 5 → spotted (dist > vision/2 = 2)', () => {
    const blue = makeUnit({ id: 'b', kind: 'C', team: 'blue', position: cube(0, 0, 0) })
    const red = makeUnit({ id: 'r', kind: 'I', team: 'red', position: cube(5, 0, -5) })
    const m = visibleEnemiesFromTeam('blue', [blue, red], BOARD)
    expect(m.get('r')).toBe('spotted')
  })

  it('4. Allié sur la ligne masque l\'ennemi (piège #15, LoS team-agnostic)', () => {
    // L'allié est routed (exclu de la liste d'observateurs) mais reste un blocker physique.
    // Ainsi seul `observer` peut tenter de voir, et sa ligne passe à travers `ally` → bloqué.
    const observer = makeUnit({ id: 'obs', kind: 'C', team: 'blue', position: cube(0, 0, 0) })
    const ally = makeUnit({ id: 'ally', kind: 'I', team: 'blue', position: cube(2, 0, -2), routed: true })
    const red = makeUnit({ id: 'r', kind: 'I', team: 'red', position: cube(4, 0, -4) })
    const m = visibleEnemiesFromTeam('blue', [observer, ally, red], BOARD)
    expect(m.has('r')).toBe(false)
  })

  it('5. Ennemi sur la ligne masque l\'ennemi derrière', () => {
    const observer = makeUnit({ id: 'obs', kind: 'C', team: 'blue', position: cube(0, 0, 0) })
    const r1 = makeUnit({ id: 'r1', kind: 'I', team: 'red', position: cube(2, 0, -2) })
    const r2 = makeUnit({ id: 'r2', kind: 'I', team: 'red', position: cube(4, 0, -4) })
    const m = visibleEnemiesFromTeam('blue', [observer, r1, r2], BOARD)
    // r1 reste visible (rien sur la ligne 0,0,0 → 2,0,-2) ; dist 2 ≤ floor(5/2)=2 → identified
    expect(m.get('r1')).toBe('identified')
    expect(m.has('r2')).toBe(false)
  })

  it('6. 2 observateurs : l\'un sans LoS, l\'autre avec → ennemi visible', () => {
    // obs1 (0,0,0) C : voit (4,0,-4) directement
    // obs2 (5,-2,-3) C : voit (4,0,-4) sans blocker — angle différent
    // un allié sur (2,0,-2) bloque obs1, mais obs2 garde la vue
    const obs1 = makeUnit({ id: 'o1', kind: 'C', team: 'blue', position: cube(0, 0, 0) })
    const obs2 = makeUnit({ id: 'o2', kind: 'C', team: 'blue', position: cube(4, -2, -2) })
    const blockerAlly = makeUnit({ id: 'wall', kind: 'I', team: 'blue', position: cube(2, 0, -2) })
    const red = makeUnit({ id: 'r', kind: 'I', team: 'red', position: cube(4, 0, -4) })
    const m = visibleEnemiesFromTeam('blue', [obs1, obs2, blockerAlly, red], BOARD)
    expect(m.has('r')).toBe(true)
  })

  it('7. Meilleur niveau gagne (identified > spotted)', () => {
    // obs1 cav vision 5 → ennemi à dist 5 → spotted
    // obs2 inf vision 3 → ennemi à dist 1 → identified (dist 1 ≤ floor(3/2)=1)
    const obs1 = makeUnit({ id: 'far', kind: 'C', team: 'blue', position: cube(0, 0, 0) })
    const obs2 = makeUnit({ id: 'near', kind: 'I', team: 'blue', position: cube(4, 0, -4) })
    const red = makeUnit({ id: 'r', kind: 'I', team: 'red', position: cube(5, 0, -5) })
    const m = visibleEnemiesFromTeam('blue', [obs1, obs2, red], BOARD)
    expect(m.get('r')).toBe('identified')
  })

  it('8. Observateur routed exclu : aucun ennemi vu si tous les observateurs en déroute', () => {
    const blue = makeUnit({ id: 'b', kind: 'C', team: 'blue', position: cube(0, 0, 0), routed: true })
    const red = makeUnit({ id: 'r', kind: 'I', team: 'red', position: cube(2, 0, -2) })
    const m = visibleEnemiesFromTeam('blue', [blue, red], BOARD)
    expect(m.has('r')).toBe(false)
    // visibleHexesFromTeam doit également exclure l'unité routed
    const hexes = visibleHexesFromTeam('blue', [blue, red], BOARD)
    expect(hexes.size).toBe(0)
  })

  it('9. visibleHexesFromTeam = union des couvertures individuelles', () => {
    // Deux Infanteries vision 3 espacées de 8 hex : aucun chevauchement de couverture.
    const obs1 = makeUnit({ id: 'o1', kind: 'I', team: 'blue', position: cube(0, 0, 0) })
    const obs2 = makeUnit({ id: 'o2', kind: 'I', team: 'blue', position: cube(8, 0, -8) })
    const cover1 = visibleHexesFromUnit(obs1, [obs1, obs2], BOARD)
    const cover2 = visibleHexesFromUnit(obs2, [obs1, obs2], BOARD)
    const union = visibleHexesFromTeam('blue', [obs1, obs2], BOARD)
    // L'union contient au minimum chaque couverture individuelle (cas le plus fort).
    for (const k of cover1) expect(union.has(k)).toBe(true)
    for (const k of cover2) expect(union.has(k)).toBe(true)
    // Taille de l'union = somme - overlap (ici 0 puisque vision 3 + 3 < distance 8).
    expect(union.size).toBe(cover1.size + cover2.size)
  })

  it('10. Hex hors boardKeys est exclu de visibleHexesFromUnit', () => {
    const blue = makeUnit({ id: 'b', kind: 'C', team: 'blue', position: cube(0, 0, 0) })
    const smallBoard = new Set([cubeKey(cube(0, 0, 0)), cubeKey(cube(1, 0, -1))])
    const hexes = visibleHexesFromUnit(blue, [blue], smallBoard)
    // Aucun hex en dehors du smallBoard ne doit apparaître
    expect(hexes.has(cubeKey(cube(1, 0, -1)))).toBe(true)
    expect(hexes.has(cubeKey(cube(2, 0, -2)))).toBe(false)
    expect(hexes.has(cubeKey(cube(3, 0, -3)))).toBe(false)
  })

  it('11. Ennemi adjacent (dist 1) toujours identified, quelle que soit la vision', () => {
    // vision min I=3 → floor(3/2)=1 → dist 1 toujours identified
    const blue = makeUnit({ id: 'b', kind: 'I', team: 'blue', position: cube(0, 0, 0) })
    const red = makeUnit({ id: 'r', kind: 'I', team: 'red', position: cube(0, 1, -1) })
    const m = visibleEnemiesFromTeam('blue', [blue, red], BOARD)
    expect(m.get('r')).toBe('identified')
  })

  it('12. Aucun observateur → Map et Set vides (no crash)', () => {
    const red = makeUnit({ id: 'r', kind: 'I', team: 'red', position: cube(2, 0, -2) })
    const m = visibleEnemiesFromTeam('blue', [red], BOARD)
    const hexes = visibleHexesFromTeam('blue', [red], BOARD)
    expect(m.size).toBe(0)
    expect(hexes.size).toBe(0)
  })
})
