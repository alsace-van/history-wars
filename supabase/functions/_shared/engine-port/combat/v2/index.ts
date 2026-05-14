// v1.2 (14/05/2026) — Phase 3.3 : propage attackerOnHold / defenderOnHold (mirror src v1.2)
// v1.1 (11/05/2026) — Phase 2.5 : propage attackerSupport / defenderSupport pour modulation moral
// v1.0 (10/05/2026) — Phase 2 2C.1 : barrel + dispatch resolveCombat pour Deno
// Source de verite : src/engine/combat/v2/index.ts. Duplication controlee (piege #12).

import type { SupportCount } from '../../cohesion/types.ts'
import type { Cube } from '../../hex/index.ts'
import type { TerrainType } from '../../terrain/types.ts'
import type { UnitState } from '../../units.ts'
import { resolveContact, type ContactInput } from './contact.ts'
import { isChargeApplicable, chargedDistance, chargeMultiplier } from './charge.ts'
import type { AttackPhase, CombatConfig, CombatResultV2 } from './types.ts'

export type { AttackPhase, BonusBreakdownEntry, CombatResultV2, CombatConfig } from './types.ts'
export { DEFAULT_COMBAT_CONFIG } from './types.ts'
export { getMatchupCoef, describeMatchup } from './matchup.ts'
export { distancePrecision } from './distance.ts'
export { isPathStraight, chargedDistance, chargeMultiplier, isChargeApplicable } from './charge.ts'
export type { ChargeContext } from './charge.ts'
export { resolveContact } from './contact.ts'
export type { ContactInput } from './contact.ts'
export { previewCombatV2 } from './preview.ts'
export type { PreviewInput, PreviewResultV2 } from './preview.ts'

export interface ResolveCombatInput {
  attacker: UnitState
  defender: UnitState
  attackerTerrain: TerrainType
  defenderTerrain: TerrainType
  distance: number
  attackerPath?: ReadonlyArray<Cube>
  attackerPathTerrain?: ReadonlyArray<TerrainType>
  rng: () => number
  config?: CombatConfig
  /** Phase 2.5 — module la perte moral attaquant en riposte. */
  attackerSupport?: SupportCount
  /** Phase 2.5 — module la perte moral défenseur à l'impact. */
  defenderSupport?: SupportCount
  /** Phase 3.3 — posture hold côté attaquant (devient défenseur en riposte). */
  attackerOnHold?: boolean
  /** Phase 3.3 — posture hold côté défenseur (impact principal). */
  defenderOnHold?: boolean
}

export interface ResolveCombatResult {
  result: CombatResultV2
  ripost: CombatResultV2 | null
}

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
    defenderOnHold: input.defenderOnHold,
  }
  const result = resolveContact(attackInput)

  let ripost: CombatResultV2 | null = null
  if (phase === 'melee' && result.defenderEffectiveAfter > 0 && !result.defenderRouted) {
    const defenderAfter: UnitState = {
      ...input.defender,
      effective: result.defenderEffectiveAfter,
      hp: result.defenderHpAfter,
      wounded: result.defenderWoundedAfter,
      morale: result.defenderMoraleAfter,
      routed: result.defenderRouted,
    }
    const ripostInput: ContactInput = {
      attacker: defenderAfter,
      defender: input.attacker,
      phase: 'melee',
      attackerTerrain: input.defenderTerrain,
      defenderTerrain: input.attackerTerrain,
      distance: input.distance,
      chargeMult: 1.0,
      rng: input.rng,
      config: input.config,
      // Phase 2.5 : en riposte, l'attaquant initial devient défenseur → son support
      defenderSupport: input.attackerSupport,
      // Phase 3.3 : en riposte, l'attaquant initial devient défenseur → sa posture hold
      defenderOnHold: input.attackerOnHold,
    }
    ripost = resolveContact(ripostInput)
  }

  return { result, ripost }
}

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
