// v1.1 (16/05/2026) — Phase 2.6 refonte : repli implicite (cases bleues s'allument auto, click cav = stay, click ailleurs = stay). Suppression du flow modale.
// v1.0 (16/05/2026) — Phase 2.6 : menu post-charge cavalerie (Rester / Replier)
// Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 4 + docs/BACKLOG.md ligne 28
//
// Détecte les cavaleries du joueur avec `pendingPostChargeTargetId != null`
// (set par EF handleAttack après une charge non-mortelle, propagé via Realtime
// + unitAdapter). Expose :
//   - `pendingCavalry` / `pendingDefender` (UnitInstance) pour PostChargeChoiceModal
//   - `chargeRetreatMode` + `chargeRetreatTargetKeys` (Set<string> cubeKeys) pour
//     surligner les cases adjacentes valides via useTacticalSelection
//   - handlers `handleStay` / `handleEnterRetreatMode` / `commitChargeRetreat`
//   - `blockEndTurn` : true tant qu'une décision est pending (Game.tsx désactive)
//
// Concurrence : si plusieurs cavaleries pending simultanément (cas marginal :
// 2 charges dans le même tour), on en présente UNE à la fois (la première par
// id), les autres attendent en file.
import { useCallback, useMemo, useState } from 'react'
import { cube, cubeKey, cubeDistance, neighbors } from '@engine/hex'
import type { Cube } from '@engine/hex'
import type { Team } from '@/types/game'
import type { UnitInstance } from '@render/types'
import type { GameAction } from '@hooks/useCombatActions'

interface UsePostChargeChoiceArgs {
  gameId: string | null
  myTeam: Team | null
  /** Toutes les unités du plateau (UnitInstance enrichi avec pendingPostChargeTargetId). */
  renderUnits: ReadonlyArray<UnitInstance>
  /** Set des cubeKeys du board (pour validation in-board). */
  boardKeys: ReadonlySet<string>
  /** submitAction wrappé via useCombatActions. */
  submitAction: (gameId: string, action: GameAction) => Promise<{ ok: boolean; code?: string; message?: string }>
  /** Callback appelé après succès stay/retreat (refresh + clearSelection côté Game.tsx). */
  onActionCompleted?: () => void
}

interface UsePostChargeChoiceResult {
  /** Mon pion cavalerie en attente. Null tant qu'aucune charge pending. */
  pendingCavalry: UnitInstance | null
  /** Le défenseur survivant ciblé par la charge. Null si vanished entre-temps. */
  pendingDefender: UnitInstance | null
  /**
   * Phase 2.6 refonte — toujours true tant que pendingCavalry existe (mode auto).
   * Les cases bleues s'allument immédiatement après la charge, le joueur clique
   * une case ou la cav pour résoudre. Pas de modale d'introduction.
   */
  chargeRetreatMode: boolean
  /** cubeKey -> case adjacente valide pour le repli (≥ distance courante au défenseur). */
  chargeRetreatTargetKeys: ReadonlySet<string>
  /** Stay : INSERT engagement from_charge=true. Appelé sur click cav OU click hors zone bleue. */
  commitChargeStay: () => Promise<void>
  /** Retreat : déplace cav vers hex choisi. */
  commitChargeRetreat: (hex: Cube) => Promise<void>
  /** True tant qu'une cavalerie pending → désactive end_turn côté Game.tsx. */
  blockEndTurn: boolean
}

export function usePostChargeChoice(args: UsePostChargeChoiceArgs): UsePostChargeChoiceResult {
  const { gameId, myTeam, renderUnits, boardKeys, submitAction, onActionCompleted } = args
  const [busy, setBusy] = useState(false)

  // Lookup ma cavalerie en pending (1ère par id si plusieurs).
  const pendingCavalry = useMemo<UnitInstance | null>(() => {
    if (!myTeam) return null
    const candidates = renderUnits
      .filter(u => u.team === myTeam && u.pendingPostChargeTargetId)
      .sort((a, b) => a.id.localeCompare(b.id))
    return candidates[0] ?? null
  }, [renderUnits, myTeam])

  const pendingDefender = useMemo<UnitInstance | null>(() => {
    if (!pendingCavalry?.pendingPostChargeTargetId) return null
    return renderUnits.find(u => u.id === pendingCavalry.pendingPostChargeTargetId) ?? null
  }, [renderUnits, pendingCavalry])

  // Phase 2.6 refonte — chargeRetreatMode auto-actif tant que pending existe.
  // Les cases bleues s'allument dès la charge résolue. Pas de toggle manuel.
  const chargeRetreatMode = pendingCavalry !== null

  // Cases adjacentes valides pour repli : in-board + libres + s'éloignent du défenseur
  // (ou au moins ne s'en rapprochent pas — mirror handleChargeRetreat EF).
  const chargeRetreatTargetKeys = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    if (!pendingCavalry || !chargeRetreatMode) return set
    const origin = cube(pendingCavalry.position.q, pendingCavalry.position.r)
    const defenderPos = pendingDefender
      ? cube(pendingDefender.position.q, pendingDefender.position.r)
      : null
    const distBefore = defenderPos ? cubeDistance(origin, defenderPos) : 0
    const occupied = new Set<string>(
      renderUnits.filter(u => u.id !== pendingCavalry.id).map(u => cubeKey(cube(u.position.q, u.position.r))),
    )
    for (const n of neighbors(origin)) {
      const k = cubeKey(n)
      if (!boardKeys.has(k)) continue
      if (occupied.has(k)) continue
      if (defenderPos && cubeDistance(n, defenderPos) < distBefore) continue
      set.add(k)
    }
    return set
  }, [pendingCavalry, pendingDefender, chargeRetreatMode, renderUnits, boardKeys])

  const commitChargeStay = useCallback(async () => {
    if (!gameId || !pendingCavalry || busy) return
    setBusy(true)
    try {
      const res = await submitAction(gameId, {
        type: 'charge_stay',
        payload: { unit_id: pendingCavalry.id },
      })
      if (res.ok) onActionCompleted?.()
    } finally {
      setBusy(false)
    }
  }, [gameId, pendingCavalry, submitAction, onActionCompleted, busy])

  const commitChargeRetreat = useCallback(async (hex: Cube) => {
    if (!gameId || !pendingCavalry || busy) return
    setBusy(true)
    try {
      const res = await submitAction(gameId, {
        type: 'charge_retreat',
        payload: { unit_id: pendingCavalry.id, dest_q: hex.q, dest_r: hex.r },
      })
      if (res.ok) onActionCompleted?.()
      // Si erreur (case occupée race, etc.) : le pending reste, le user peut re-cliquer.
    } finally {
      setBusy(false)
    }
  }, [gameId, pendingCavalry, submitAction, onActionCompleted, busy])

  return {
    pendingCavalry,
    pendingDefender,
    chargeRetreatMode,
    chargeRetreatTargetKeys,
    commitChargeStay,
    commitChargeRetreat,
    blockEndTurn: pendingCavalry !== null,
  }
}
