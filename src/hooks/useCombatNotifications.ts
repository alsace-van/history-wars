// v2.4 (14/05/2026) — Phase 4 : short labels (I1/AO1…) + isBot dans CombatNotification (journal clarté)
// v2.3 (13/05/2026) — Phase 3.3 : expose menEngaged + contactCap dans CombatNotification (clarté Thermopyles)
// v2.2 (12/05/2026) — Sprint UX : ajout effectiveBefore dans losses (rapport AVANT/APRÈS)
// v2.1 (11/05/2026) — Phase 2.5 fix : losses.effectiveAfter (absolu) au lieu de hpAfter (% legacy)
import { useCallback, useRef, useState } from 'react'
import { useRealtime } from './useRealtime'
import type { Team, UnitKind } from '@/types/game'
import type { UnitState } from '@engine/units'
import { getUnitShortLabel } from '@ui/game/gameLabels'

interface CombatResultSnapshot {
  damageDealt: number
  actualDamage: number
  killed: number
  woundedAdd: number
  defenderHpAfter: number
  defenderWoundedAfter: number
  attackerMoraleAfter: number
  defenderMoraleAfter: number
  attackerRouted: boolean
  defenderRouted: boolean
  defenderKilled: boolean
  // Phase 2 v2 (optionnels pour retrocompat avec actions anciennes en BDD)
  attackPhase?: 'melee' | 'ranged' | 'charge'
  defenderEffectiveBefore?: number
  defenderEffectiveAfter?: number
  attackerEffectiveBefore?: number
  attackerEffectiveAfter?: number
  chargeBonusApplied?: boolean
  // Phase 3.3 — cap terrain au contact (Thermopyles). Optionnels = retrocompat actions BDD anciennes.
  menEngagedAttacker?: number
  menEngagedDefender?: number
  contactCap?: number
}

interface AttackResultSnapshot {
  attacker_id: string
  defender_id: string
  /** Phase 2 : 'charge' ajoute. */
  kind: 'melee' | 'ranged' | 'charge'
  combat: CombatResultSnapshot
  riposte: CombatResultSnapshot | null
  defender_killed: boolean
  attacker_killed: boolean
  attacker_after:
    | { hp: number; wounded: number; morale: number; routed: boolean; effective?: number; killed?: number }
    | null
  defender_after:
    | { hp: number; wounded: number; morale: number; routed: boolean; effective?: number; killed?: number }
    | null
}

interface GameActionRow {
  id: string
  game_id: string
  turn: number
  actor_user_id: string | null
  action_type: 'move' | 'attack_ranged' | 'attack_melee' | 'end_turn' | 'start_battle'
  payload: { unit_id?: string; target_unit_id?: string }
  result: AttackResultSnapshot | unknown
  resolved_at: string
}

const KIND_LABEL: Record<UnitKind, string> = {
  I: 'Infanterie',
  C: 'Cavalerie',
  A: 'Artillerie',
}

const TEAM_LABEL: Record<Team, string> = {
  blue: 'Bleus',
  red: 'Rouges',
}

/**
 * Notification de combat preparee pour le rendu UI. Contient toutes les infos
 * derivees pour CombatResultPanel : labels, perspective, pertes asymetriques.
 */
export interface CombatNotification {
  /** ID unique = action.id en BDD (stable, pas de doublon a la re-souscription Realtime). */
  id: string
  /** Tour ou s'est resolu le combat (pour libelle d'onglet). */
  turn: number
  /** Type d'engagement (Phase 2 : 'charge' ajoute). */
  kind: 'melee' | 'ranged' | 'charge'
  /** ID de l'unite attaquante (pour highlight visuel sur le plateau). */
  attackerId: string
  /** ID de l'unite defenseuse (pour highlight visuel sur le plateau). */
  defenderId: string
  /** Camp de l'attaquant. */
  attackerTeam: Team
  /** Camp du defenseur (= adverse de l'attaquant). */
  defenderTeam: Team
  /** Le viewer est-il l'attaquant ? */
  isMyAttack: boolean
  /** Le viewer est-il le defenseur ? */
  isMyDefense: boolean
  /** Label kind attacker (resolu meilleur effort, "Unite" si DELETE deja arrive). */
  attackerKindLabel: string
  /** Label kind defender. */
  defenderKindLabel: string
  /** Phase 4 — code court attaquant (I1, AO1, AC2…) coloré équipe dans le journal. */
  attackerShortLabel: string
  /** Phase 4 — code court défenseur. */
  defenderShortLabel: string
  /** Phase 4 — l'attaquant est-il un bot (actor_user_id null en BDD) ? */
  attackerIsBot: boolean
  /** Pertes infligees au defenseur lors de l'attaque initiale. effectiveBefore/After = nb soldats absolus avant/apres (Phase 2). */
  defenderLosses: { killed: number; woundedAdd: number; effectiveBefore: number; effectiveAfter: number; isKilled: boolean; isRouted: boolean }
  /** Pertes infligees a l'attaquant si riposte melee (null sinon). */
  attackerLosses: { killed: number; woundedAdd: number; effectiveBefore: number; effectiveAfter: number; isKilled: boolean; isRouted: boolean } | null
  /**
   * Phase 3.3 — cap terrain au contact (Thermopyles). Null si action ancienne sans snapshot v2.
   * Permet à l'UI d'expliquer pourquoi 750 vs 450 hommes I vs I font les mêmes dégâts sur plaine.
   */
  contact: { attackerEngaged: number; defenderEngaged: number; cap: number } | null
}

