// v1.2 (16/05/2026) — fix anim "cav saute à retreat" : injection setUnitPaths
//   pour animer le pré-move charge (start → landingPos) avant submit. Sans ça
//   le pion saute directement à retreat_dest car aucun path n'est passé au
//   système d'animation lerp.
// v1.1 (16/05/2026) — fix bug "1er clic attaque directement" : reset preview
//   défensif sur (a) submit terminé même si refus serveur, (b) changement de
//   selectedUnit, (c) disparition de la cible de attackTargets. Évite l'état
//   stale où chargePreviewTargetId déclenche commitChargeStay au lieu d'ouvrir
//   une nouvelle preview.
// v1.0 (16/05/2026) — Phase 2.6 UX pré-commit cav : flow inversé
//   Click ennemi (hint='charge') → preview de la position d'arrivée + cases
//   bleues de repli (spiral rayon 3 autour de la landing position).
//   Re-click ennemi = "Rester en mêlée" (charge_intent: stay)
//   Click case bleue = "Replier sur cette case" (charge_intent: retreat)
//   Click ailleurs = cancel preview
//
// Remplace le post-charge implicite (cases bleues APRÈS la charge). Avant on
// chargeait puis on choisissait ; désormais on choisit puis on charge en
// atomique. Le bonus charge ×1.15-1.25 reste appliqué côté serveur via
// resolveCombat. Si défenseur meurt en charge, l'intent est ignoré (le pion
// reste à landing, pas besoin de retraite).
//
// Frontière hooks : zéro Three, zéro Supabase direct (submit via callback).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cube, cubeKey, cubeDistance, spiral, type Cube } from '@engine/hex'
import type { UnitState } from '@engine/units'
import type { AttackPositionResult } from '@engine/combat/v2'
import type { GameAction } from '@hooks/useCombatActions'

interface UseChargePreviewArgs {
  gameId: string | null
  selectedUnit: UnitState | null
  unitStates: ReadonlyArray<UnitState>
  boardKeys: ReadonlySet<string>
  submitAction: (gameId: string, action: GameAction) => Promise<{ ok: boolean; code?: string; message?: string }>
  /** Callback succès (clearSelection + refresh). */
  onActionCompleted?: () => void
  /**
   * v1.2 — Injecte le path de pré-move dans le système d'animation lerp. Sans
   * ça le pion saute de start → retreat_dest sans qu'on voie la charge.
   */
  setUnitPaths?: (
    updater: (prev: Map<string, ReadonlyArray<Cube>>) => Map<string, ReadonlyArray<Cube>>,
  ) => void
}

interface ChargePreviewState {
  /** Id de l'ennemi ciblé par la charge en préparation. */
  targetId: string
  /** Position prévue d'arrivée de la cav après auto-move. */
  landingPos: Cube
  /** Path complet (start ... landing). Sera envoyé en move_path. */
  movePath: ReadonlyArray<Cube>
  /** Set cubeKey des cases de repli candidates (radius 3 depuis landing). */
  retreatKeys: ReadonlySet<string>
}

interface UseChargePreviewResult {
  /** Null tant qu'aucun click charge en cours. */
  preview: ChargePreviewState | null
  /**
   * Active la preview pour une cible chargeable. Appelé depuis
   * useBattleClickHandlers quand l'utilisateur clique un ennemi avec hint='charge'.
   * `meta` vient de attackTargets (path + dest pré-calculés).
   */
  openPreview: (target: UnitState, meta: AttackPositionResult) => void
  /** Soumet attack_melee avec charge_intent={post_charge:'stay'}. */
  commitStay: () => Promise<void>
  /** Soumet attack_melee avec charge_intent={post_charge:'retreat', retreat_dest:hex}. */
  commitRetreat: (hex: Cube) => Promise<void>
  /** Annule la preview sans submit. */
  cancel: () => void
  /** True si une preview est active → désactive end_turn côté Game.tsx. */
  blockEndTurn: boolean
}

const RETREAT_RADIUS = 3

