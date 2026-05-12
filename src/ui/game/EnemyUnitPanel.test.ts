// v1.0 (12/05/2026) — QW2 : tests effectiveCategory (catégorisation publique effectif)
import { describe, it, expect } from 'vitest'
import { effectiveCategory } from './EnemyUnitPanel'

describe('effectiveCategory', () => {
  it('renvoie "< 100" pour les effectifs très faibles', () => {
    expect(effectiveCategory(0)).toBe('< 100')
    expect(effectiveCategory(1)).toBe('< 100')
    expect(effectiveCategory(99)).toBe('< 100')
  })

  it('renvoie "100 – 300" pour la bande inférieure', () => {
    expect(effectiveCategory(100)).toBe('100 – 300')
    expect(effectiveCategory(180)).toBe('100 – 300')
    expect(effectiveCategory(299)).toBe('100 – 300')
  })

  it('renvoie "300 – 600" pour la bande médiane', () => {
    expect(effectiveCategory(300)).toBe('300 – 600')
    expect(effectiveCategory(500)).toBe('300 – 600')
    expect(effectiveCategory(599)).toBe('300 – 600')
  })

  it('renvoie "600+" pour les pleins regiments d\'infanterie', () => {
    expect(effectiveCategory(600)).toBe('600+')
    expect(effectiveCategory(800)).toBe('600+')
    expect(effectiveCategory(5000)).toBe('600+')
  })
})
