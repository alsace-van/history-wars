// v1.1 (10/05/2026) — Phase 1.5 : ajout `killed`/`woundedAdd`/`defenderWoundedAfter` au CombatResult
// v1.0 (09/05/2026) — Phase 1 L1A.3 : types combat
// Source : PLAN-PHASE-1.md § 2.2

export type AttackKind = 'melee' | 'ranged'

export interface CombatModifiers {
  readonly flanked: boolean
  readonly terrainDefBonus?: number  // Phase 3, defaut 0
}

/** Ratio par defaut : 60 % des degats sont des morts definitifs, 40 % des blesses. */
export const KILLED_RATIO = 0.6

/**
 * Resultat d'une resolution de combat.
 * Contient tout ce qu'il faut pour :
 *  - mettre a jour la BDD (defenderHpAfter, defenderWoundedAfter, deltas morale)
 *  - afficher l'effet (defenderKilled, routed flags, killed/woundedAdd pour stats)
 *  - rejouer (rollUsed deterministe)
 */
export interface CombatResult {
  /** Degats bruts infliges (peut etre superieur a defender.hp avant clamp). */
  readonly damageDealt: number
  /** Degats reellement subis = defender.hp_avant - defenderHpAfter. */
  readonly actualDamage: number
  /** Soldats tues (definitif) = round(actualDamage * KILLED_RATIO). */
  readonly killed: number
  /** Soldats blesses ajoutes = actualDamage - killed (recoverable Phase 3). */
  readonly woundedAdd: number
  readonly defenderHpAfter: number
  readonly defenderWoundedAfter: number
  readonly attackerMoraleDelta: number
  readonly defenderMoraleDelta: number
  readonly attackerMoraleAfter: number
  readonly defenderMoraleAfter: number
  readonly attackerRouted: boolean
  readonly defenderRouted: boolean
  readonly defenderKilled: boolean
  readonly rollUsed: number
}

/**
 * Helper de split : convertit `damage` brut en killed + woundedAdd, en respectant
 * le clamp `defender.hp` (un dead n'est blesse qu'une fois).
 * Garantie : killed + woundedAdd === actualDamage.
 */
export function splitCasualties(
  damage: number,
  defenderHpBefore: number,
): { actualDamage: number; killed: number; woundedAdd: number; defenderHpAfter: number } {
  const defenderHpAfter = Math.max(0, defenderHpBefore - damage)
  const actualDamage = defenderHpBefore - defenderHpAfter
  const killed = Math.round(actualDamage * KILLED_RATIO)
  const woundedAdd = actualDamage - killed
  return { actualDamage, killed, woundedAdd, defenderHpAfter }
}
