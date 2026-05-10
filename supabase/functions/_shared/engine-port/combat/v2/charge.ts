// v1.0 (10/05/2026) — Phase 2 2C.1 : port combat/v2/charge pour Deno
// Source de verite : src/engine/combat/v2/charge.ts. Duplication controlee (piege #12).

import type { Cube } from '../../hex/index.ts'
import { isChargeAllowed } from '../../terrain/caps.ts'
import type { TerrainType } from '../../terrain/types.ts'
import type { UnitState } from '../../units.ts'
import type { CombatConfig } from './types.ts'
import { DEFAULT_COMBAT_CONFIG } from './types.ts'

function cubeDist(a: Cube, b: Cube): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2
}

export function isPathStraight(path: ReadonlyArray<Cube>): boolean {
  if (path.length < 3) return true
  const dir0 = {
    q: path[1].q - path[0].q,
    r: path[1].r - path[0].r,
    s: path[1].s - path[0].s,
  }
  for (let i = 2; i < path.length; i++) {
    const d = {
      q: path[i].q - path[i - 1].q,
      r: path[i].r - path[i - 1].r,
      s: path[i].s - path[i - 1].s,
    }
    if (d.q !== dir0.q || d.r !== dir0.r || d.s !== dir0.s) return false
  }
  return true
}

export function chargedDistance(path: ReadonlyArray<Cube>): number {
  return path.length === 0 ? 0 : path.length - 1
}

export function chargeMultiplier(distance: number, config: CombatConfig = DEFAULT_COMBAT_CONFIG): number {
  if (distance < 2) return 1.0
  if (distance === 2) return config.chargeMultipliers.two
  if (distance === 3) return config.chargeMultipliers.three
  return config.chargeMultipliers.fourPlus
}

export interface ChargeContext {
  attacker: UnitState
  defender: UnitState
  path: ReadonlyArray<Cube>
  pathTerrain: ReadonlyArray<TerrainType>
}

export function isChargeApplicable(ctx: ChargeContext): boolean {
  if (ctx.attacker.kind !== 'C') return false
  if (chargedDistance(ctx.path) < 2) return false
  if (!isPathStraight(ctx.path)) return false
  for (const terrain of ctx.pathTerrain) {
    if (!isChargeAllowed(terrain)) return false
  }
  const last = ctx.path[ctx.path.length - 1]
  if (!last) return false
  return cubeDist(last, ctx.defender.position) === 1
}