interface UseCombatNotificationsOptions {
  gameId: string | null
  viewerTeam: Team | null
  enabled?: boolean
  /** Lookup actor_user_id → team. Construit cote caller depuis `players`. */
  playerTeams: Map<string, Team>
  /** Snapshot des units pour resoudre unitId → kind. Si DELETE deja arrive, fallback generique. */
  units: ReadonlyArray<UnitState>
}

interface UseCombatNotificationsResult {
  /** Liste de toutes les notifications recues (ordre d'arrivee). Le composant CombatResultPanel les affiche en onglets. */
  notifications: CombatNotification[]
  /** Retire une notification par id (X de l'onglet). */
  removeNotification: (id: string) => void
  /** Vide toute la liste (utile au changement de partie ou bouton "tout fermer"). */
  clear: () => void
}

/**
 * Realtime listener game_actions → queue de notifications combat.
 *  - Filtre attack_melee/attack_ranged.
 *  - Ne pousse que si le viewer est attaquant OU defenseur (observateur tiers : silencieux).
 *  - Construit la notification asymetrique selon perspective :
 *      * Attaquant : kills uniquement sur defenseur (fog of war), pertes propres si riposte.
 *      * Defenseur : kills + blessés + restants sur ses propres pertes, kills seuls sur l'ennemi en riposte.
 *
 * Le composant `<CombatResultPanel>` consomme `current` + `dismiss` pour afficher
 * une fenetre flottante non-bloquante avec X de fermeture. Plusieurs combats
 * rapides s'empilent en queue ; le user les ferme un par un (cf piege #52).
 */
export function useCombatNotifications({
  gameId,
  viewerTeam,
  enabled = true,
  playerTeams,
  units,
}: UseCombatNotificationsOptions): UseCombatNotificationsResult {
  const [notifications, setNotifications] = useState<CombatNotification[]>([])

  // Refs pour acceder aux dernieres valeurs sans re-subscribe a chaque render
  const viewerTeamRef = useRef(viewerTeam)
  viewerTeamRef.current = viewerTeam
  const playerTeamsRef = useRef(playerTeams)
  playerTeamsRef.current = playerTeams
  const unitsRef = useRef(units)
  unitsRef.current = units

  useRealtime({
    channelName: gameId ? `combat-notif:${gameId}` : '',
    // Phase 4 : viewerTeam=null = spectateur, hook actif quand même pour voir TOUS les combats.
    enabled: enabled && !!gameId,
    postgresChanges: gameId
      ? [
          {
            table: 'game_actions',
            event: 'INSERT',
            filter: `game_id=eq.${gameId}`,
            onChange: payload => {
              const notif = parseAction(payload, viewerTeamRef.current, playerTeamsRef.current, unitsRef.current)
              if (notif) {
                setNotifications(prev => {
                  // Anti-doublon : si l'id est deja en liste, ignore
                  if (prev.some(n => n.id === notif.id)) return prev
                  return [...prev, notif]
                })
              }
            },
          },
        ]
      : undefined,
  })

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clear = useCallback(() => {
    setNotifications([])
  }, [])

  return { notifications, removeNotification, clear }
}

