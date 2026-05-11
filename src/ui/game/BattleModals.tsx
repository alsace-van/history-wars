// v1.0 (11/05/2026) — Phase 2.5 C : regroupement EndGameModal + ShakenAttackConfirm (alléger Game.tsx)
import type { UnitState } from '@engine/units'
import type { Team } from '@/types/game'
import { EndGameModal } from '@ui/game/EndGameModal'
import { ShakenAttackConfirm } from '@ui/game/ShakenAttackConfirm'

interface BattleModalsProps {
  // EndGameModal
  endGameOpen: boolean
  onEndGameClose: () => void
  gameId: string
  winner: Team | null
  totalTurns: number
  // ShakenAttackConfirm
  shakenSelectedUnit: UnitState | null
  pendingShakenAttack: { targetId: string } | null
  onShakenConfirm: (dontShowAgain: boolean) => void
  onShakenCancel: () => void
}

/**
 * Conteneur des modales de bataille. Pas d'état propre, juste un regroupement
 * pour alléger Game.tsx (CLAUDE.md §4 max 600 lignes).
 */
export function BattleModals({
  endGameOpen,
  onEndGameClose,
  gameId,
  winner,
  totalTurns,
  shakenSelectedUnit,
  pendingShakenAttack,
  onShakenConfirm,
  onShakenCancel,
}: BattleModalsProps) {
  return (
    <>
      <EndGameModal
        open={endGameOpen}
        onClose={onEndGameClose}
        gameId={gameId}
        winner={winner}
        totalTurns={totalTurns}
      />
      {shakenSelectedUnit && (
        <ShakenAttackConfirm
          open={pendingShakenAttack !== null}
          effective={shakenSelectedUnit.effective}
          effectiveMax={shakenSelectedUnit.effectiveMax}
          onConfirm={onShakenConfirm}
          onCancel={onShakenCancel}
        />
      )}
    </>
  )
}
