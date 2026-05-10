// v1.0 (10/05/2026) — Phase 2 2A.5 : matrices matchup par phase d'attaque
// Source : PLAN-PHASE-2-COMBAT-V2.md § 2A.5

import type { UnitKind } from '../../../types/game'
import type { AttackPhase, CombatConfig } from './types'
import { DEFAULT_COMBAT_CONFIG } from './types'

/**
 * Coef matchup attacker → defender pour une phase donnee.
 *
 * Conventions :
 *  - 1.0           = neutre
 *  - 0.5 → 0.9     = desavantage (du leger au gros)
 *  - 1.1 → 2.0     = avantage (du leger au gros)
 *
 * Calibrage par defaut (cf. brainstorm 09-10/05/2026 § 3.5) :
 *  - melee.C-vs-A = 1.5 (cav massacre artillerie au contact)
 *  - charge.C-vs-I = 1.5 (cav charge inf est decisif)
 *  - ranged.A-vs-A = 1.5 (contre-batterie efficace)
 *  - melee.A-vs-* = 0.5 (artillerie inutile au contact)
 *
 * En production : surcharge via combat_config (BDD migration 014, JSONB editable).
 */
export function getMatchupCoef(
  attackerKind: UnitKind,
  defenderKind: UnitKind,
  phase: AttackPhase,
  config: CombatConfig = DEFAULT_COMBAT_CONFIG,
): number {
  const matrix = config.matchupMatrix[phase]
  return matrix[attackerKind][defenderKind]
}

/**
 * Etiquette lisible pour le breakdown UI.
 *  Ex: "Type (Cav vs Inf)"
 */
export function describeMatchup(
  attackerKind: UnitKind,
  defenderKind: UnitKind,
): string {
  const labels: Record<UnitKind, string> = { I: 'Inf', C: 'Cav', A: 'Art' }
  return `Type (${labels[attackerKind]} vs ${labels[defenderKind]})`
}