function parseAction(
  payload: unknown,
  viewerTeam: Team | null,
  playerTeams: Map<string, Team>,
  units: ReadonlyArray<UnitState>,
): CombatNotification | null {
  // Phase 4 : viewerTeam=null = mode spectateur → on affiche TOUS les combats.
  const isSpectator = !viewerTeam
  const newRow = (payload as { new?: GameActionRow }).new
  if (!newRow) return null

  const t = newRow.action_type
  if (t !== 'attack_melee' && t !== 'attack_ranged') return null

  const result = newRow.result as AttackResultSnapshot | null
  // Phase 4 : bot a actor_user_id=null. On déduit le camp via l'attaquant dans units.
  let attackerTeam: Team | undefined
  if (newRow.actor_user_id) {
    attackerTeam = playerTeams.get(newRow.actor_user_id)
  } else if (result) {
    const attackerUnit = units.find(u => u.id === result.attacker_id)
    attackerTeam = attackerUnit?.team
  }
  if (!attackerTeam) return null

  const isMyAttack = !isSpectator && attackerTeam === viewerTeam
  const defenderTeam: Team = attackerTeam === 'blue' ? 'red' : 'blue'
  const isMyDefense = !isSpectator && defenderTeam === viewerTeam
  if (!isSpectator && !isMyAttack && !isMyDefense) return null

  if (!result || !result.combat) return null

  const combat = result.combat
  const riposte = result.riposte

  const attackerUnit = units.find(u => u.id === result.attacker_id)
  const defenderUnit = units.find(u => u.id === result.defender_id)
  const attackerKindLabel = attackerUnit ? KIND_LABEL[attackerUnit.kind] : 'Unité'
  const defenderKindLabel = defenderUnit ? KIND_LABEL[defenderUnit.kind] : 'Unité ennemie'
  // Phase 4 — short labels I1/AO1… avec fallback "??" si DELETE déjà arrivé.
  const attackerShortLabel = attackerUnit
    ? getUnitShortLabel(attackerUnit, units)
    : `${result.attacker_id.slice(0, 4)}?`
  const defenderShortLabel = defenderUnit
    ? getUnitShortLabel(defenderUnit, units)
    : `${result.defender_id.slice(0, 4)}?`
  const attackerIsBot = newRow.actor_user_id === null

  // Phase 2.5 fix : "Soldats restants" doit afficher l'effective absolu (sur effectiveMax),
  // pas le hp legacy v1 (sur 100 = pourcentage). Fallback en cascade :
  // result.defender_after.effective (post-EF) → combat.defenderEffectiveAfter (snapshot v2).
  // v2.2 : effectiveBefore present dans le snapshot Phase 2 v2 (cf. CombatResultV2).
  // Fallback retrocompat : reconstruit a partir de effectiveAfter + killed + woundedAdd
  // (invariant moteur : effectiveBefore === effectiveAfter + killed + woundedAdd).
  const defenderEffectiveAfter = result.defender_after?.effective ?? combat.defenderEffectiveAfter ?? 0
  const defenderEffectiveBefore =
    combat.defenderEffectiveBefore ?? defenderEffectiveAfter + (combat.killed ?? 0) + (combat.woundedAdd ?? 0)
  const defenderLosses = {
    killed: combat.killed ?? 0,
    woundedAdd: combat.woundedAdd ?? 0,
    effectiveBefore: defenderEffectiveBefore,
    effectiveAfter: defenderEffectiveAfter,
    isKilled: result.defender_killed,
    isRouted: combat.defenderRouted,
  }

  const attackerLosses = riposte
    ? (() => {
        const after = result.attacker_after?.effective ?? riposte.defenderEffectiveAfter ?? 0
        // Riposte : "defender" du snapshot riposte = l'attaquant initial (qui prend les pertes).
        const before = riposte.defenderEffectiveBefore ?? after + (riposte.killed ?? 0) + (riposte.woundedAdd ?? 0)
        return {
          killed: riposte.killed ?? 0,
          woundedAdd: riposte.woundedAdd ?? 0,
          effectiveBefore: before,
          effectiveAfter: after,
          isKilled: result.attacker_killed,
          isRouted: riposte.attackerRouted,
        }
      })()
    : null

  // Phase 3.3 — cap terrain au contact. Présent uniquement si snapshot v2 enrichi (resolveContact).
  const contact =
    combat.menEngagedAttacker !== undefined &&
    combat.menEngagedDefender !== undefined &&
    combat.contactCap !== undefined
      ? {
          attackerEngaged: combat.menEngagedAttacker,
          defenderEngaged: combat.menEngagedDefender,
          cap: combat.contactCap,
        }
      : null

  return {
    id: newRow.id,
    turn: newRow.turn,
    kind: result.kind,
    attackerId: result.attacker_id,
    defenderId: result.defender_id,
    attackerTeam,
    defenderTeam,
    isMyAttack,
    isMyDefense,
    attackerKindLabel,
    defenderKindLabel,
    attackerShortLabel,
    defenderShortLabel,
    attackerIsBot,
    defenderLosses,
    attackerLosses,
    contact,
  }
}

export { TEAM_LABEL }
