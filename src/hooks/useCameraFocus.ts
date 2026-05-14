// v1.0 (13/05/2026) — QW2 session 22 : extraction du cameraFocusCube + handleFocusUnit de Game.tsx
import { useCallback, useState } from 'react'
import type { Cube } from '@engine/hex'
import type { UnitState } from '@engine/units'

interface UseCameraFocusResult {
  /** Cible courante pour le recentrage caméra (consommée par TacticalScene). */
  cameraFocusCube: Cube | null
  /** Recentrer la caméra sur la position d'une unité (lookup dans unitStates). */
  handleFocusUnit: (unitId: string) => void
}

/**
 * État impératif de recentrage caméra. Déclenché par les boutons "Centrer" (CombatResultPanel,
 * BattleSidebar ligne par pion). La consommation est gérée par TacticalScene (clear interne au
 * prochain frame).
 */
export function useCameraFocus(unitStates: ReadonlyArray<UnitState>): UseCameraFocusResult {
  const [cameraFocusCube, setCameraFocusCube] = useState<Cube | null>(null)

  const handleFocusUnit = useCallback(
    (unitId: string) => {
      const u = unitStates.find(uu => uu.id === unitId)
      if (u) setCameraFocusCube(u.position)
    },
    [unitStates],
  )

  return { cameraFocusCube, handleFocusUnit }
}
