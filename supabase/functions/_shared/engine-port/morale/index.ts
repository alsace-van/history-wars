// v1.1 (11/05/2026) — Phase 2.5 : ajout recoverMoraleEndTurnV2 + moraleCombatLossMultiplier
// v1.0 (09/05/2026) — Phase 1 L1B.4a : barrel morale Deno
export {
  MORALE_COMBAT_LOSS_MULT_FLOOR,
  MORALE_COMBAT_LOSS_PER_ADJACENT,
  MORALE_RECOVER_BONUS_PER_ADJACENT,
  MORALE_RECOVER_BONUS_PER_NEARBY,
  MORALE_RECOVER_PER_TURN,
  MORALE_ROUT_THRESHOLD,
  applyMoraleDelta,
  isRouted,
  moraleCombatBonus,
  moraleCombatLossMultiplier,
  recoverMoraleEndTurn,
  recoverMoraleEndTurnV2,
} from './morale.ts'