export function useChargePreview(args: UseChargePreviewArgs): UseChargePreviewResult {
  const { gameId, selectedUnit, unitStates, boardKeys, submitAction, onActionCompleted, setUnitPaths } = args
  const [preview, setPreview] = useState<ChargePreviewState | null>(null)
  const [busy, setBusy] = useState(false)

  const cancel = useCallback(() => setPreview(null), [])

  // v1.1 — Reset défensif (a) : si l'unité sélectionnée change (autre cav,
  // désélection, fin de tour), oublier toute preview en cours. Évite que
  // chargePreviewTargetId reste set quand l'utilisateur a déjà bougé ailleurs.
  useEffect(() => {
    setPreview(null)
  }, [selectedUnit?.id])

  // v1.1 — Reset défensif (b) : si la cible disparaît (morte, hors vision,
  // out-of-range après mouvement), invalider la preview.
  useEffect(() => {
    if (!preview) return
    const stillAlive = unitStates.some(u => u.id === preview.targetId)
    if (!stillAlive) setPreview(null)
  }, [preview, unitStates])

  const openPreview = useCallback((target: UnitState, meta: AttackPositionResult) => {
    if (!selectedUnit) return
    const landingPos = meta.dest
    const defenderPos = cube(target.position.q, target.position.r)
    const occupied = new Set<string>()
    for (const u of unitStates) {
      if (u.id === selectedUnit.id) continue
      occupied.add(cubeKey(cube(u.position.q, u.position.r)))
    }
    // Cases candidates : spiral rayon 3 autour de landing, libres, in-board,
    // ne se rapprochent pas du défenseur (mirror server validation).
    const retreatKeys = new Set<string>()
    for (const c of spiral(landingPos, RETREAT_RADIUS)) {
      const k = cubeKey(c)
      if (!boardKeys.has(k)) continue
      // Exclut la position d'arrivée elle-même (= stay, géré par re-clic ennemi).
      if (c.q === landingPos.q && c.r === landingPos.r) continue
      if (occupied.has(k)) continue
      // Exclut la position du défenseur (case occupée mais filtre redondant).
      if (c.q === defenderPos.q && c.r === defenderPos.r) continue
      const distBefore = cubeDistance(landingPos, defenderPos)
      const distAfter = cubeDistance(c, defenderPos)
      if (distAfter < distBefore) continue
      retreatKeys.add(k)
    }
    setPreview({ targetId: target.id, landingPos, movePath: meta.path, retreatKeys })
  }, [selectedUnit, unitStates, boardKeys])

  const submitWithIntent = useCallback(async (intent: { post_charge: 'stay' | 'retreat'; retreat_dest?: { q: number; r: number } }) => {
    if (!gameId || !selectedUnit || !preview || busy) return
    setBusy(true)
    try {
      // v1.2 — animer le pré-move charge AVANT submit. Mirror exact de
      // useBattleClickHandlers.handleUnitClick ligne 172-178 pour les attaques
      // directes non-charge. Path injecté dans le système lerp.
      if (setUnitPaths && preview.movePath.length >= 2) {
        const attackerId = selectedUnit.id
        const movePath = preview.movePath
        setUnitPaths(prev => {
          const next = new Map(prev)
          next.set(attackerId, movePath)
          return next
        })
      }
      const res = await submitAction(gameId, {
        type: 'attack_melee',
        payload: {
          unit_id: selectedUnit.id,
          target_unit_id: preview.targetId,
          move_dest: preview.movePath.length > 0
            ? { q: preview.landingPos.q, r: preview.landingPos.r }
            : undefined,
          move_path: preview.movePath.length > 0
            ? preview.movePath.map(c => ({ q: c.q, r: c.r, s: c.s }))
            : undefined,
          charge_intent: intent,
        },
      })
      // v1.1 — Reset défensif (c) : clear preview QUEL QUE SOIT le résultat.
      // Si le serveur refuse (validation, charge_intent rejeté), un état stale
      // ferait que le prochain clic ennemi traverse le branch commitChargeStay
      // → attaque immédiate au lieu d'ouvrir une nouvelle preview.
      setPreview(null)
      if (res.ok) onActionCompleted?.()
    } finally {
      setBusy(false)
    }
  }, [gameId, selectedUnit, preview, busy, submitAction, onActionCompleted, setUnitPaths])

  const commitStay = useCallback(() => submitWithIntent({ post_charge: 'stay' }), [submitWithIntent])
  const commitRetreat = useCallback(
    (hex: Cube) => submitWithIntent({ post_charge: 'retreat', retreat_dest: { q: hex.q, r: hex.r } }),
    [submitWithIntent],
  )

  return useMemo(() => ({
    preview,
    openPreview,
    commitStay,
    commitRetreat,
    cancel,
    blockEndTurn: preview !== null,
  }), [preview, openPreview, commitStay, commitRetreat, cancel])
}
