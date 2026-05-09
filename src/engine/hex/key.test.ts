// v1.0 (08/05/2026) — Tests key
import { describe, it, expect } from 'vitest'
import { cubeKey, parseCubeKey } from './key'

describe('cubeKey', () => {
  it('format "q,r"', () => {
    expect(cubeKey({ q: 1, r: -2, s: 1 })).toBe('1,-2')
  })
  it('zero', () => {
    expect(cubeKey({ q: 0, r: 0, s: 0 })).toBe('0,0')
  })
})

describe('parseCubeKey', () => {
  it('parse standard', () => {
    expect(parseCubeKey('3,-1')).toEqual({ q: 3, r: -1, s: -2 })
  })
  it('reversibilite', () => {
    const c = { q: 7, r: -3, s: -4 }
    expect(parseCubeKey(cubeKey(c))).toEqual(c)
  })
  it('throw sur format invalide', () => {
    expect(() => parseCubeKey('abc')).toThrow()
    expect(() => parseCubeKey('1')).toThrow()
    expect(() => parseCubeKey('1,2,3')).toThrow()
  })
})
