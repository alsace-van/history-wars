// v1.0 (17/05/2026) — Différé d'affichage des engagements pendant l'anim attaquant.
//
// L'EF insère un engagement (table `engagements`) dès la résolution melee
// non-mortelle bilatérale. Le Realtime push arrive AVANT que le pion attaquant
// soit visuellement arrivé sur la cible → la ligne d'engagement + le badge
// "T+N" apparaissent trop tôt.
//
// Ce hook filtre les engagement rows dont au moins une des unités est dans
// `frozenIds` (= union pendingAttackerIds + pendingDefenderIds). Tant que le
// combat est pending (anim en cours), l'engagement n'est pas exposé. Quand
// l'attaquant termine son anim, frozenIds rétrécit → l'engagement réapparaît.
//
// Note : on ne maintient PAS de snapshot des engagements supprimés (à la diff
// de useDeferredUnitDisplay) car un engagement est créé puis dure plusieurs
// tours — pas de cas où il faut "le retenir après suppression".

import { useMemo } from 'react'
import type { EngagementRow } from './useEngagement'

export function useDeferredEngagements(
  engagements: ReadonlyArray<EngagementRow>,
  frozenIds: ReadonlySet<string>,
): ReadonlyArray<EngagementRow> {
  return useMemo(() => {
    if (frozenIds.size === 0) return engagements
    return engagements.filter(e => !frozenIds.has(e.unit_a_id) && !frozenIds.has(e.unit_b_id))
  }, [engagements, frozenIds])
}
