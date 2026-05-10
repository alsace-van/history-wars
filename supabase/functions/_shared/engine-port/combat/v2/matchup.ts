// v1.0 (10/05/2026) — Phase 2 2C.1 : port combat/v2/matchup pour Deno
// Source de verite : src/engine/combat/v2/matchup.ts. Duplication controlee (piege #12).

import type { UnitKind } from '../../../types.ts'
import type { AttackPhase, CombatConfig } from './types.ts'
import { DEFAULT_COMBAT_CONFIG } from './types.ts'

export function getMatchupCoef(
  attackerKind: UnitKind,
  defenderKind: UnitKind,
  phase: AttackPhase,
  config: CombatConfig = DEFAULT_COMBAT_CONFIG,
): number {
  return config.matchupMatrix[phase][attackerKind][defenderKind]
}

export function describeMatchup(attackerKind: UnitKind, defenderKind: UnitKind): string {
  const labels: Record<UnitKind, string> = { I: 'Inf', C: 'Cav', A: 'Art' }
  return `Type (${labels[attackerKind]} vs ${labels[defenderKind]})`
}
