// v1.0 (13/05/2026) — QW2 session 22 : extraction du state activeCombatNotif + highlightedUnitIds de Game.tsx
import { useMemo, useState } from 'react'
import type { CombatNotification } from '@hooks/useCombatNotifications'

interface UseCombatHighlightResult {
  activeCombatNotif: CombatNotification | null
  setActiveCombatNotif: (n: CombatNotification | null) => void
  /** Unités à mettre en surbrillance dans la scène quand un rapport est actif. */
  highlightedUnitIds: Set<string>
}

/**
 * Highlight scénique lié à la sélection d'un rapport de combat dans CombatResultPanel :
 * - mon unité (toujours visible)
 * - ennemi du rapport actif (filtré par fog of war : LoS depuis n'importe quelle de mes unités)
 */
export function useCombatHighlight(visibleEnemyIds: Set<string>): UseCombatHighlightResult {
  const [activeCombatNotif, setActiveCombatNotif] = useState<CombatNotification | null>(null)

  const highlightedUnitIds = useMemo<Set<string>>(() => {
    if (!activeCombatNotif) return new Set()
    const out = new Set<string>()
    const myUnitId = activeCombatNotif.isMyAttack ? activeCombatNotif.attackerId : activeCombatNotif.defenderId
    const enemyUnitId = activeCombatNotif.isMyAttack ? activeCombatNotif.defenderId : activeCombatNotif.attackerId
    out.add(myUnitId)
    if (visibleEnemyIds.has(enemyUnitId)) {
      out.add(enemyUnitId)
    }
    return out
  }, [activeCombatNotif, visibleEnemyIds])

  return { activeCombatNotif, setActiveCombatNotif, highlightedUnitIds }
}
