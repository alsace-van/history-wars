// v1.0 (10/05/2026) — Phase 1.5 P1.5-NOTIF-01 : Realtime listener game_actions → toasts asymétriques
import { useRef } from 'react'
import { toast } from 'sonner'
import { useRealtime } from './useRealtime'
import type { Team, UnitKind } from '@/types/game'
import type { UnitState } from '@engine/units'

/** Snapshot stocke dans game_actions.result pour les attaques (mirror _shared/types.ts AttackResult). */
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
}

interface AttackResultSnapshot {
  attacker_id: string
  defender_id: string
  kind: 'melee' | 'ranged'
  combat: CombatResultSnapshot
  riposte: CombatResultSnapshot | null
  defender_killed: boolean
  attacker_killed: boolean
  attacker_after: { hp: number; wounded: number; morale: number; routed: boolean } | null
  defender_after: { hp: number; wounded: number; morale: number; routed: boolean } | null
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

interface UseCombatNotificationsOptions {
  gameId: string | null
  viewerTeam: Team | null
  enabled?: boolean
  /** Lookup actor_user_id → team. Construit cote caller depuis `players`. */
  playerTeams: Map<string, Team>
  /** Snapshot des units pour resoudre unitId → kind. Si DELETE deja arrive, fallback generique. */
  units: ReadonlyArray<UnitState>
}

/**
 * Toasts asymetriques sur INSERT game_actions :
 *   - Attaquant (moi) : voit kills uniquement (fog of war sur defenseur).
 *   - Defenseur (moi) : voit kills + blessés + soldats actifs restants (info propre complète).
 *   - Observateur tiers (ni mon attaque, ni ma defense) : silencieux.
 *
 * Ignore les actions move / end_turn / start_battle (le toast existant cote
 * Game.tsx couvre ces cas).
 */
export function useCombatNotifications({
  gameId,
  viewerTeam,
  enabled = true,
  playerTeams,
  units,
}: UseCombatNotificationsOptions): void {
  // Refs pour acceder aux dernieres valeurs sans re-subscribe le channel a chaque render
  const viewerTeamRef = useRef(viewerTeam)
  viewerTeamRef.current = viewerTeam
  const playerTeamsRef = useRef(playerTeams)
  playerTeamsRef.current = playerTeams
  const unitsRef = useRef(units)
  unitsRef.current = units

  useRealtime({
    channelName: gameId ? `combat-notif:${gameId}` : '',
    enabled: enabled && !!gameId && !!viewerTeam,
    postgresChanges: gameId
      ? [
          {
            table: 'game_actions',
            event: 'INSERT',
            filter: `game_id=eq.${gameId}`,
            onChange: payload => {
              handleActionInsert(payload, viewerTeamRef.current, playerTeamsRef.current, unitsRef.current)
            },
          },
        ]
      : undefined,
  })
}

function handleActionInsert(
  payload: unknown,
  viewerTeam: Team | null,
  playerTeams: Map<string, Team>,
  units: ReadonlyArray<UnitState>,
): void {
  if (!viewerTeam) return
  const newRow = (payload as { new?: GameActionRow }).new
  if (!newRow) return

  const t = newRow.action_type
  if (t !== 'attack_melee' && t !== 'attack_ranged') return
  if (!newRow.actor_user_id) return

  const attackerTeam = playerTeams.get(newRow.actor_user_id)
  if (!attackerTeam) return

  const isMyAttack = attackerTeam === viewerTeam
  const defenderTeam: Team = attackerTeam === 'blue' ? 'red' : 'blue'
  const isMyDefense = defenderTeam === viewerTeam
  if (!isMyAttack && !isMyDefense) return

  const result = newRow.result as AttackResultSnapshot | null
  if (!result || !result.combat) return

  const combat = result.combat
  const riposte = result.riposte

  // Lookup unit kinds (best-effort, peut etre null si DELETE deja arrive)
  const attackerUnit = units.find(u => u.id === result.attacker_id)
  const defenderUnit = units.find(u => u.id === result.defender_id)
  const attackerKind = attackerUnit ? KIND_LABEL[attackerUnit.kind] : 'Unité'
  const defenderKind = defenderUnit ? KIND_LABEL[defenderUnit.kind] : 'Unité ennemie'

  const actionLabel = t === 'attack_melee' ? 'Charge' : 'Tir'

  if (isMyAttack) {
    // PERSPECTIVE ATTAQUANT — kills uniquement (fog of war)
    if (combat.actualDamage === 0) {
      toast.info(`${actionLabel} : aucune perte ennemie`, { duration: 4000 })
    } else if (result.defender_killed) {
      toast.success(`${defenderKind} défaite — ${combat.killed} morts au combat`, { duration: 5000 })
    } else {
      toast.success(`${actionLabel} : ${combat.killed} ennemi${combat.killed > 1 ? 's' : ''} abattu${combat.killed > 1 ? 's' : ''}`, { duration: 4000 })
    }

    // Riposte : c'est MON attaquant qui prend les coups → info complète sur mes pertes
    if (riposte) {
      if (result.attacker_killed) {
        toast.error(`${attackerKind} décimée par la riposte`, { duration: 5000 })
      } else if (riposte.actualDamage > 0) {
        const after = result.attacker_after
        const restants = after ? after.hp : 0
        const blesses = after ? after.wounded : 0
        toast.warning(`Riposte adverse — ${riposte.killed} morts, ${riposte.woundedAdd} blessés, ${restants} restants${blesses > 0 ? ` (${blesses} en infirmerie)` : ''}`, { duration: 5500 })
      }
    }
  } else if (isMyDefense) {
    // PERSPECTIVE DEFENSEUR — info complete sur mes pertes (kills + blessés + restants)
    if (combat.actualDamage === 0) {
      toast.info(`${actionLabel} adverse : ${defenderKind} indemne`, { duration: 4000 })
    } else if (result.defender_killed) {
      toast.error(`${defenderKind} décimée — ${combat.killed} morts au combat`, { duration: 5500 })
    } else {
      const after = result.defender_after
      const restants = after ? after.hp : combat.defenderHpAfter
      const blesses = after ? after.wounded : combat.defenderWoundedAfter
      toast.error(`${defenderKind} sous attaque — ${combat.killed} morts, ${combat.woundedAdd} blessés, ${restants} restants${blesses > 0 ? ` (${blesses} en infirmerie)` : ''}`, { duration: 5500 })
    }

    // Riposte : c'est MOI qui ai riposte → kills uniquement sur l'ennemi (fog of war)
    if (riposte) {
      if (result.attacker_killed) {
        toast.success(`Riposte mortelle — ennemi décimé (${riposte.killed} morts)`, { duration: 5000 })
      } else if (riposte.actualDamage > 0) {
        toast.success(`Riposte : ${riposte.killed} ennemi${riposte.killed > 1 ? 's' : ''} abattu${riposte.killed > 1 ? 's' : ''}`, { duration: 4000 })
      }
    }
  }
}
