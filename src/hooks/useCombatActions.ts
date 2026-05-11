// v2.1 (11/05/2026) — Phase 2.5 C : RetreatAction + SurrenderAction + SuicideAction + codes erreur cohésion
// v2.0 (10/05/2026) — Phase 2 2D.5 : ajout SplitAction + MergeAction + nouveaux error codes humanises
// v1.0 (09/05/2026) — L1C.1 : wrappers EF start_battle / resolve_action / resolve_turn
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@lib/supabase'
import { genUUID } from '@lib/uuid'

const TAG = '[useCombatActions v2.1]'

// ----------------------------------------------------------------------------
// Types payload UI (côté client). Identique aux MovePayload/AttackPayload des EF
// mais redefinis ici pour eviter import inter-couches (ui ne lit pas supabase/functions).
// ----------------------------------------------------------------------------

export interface MoveAction {
  type: 'move'
  payload: { unit_id: string; dest_q: number; dest_r: number }
}

export interface AttackAction {
  type: 'attack_ranged' | 'attack_melee'
  payload: { unit_id: string; target_unit_id: string }
}

/** Phase 2 2C.4 : split d'un pion en 2 selon ratio preset. */
export interface SplitAction {
  type: 'split_unit'
  payload: {
    unit_id: string
    target_q: number
    target_r: number
    ratio: 'half' | 'three_quarter' | 'nine_one'
  }
}

/** Phase 2 2C.5 : fusion de 2 pions adjacents same kind/team. */
export interface MergeAction {
  type: 'merge_unit'
  payload: { target_unit_id: string; source_unit_id: string }
}

/** Phase 2.5 C — retraite volontaire unité Brisée (1 hex voisin libre). */
export interface RetreatAction {
  type: 'retreat'
  payload: { unit_id: string; dest_q: number; dest_r: number }
}

/** Phase 2.5 C — reddition unité Brisée (élimination + impact moral 2 camps). */
export interface SurrenderAction {
  type: 'surrender'
  payload: { unit_id: string }
}

/** Phase 2.5 C — combat suicide unité Brisée encerclée (×1.5 dégâts, pas riposte, élimination). */
export interface SuicideAction {
  type: 'suicide_attack'
  payload: { unit_id: string; target_unit_id: string }
}

export type GameAction =
  | MoveAction
  | AttackAction
  | SplitAction
  | MergeAction
  | RetreatAction
  | SurrenderAction
  | SuicideAction

/** Reponse normalisee : ok=true + data, OU ok=false + message UI (toast deja affiche). */
export interface ActionResponse<T = unknown> {
  ok: boolean
  data?: T
  code?: string
  message?: string
}

interface UseCombatActionsResult {
  busy: boolean
  startBattle: (gameId: string) => Promise<ActionResponse>
  submitAction: (gameId: string, action: GameAction) => Promise<ActionResponse>
  endTurn: (gameId: string, scale?: 'tactical' | 'operational' | 'strategic') => Promise<ActionResponse>
}

// ----------------------------------------------------------------------------
// Helper invoke + parsing erreur EF (format { ok, code, message } ou exception)
// ----------------------------------------------------------------------------

interface InvokeOk { ok: true; [k: string]: unknown }
interface InvokeErr { ok: false; code?: string; message?: string }
type InvokeBody = InvokeOk | InvokeErr | null | undefined

/**
 * Wrap supabase.functions.invoke + extraction propre du body en cas d'erreur.
 * Quand l'EF renvoie 4xx/5xx, supabase-js v2 stocke le body dans error.context (FunctionsHttpError).
 */
async function invokeEF(name: string, body: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const { data, error } = await supabase.functions.invoke<InvokeBody>(name, { body })

    if (error) {
      // Tenter de lire le body d'erreur (FunctionsHttpError)
      let parsed: InvokeErr | null = null
      const ctx = (error as { context?: { body?: unknown } }).context
      if (ctx?.body) {
        try {
          const text = typeof ctx.body === 'string'
            ? ctx.body
            : await new Response(ctx.body as BodyInit).text()
          parsed = JSON.parse(text) as InvokeErr
        } catch {
          // body non parsable
        }
      }
      const code = parsed?.code ?? 'INVOKE_ERROR'
      const message = parsed?.message ?? error.message ?? 'Erreur appel serveur'
      return { ok: false, code, message }
    }

    if (!data) {
      return { ok: false, code: 'EMPTY_RESPONSE', message: 'Reponse vide du serveur' }
    }

    if ((data as InvokeBody)?.ok === false) {
      const errBody = data as InvokeErr
      return { ok: false, code: errBody.code, message: errBody.message }
    }

    return { ok: true, data }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur reseau'
    // eslint-disable-next-line no-console
    console.error(TAG, `${name} threw`, e)
    return { ok: false, code: 'NETWORK', message: msg }
  }
}

