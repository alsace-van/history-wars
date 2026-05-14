// v1.0 (14/05/2026) — Phase 3.3 : tests AO/AC + ordinaux

import { describe, it, expect } from 'vitest'
import { computeOrdinalLabels, getKindCode } from './labels'

describe('engine/units/labels', () => {
  it('getKindCode mappe artillery_light/heavy en AO/AC, archer reste A', () => {
    expect(getKindCode('I')).toBe('I')
    expect(getKindCode('C')).toBe('C')
    expect(getKindCode('A')).toBe('A')
    expect(getKindCode('A', 'archer')).toBe('A')
    expect(getKindCode('A', 'artillery_light')).toBe('AO')
    expect(getKindCode('A', 'artillery_heavy')).toBe('AC')
  })

  it('computeOrdinalLabels compte AO et AC séparément', () => {
    const labels = computeOrdinalLabels([
      { id: 'u1', kind: 'A', team: 'blue', subKind: 'artillery_light' },
      { id: 'u2', kind: 'A', team: 'blue', subKind: 'artillery_heavy' },
      { id: 'u3', kind: 'A', team: 'blue', subKind: 'artillery_light' },
      { id: 'u4', kind: 'A', team: 'red', subKind: 'artillery_light' },
      { id: 'u5', kind: 'I', team: 'blue' },
    ])
    expect(labels.get('u1')).toBe('AO.1')
    expect(labels.get('u2')).toBe('AC.1')
    expect(labels.get('u3')).toBe('AO.2')
    expect(labels.get('u4')).toBe('AO.1') // team différente → compteur reset
    expect(labels.get('u5')).toBe('I.1')
  })
})
