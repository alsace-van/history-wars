// v1.1 (11/05/2026) — Phase 2.5 : propage attackerSupport / defenderSupport pour modulation moral
// v1.0 (10/05/2026) — Phase 2 2A.9 : barrel + dispatch resolveCombat (attaque + riposte melee)
// Source : docs/PLAN-MORAL-COHESION.md § 2 + PLAN-PHASE-2-COMBAT-V2.md § 2A.9

import type { SupportCount } from '../../cohesion/types'
import type { Cube } from '../../hex'
import type { TerrainType } from '../../terrain/types'
import type { UnitState } from '../../units/types'
import { resolveContact } from './contact'
import type { ContactInput } from './contact'
import { isChargeApplicable, chargedDistance, chargeMultiplier } from './charge'
import type { AttackPhase, CombatConfig, CombatResultV2 } from './types'

export type { AttackPhase, BonusBreakdownEntry, CombatResultV2, CombatConfig } from './types'
export { DEFAULT_COMBAT_CONFIG } from './types'
export { getMatchupCoef, describeMatchup } from './matchup'
export { distancePrecision } from './distance'
export { isPathStraight, chargedDistance, chargeMultiplier, isChargeApplicable } from './charge'
export type { ChargeContext } from './charge'
export { resolveContact } from './contact'
export type { ContactInput } from './contact'
export { previewCombatV2 } from './preview'
export type { PreviewInput, PreviewResultV2 } from './preview'

export interface ResolveCombatInput {
  readonly attacker: UnitState
  readonly defender: UnitState
  readonly attackerTerrain: TerrainType
  readonly defenderTerrain: TerrainType
  readonly distance: number
  /** Trajectoire de l'attaquant ce tour (alimentee par EF move). Pour detection charge cav. */
  readonly attackerPath?: ReadonlyArray<Cube>
  /** Type de terrain pour chaque hex du path (longueur identique a attackerPath). */
  readonly attackerPathTerrain?: ReadonlyArray<TerrainType>
  readonly rng: () => number
  readonly config?: CombatConfig
  /**
   * Phase 2.5 — soutien tactique de l'attaquant et du défenseur.
   *  - Lors de l'impact principal : `defenderSupport` module la perte de moral du défenseur.
   *  - Lors de la riposte mêlée   : `attackerSupport` module la perte de moral de l'attaquant
   *    initial (qui devient défenseur de la riposte).
   * Si non fournis, aucun bonus appliqué (comportement Phase 2 d'origine).
   */
  readonly attackerSupport?: SupportCount
  readonly defenderSupport?: SupportCount
}

export interface ResolveCombatResult {
  /** Resultat principal (attaquant frappe defenseur). */
  readonly result: CombatResultV2
  /** Riposte du defenseur (uniquement en melee, null sinon). */
  readonly ripost: CombatResultV2 | null
}

/**
 * Dispatch principal de combat v2.
 *
 * Pipeline :
 *  1. Determine la phase :
 *     - distance > 1 → 'ranged'
 *     - sinon, si attacker.kind = C et path elligible → 'charge'
 *     - sinon → 'melee'
 *  2. Calcule chargeMult si phase = 'charge'.
 *  3. Resout l'impact attaquant.
 *  4. En melee uniquement : resout la riposte (defenseur frappe attaquant), si defenseur encore vivant.
 *
 * Pas de prise en charge embuscade / surprise (Phase 3).
 */
export function resolveCombat(input: ResolveCombatInput): ResolveCombatResult {
  const phase = detectPhase(input)
  const chargeMult = phase === 'charge'
    ? chargeMultiplier(chargedDistance(input.attackerPath ?? []), input.config)
    : 1.0

  const attackInput: ContactInput = {
    attacker: input.attacker,
    defender: input.defender,
    phase,
    attackerTerrain: input.attackerTerrain,
    defenderTerrain: input.defenderTerrain,
    distance: input.distance,
    chargeMult,
    rng: input.rng,
    config: input.config,
    defenderSupport: input.defenderSupport,
  }
  const result = resolveContact(attackInput)

  // Riposte : seulement en melee, et seulement si defenseur encore vivant apres impact
  let ripost: CombatResultV2 | null = null
  if (phase === 'melee' && result.defenderEffectiveAfter > 0 && !result.defenderRouted) {
    // On reconstruit un defenseur "post-impact" pour la riposte.
    const defenderAfter: UnitState = {
      ...input.defender,
      effective: result.defenderEffectiveAfter,
      hp: result.defenderHpAfter,
      wounded: result.defenderWoundedAfter,
      morale: result.defenderMoraleAfter,
      routed: result.defenderRouted,
    }
    const ripostInput: ContactInput = {
      attacker: defenderAfter,                     // riposte = defenseur frappe attaquant
      defender: input.attacker,
      phase: 'melee',
      attackerTerrain: input.defenderTerrain,
      defenderTerrain: input.attackerTerrain,
      distance: input.distance,
      chargeMult: 1.0,                              // pas de charge en riposte
      rng: input.rng,
      config: input.config,
      // Phase 2.5 : en riposte, l'attaquant initial est le défenseur → son support
      defenderSupport: input.attackerSupport,
    }
    ripost = resolveContact(ripostInput)
  }

  return { result, ripost }
}

/**
 * Determine la phase d'attaque selon les conditions actuelles.
 *  - distance > 1 → ranged (pas de charge a distance, et pas de melee non plus)
 *  - distance == 1 + cav + path elligible → charge
 *  - distance == 1 sinon → melee
 *  - distance == 0 → melee (cas limite)
 */
function detectPhase(input: ResolveCombatInput): AttackPhase {
  if (input.distance > 1) return 'ranged'
  if (input.attacker.kind === 'C' && input.attackerPath && input.attackerPathTerrain) {
    const eligible = isChargeApplicable({
      attacker: input.attacker,
      defender: input.defender,
      path: input.attackerPath,
      pathTerrain: input.attackerPathTerrain,
    })
    if (eligible) return 'charge'
  }
  return 'melee'
}
