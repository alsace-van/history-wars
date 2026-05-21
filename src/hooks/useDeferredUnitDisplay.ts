// v1.0 (17/05/2026) — Freeze visuel des unités défenseur tant que l'attaquant
// n'a pas fini son animation. Évite les flashs "réduction d'effectif / disparition"
// AVANT que le pion attaquant arrive au contact.
//
// Mécanique :
//  - On maintient en ref un snapshot par unitId du dernier état "non-frozen" vu.
//  - À chaque render, on retourne l'état actuel pour les non-frozen et le snapshot
//    pour les frozen (y compris si elles ont disparu de `units` suite à un DELETE
//    Realtime — typique d'une kill).
//  - Quand l'attaquant termine son anim (frozenIds rétrécit), les défenseurs
//    libérés reprennent immédiatement leur état courant : shrink + disparition.

import { useEffect, useMemo, useRef } from 'react'

interface WithId { readonly id: string }

export function useDeferredUnitDisplay<T extends WithId>(
  units: ReadonlyArray<T>,
  frozenIds: ReadonlySet<string>,
): ReadonlyArray<T> {
  // snapshot du dernier état "non-frozen" pour chaque unitId.
  const snapshotRef = useRef<Map<string, T>>(new Map())

  // Sync : actualise le snapshot pour toute unité NON gelée.
  // Nettoie aussi les snapshots d'unités disparues et non gelées (kill normale, hors combat pending).
  useEffect(() => {
    const next = snapshotRef.current
    for (const u of units) {
      if (!frozenIds.has(u.id)) {
        next.set(u.id, u)
      }
    }
    const liveIds = new Set(units.map(u => u.id))
    for (const id of Array.from(next.keys())) {
      if (!liveIds.has(id) && !frozenIds.has(id)) {
        next.delete(id)
      }
    }
  }, [units, frozenIds])

  return useMemo(() => {
    const out: T[] = []
    const seen = new Set<string>()
    const snap = snapshotRef.current
    for (const u of units) {
      if (frozenIds.has(u.id)) {
        out.push(snap.get(u.id) ?? u)
      } else {
        out.push(u)
      }
      seen.add(u.id)
    }
    // Ajouter les défenseurs gelés qui ont déjà été DELETE de `units` (kill mais
    // qu'on doit encore afficher le temps que l'attaquant finisse son anim).
    for (const [id, s] of snap) {
      if (frozenIds.has(id) && !seen.has(id)) {
        out.push(s)
      }
    }
    return out
  }, [units, frozenIds])
}
