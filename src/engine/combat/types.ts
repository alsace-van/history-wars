// v1.0 (09/05/2026) — Phase 1 L1A.3 : types combat
// Source : PLAN-PHASE-1.md § 2.2

export type AttackKind = 'melee' | 'ranged'

export interface CombatModifiers {
  readonly flanked: boolean
  readonly terrainDefBonus?: number  // Phase 3, defaut 0
}

/**
 * Resultat d'une resolution de combat.
 * Contient tout ce qu'il faut pour :
 *  - mettre a jour la BDD (defenderHpAfter, deltas morale)
 *  - afficher l'effet (defenderKilled, routed flags)
 *  - rejouer (rollUsed deterministe)
 */
export interface CombatResult {
  readonly damageDealt: number
  readonly defenderHpAfter: number
  readonly attackerMoraleDelta: number
  readonly defenderMoraleDelta: number
  readonly attackerMoraleAfter: number
  readonly defenderMoraleAfter: number
  readonly attackerRouted: boolean
  readonly defenderRouted: boolean
  readonly defenderKilled: boolean
  readonly rollUsed: number
}
