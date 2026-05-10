// v1.1 (10/05/2026) — Phase 1.5 : ajout killed/woundedAdd + splitCasualties (mirror src v1.1)
// v1.0 (09/05/2026) — Phase 1 L1B.4a : port combat/types pour Deno EF
// Source de verite : src/engine/combat/types.ts. Duplication controlee (piege #12).

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
  readonly damageDealt: number
  readonly actualDamage: number
  readonly killed: number
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