/** Mapping codes EF → messages FR humains. Code inconnu → message brut. */
function humanizeError(code: string | undefined, fallback: string | undefined): string {
  if (!code) return fallback ?? 'Erreur'
  const map: Record<string, string> = {
    UNAUTHENTICATED: 'Session expiree, reconnecte-toi.',
    NOT_HOST: 'Seul l\'hote peut faire ca.',
    NOT_LOBBY: 'La partie n\'est plus dans le lobby.',
    NOT_ENOUGH_PLAYERS: 'Il faut au moins un joueur par equipe.',
    INVALID_SCENARIO: 'Scenario non supporte.',
    INVALID_PAYLOAD: 'Action invalide.',
    GAME_NOT_FOUND: 'Partie introuvable.',
    NOT_IN_GAME: 'Tu n\'es pas dans cette partie.',
    NOT_IN_PROGRESS: 'La partie n\'est pas en cours.',
    NOT_ORDERS_PHASE: 'Phase d\'ordres terminee.',
    NOT_YOUR_TURN: 'Ce n\'est pas ton tour.',
    UNIT_NOT_FOUND: 'Unite introuvable.',
    UNIT_NOT_OWNED: 'Cette unite n\'est pas a toi.',
    UNIT_ROUTED: 'Unite en deroute, elle ne peut plus agir.',
    ALREADY_MOVED: 'Cette unite a deja bouge.',
    ALREADY_ATTACKED: 'Cette unite a deja attaque.',
    INVALID_MOVE: 'Mouvement impossible.',
    OUT_OF_BOARD: 'Hors du plateau.',
    OUT_OF_RANGE: 'Hors de portee.',
    NO_LINE_OF_SIGHT: 'Pas de ligne de vue.',
    INVALID_TARGET: 'Cible invalide.',
    GAME_FINISHED: 'Partie terminee.',
    // Phase 2 — sizing
    EFFECTIVE_TOO_LOW: 'Effectif trop faible pour cette operation.',
    TARGET_NOT_ADJACENT: 'La cible doit etre adjacente.',
    TARGET_OCCUPIED: 'Case cible deja occupee.',
    HAS_ATTACKED_ALREADY: 'Cette unite a deja attaque ce tour.',
    KIND_MISMATCH: 'Types d\'unites incompatibles pour fusion.',
    TEAM_MISMATCH: 'Camps differents, fusion impossible.',
    UNITS_NOT_ADJACENT: 'Les 2 unites doivent etre adjacentes.',
    EFFECTIVE_OVERFLOW: 'Effectif total depasse la capacite max.',
    CHARGE_NOT_ALLOWED: 'Terrain n\'autorise pas la charge.',
    // Phase 2.5 — cohésion / actions critiques
    COHESION_BROKEN: 'Unite brisee, elle ne peut plus attaquer en standard. Choisis Retraite, Reddition ou Combat suicide.',
    COHESION_NOT_BROKEN: 'Cette action est reservee aux unites brisees.',
    RETREAT_NO_FREE_NEIGHBOR: 'Aucune case libre adjacente pour la retraite. Tu peux te rendre ou tenter un combat suicide.',
    RETREAT_DEST_NOT_ADJACENT: 'La case de retraite doit etre adjacente.',
    RETREAT_DEST_OCCUPIED: 'La case de retraite est occupee.',
    SUICIDE_NOT_SURROUNDED: 'Combat suicide reserve aux unites totalement encerclees. Tu peux encore battre en retraite.',
    SUICIDE_CAMP_TOO_LOW: 'Ton camp est trop affaibli pour un sacrifice utile. La capitulation s\'impose.',
    INTERNAL: 'Erreur serveur, reessaie.',
    NETWORK: 'Probleme reseau.',
  }
  return map[code] ?? fallback ?? code
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useCombatActions(): UseCombatActionsResult {
  const [busy, setBusy] = useState(false)
  // Verrou : evite double-soumission concurrente meme si UI desactive le bouton tard
  const inFlightRef = useRef(false)

  const guarded = useCallback(
    async (fn: () => Promise<ActionResponse>): Promise<ActionResponse> => {
      if (inFlightRef.current) {
        return { ok: false, code: 'BUSY', message: 'Action en cours...' }
      }
      inFlightRef.current = true
      setBusy(true)
      try {
        return await fn()
      } finally {
        inFlightRef.current = false
        setBusy(false)
      }
    },
    []
  )

  const startBattle = useCallback(
    async (gameId: string): Promise<ActionResponse> => {
      return guarded(async () => {
        const res = await invokeEF('start_battle', { game_id: gameId })
        if (!res.ok) {
          toast.error(humanizeError(res.code, res.message))
        }
        return res
      })
    },
    [guarded]
  )

  const submitAction = useCallback(
    async (gameId: string, action: GameAction): Promise<ActionResponse> => {
      return guarded(async () => {
        const res = await invokeEF('resolve_action', {
          game_id: gameId,
          client_action_id: genUUID(),
          action,
        })
        if (!res.ok) {
          toast.error(humanizeError(res.code, res.message))
        }
        return res
      })
    },
    [guarded]
  )

  const endTurn = useCallback(
    async (
      gameId: string,
      scale: 'tactical' | 'operational' | 'strategic' = 'tactical'
    ): Promise<ActionResponse> => {
      return guarded(async () => {
        const res = await invokeEF('resolve_turn', {
          game_id: gameId,
          client_action_id: genUUID(),
          scale,
        })
        if (!res.ok) {
          toast.error(humanizeError(res.code, res.message))
        }
        return res
      })
    },
    [guarded]
  )

  return { busy, startBattle, submitAction, endTurn }
}
