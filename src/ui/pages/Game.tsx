// v2.0a (09/05/2026) — Lot 7 : badge online/offline dans footer sidebar
// v2.0 (09/05/2026) — Layout 3 zones : header + scene 3D centrale + sidebar equipes droite
// v1.0a (08/05/2026) — Sous-titre header plus grand
// v1.0 (08/05/2026) — Page Game placeholder : 2 panneaux equipes + actions
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useRequireAuth } from '@hooks/useRequireAuth'
import { useGame } from '@hooks/useGame'
import { useRealtime } from '@hooks/useRealtime'
import { useOnlineStatus } from '@hooks/useOnlineStatus'
import {
  isHost,
  isPlayerInGame,
  deriveSlotAssignment,
} from '@/types/game'
import { PageBackground } from '@ui/layout/PageBackground'
import { TeamPanel, type SlotData } from '@ui/game/TeamPanel'
import { TacticalScene, buildMvpUnitPlacement } from '@/render'
import { spiral } from '@engine/hex'
import { cn } from '@lib/cn'

const PRIMARY_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

// MVP-Plaine : disque hex rayon 5 (91 hex) centre origine
const MVP_CUBES = spiral({ q: 0, r: 0, s: 0 }, 5)

export function Game() {
  const { id: gameId } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useRequireAuth()
  const navigate = useNavigate()

  const { game, players, loading, notFound, refresh, leaveGame, kickPlayer, deleteGame } =
    useGame(gameId, user?.id ?? null)

  const [busy, setBusy] = useState(false)

  useRealtime({
    channelName: gameId ? `game:${gameId}` : '',
    enabled: !!gameId && !!user,
    postgresChanges: gameId
      ? [
          {
            table: 'games',
            event: 'UPDATE',
            filter: `id=eq.${gameId}`,
            onChange: () => void refresh(),
          },
          {
            table: 'games',
            event: 'DELETE',
            filter: `id=eq.${gameId}`,
            onChange: () => {
              toast.error("L'hôte a dissous la partie.")
              navigate('/lobby')
            },
          },
          {
            table: 'game_players',
            event: '*',
            filter: `game_id=eq.${gameId}`,
            onChange: () => void refresh(),
          },
        ]
      : undefined,
  })

  useEffect(() => {
    if (loading || authLoading || !user) return
    if (notFound) {
      toast.error('Partie introuvable.')
      navigate('/lobby')
      return
    }
    if (game && !isHost(game, user.id) && !isPlayerInGame(players, user.id)) {
      toast.error("Tu n'es pas dans cette partie. Reviens depuis le lobby pour la rejoindre.")
      navigate('/lobby')
    }
  }, [loading, authLoading, user, notFound, game, players, navigate])

  const slots = useMemo<SlotData[]>(() => {
    if (!game) return []
    const out: SlotData[] = []
    for (let i = 0; i < game.max_players; i++) {
      const { team, role } = deriveSlotAssignment(i)
      const player = players.find(p => p.slot_index === i) ?? null
      out.push({ index: i, team, role, player })
    }
    return out
  }, [game, players])

  const blueSlots = useMemo(() => slots.filter(s => s.team === 'blue'), [slots])
  const redSlots = useMemo(() => slots.filter(s => s.team === 'red'), [slots])

  // Phase 0 : 6 unites factices (3 vs 3, 1 de chaque type par equipe)
  const units = useMemo(() => buildMvpUnitPlacement(), [])

  const online = useOnlineStatus()

  const iAmHost = !!game && isHost(game, user?.id ?? null)
  const iAmIn = isPlayerInGame(players, user?.id ?? null)

  async function handleLeave() {
    if (!user || busy) return
    if (iAmHost) {
      const ok = window.confirm(
        "Tu es l'hôte. Quitter va dissoudre la partie pour tous les joueurs. Continuer ?"
      )
      if (!ok) return
      setBusy(true)
      const { error } = await deleteGame()
      setBusy(false)
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Partie dissoute.')
      navigate('/lobby')
    } else {
      setBusy(true)
      const { error } = await leaveGame()
      setBusy(false)
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Tu as quitté la partie.')
      navigate('/lobby')
    }
  }

  async function handleKick(playerId: string) {
    if (!iAmHost || busy) return
    setBusy(true)
    const { error } = await kickPlayer(playerId)
    setBusy(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Officier renvoyé.')
  }

  if (authLoading || !user || loading || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  const hostUserId = game.created_by
  const scaleLabel =
    game.current_scale === 'tactical'
      ? 'Échelle tactique'
      : game.current_scale === 'operational'
        ? 'Échelle opérationnelle'
        : 'Échelle stratégique'

  return (
    <div className="h-screen relative font-sans flex flex-col overflow-hidden">
      <PageBackground />

      <header className="relative flex items-center justify-between px-10 py-[18px] border-b border-[rgba(226,232,240,0.18)] bg-gradient-to-b from-[rgba(8,12,24,0.85)] to-transparent shrink-0">
        <div className="flex items-center gap-[18px]">
          <button
            onClick={() => navigate('/lobby')}
            className="bg-transparent border-none text-muted-foreground hover:text-tactica-amber px-2 py-[6px] text-[12px] uppercase tracking-[0.12em] cursor-pointer transition-colors"
          >
            ← Salle de commandement
          </button>
          <div className="text-[20px] font-bold tracking-[0.32em] text-foreground">
            TACTICA
            <span className="ml-3 align-middle font-serif italic font-normal text-[18px] tracking-[0.04em] text-tactica-amber">
              — Brief
            </span>
          </div>
        </div>
        <span className="text-[12px] text-muted-foreground tracking-[0.05em]">
          Officier{' '}
          <strong className="text-foreground font-semibold">
            {(user.user_metadata?.username as string | undefined) ?? user.email ?? 'soldat'}
          </strong>
        </span>
        <div
          aria-hidden
          className="absolute left-10 right-10 -bottom-px h-px opacity-40"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, #EF9F27 25%, #EF9F27 75%, transparent 100%)',
          }}
        />
      </header>

      <div className="flex flex-1 min-h-0">

        <div className="flex-1 flex flex-col min-w-0">

          <div className="px-10 py-5 border-b border-[rgba(226,232,240,0.10)] shrink-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber mb-[4px]">
              Ordre de bataille — {game.status === 'lobby' ? 'En attente' : game.status}
            </div>
            <h1 className="font-serif italic text-[28px] font-medium m-0 leading-[1.1] text-foreground">
              {game.name}
            </h1>
            <div className="text-muted-foreground text-[10px] uppercase tracking-[0.08em] flex flex-wrap gap-x-[12px] gap-y-1 mt-1">
              <span>{game.scenario_id ?? '—'}</span>
              <span className="opacity-40">/</span>
              <span>{scaleLabel}</span>
              <span className="opacity-40">/</span>
              <span>Hôte : {players.find(p => p.user_id === hostUserId)?.username ?? '...'}</span>
              <span className="opacity-40">/</span>
              <span>Tour {game.turn_number}</span>
            </div>
          </div>

          <div className="flex-1 relative min-h-0">
            <TacticalScene
              scale={game.current_scale}
              cubes={MVP_CUBES}
              units={units}
            />
            <div className="absolute bottom-3 left-3 px-3 py-2 bg-[rgba(15,23,42,0.85)] backdrop-blur-[6px] border border-[rgba(226,232,240,0.18)] rounded-[2px] text-[10px] text-muted-foreground tracking-[0.05em] uppercase pointer-events-none">
              <div>Drag : rotation · Drag droit : pan · Molette : zoom</div>
            </div>
          </div>
        </div>

        <aside className="w-[340px] shrink-0 border-l border-[rgba(226,232,240,0.18)] bg-[rgba(8,12,24,0.7)] backdrop-blur-[2px] flex flex-col">

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <TeamPanel
              team="blue"
              slots={blueSlots}
              hostUserId={hostUserId}
              currentUserId={user.id}
              canKick={iAmHost}
              onKick={handleKick}
              compact
            />
            <TeamPanel
              team="red"
              slots={redSlots}
              hostUserId={hostUserId}
              currentUserId={user.id}
              canKick={iAmHost}
              onKick={handleKick}
              compact
            />
          </div>

          <div className="relative p-4 border-t border-[rgba(226,232,240,0.18)] bg-[rgba(15,23,42,0.85)]">
            <div
              aria-hidden
              className="absolute top-[-1px] left-3 right-3 h-px opacity-40"
              style={{ background: 'linear-gradient(90deg, transparent, #EF9F27, transparent)' }}
            />
            <Bracket position="tl" />
            <Bracket position="tr" />
            <Bracket position="bl" />
            <Bracket position="br" />

            <div className="flex items-center justify-between mb-3">
              <div className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
                <strong className="text-foreground font-semibold">
                  {players.length} / {game.max_players} officiers
                </strong>
                {' · '}
                {players.length < game.max_players ? 'en attente' : 'effectif complet'}
              </div>
              <span
                className="flex items-center gap-[6px] text-[10px] uppercase tracking-[0.12em]"
                title={online ? 'Connecté au serveur' : 'Hors ligne — Realtime indisponible'}
              >
                <span
                  aria-hidden
                  className={cn(
                    'w-[7px] h-[7px] rounded-full shrink-0',
                    online ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'
                  )}
                />
                <span className={online ? 'text-muted-foreground' : 'text-red-400'}>
                  {online ? 'En ligne' : 'Hors ligne'}
                </span>
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="relative group">
                <button
                  disabled
                  className="w-full bg-tactica-amber/20 text-tactica-amber/40 cursor-not-allowed px-4 py-[10px] text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ clipPath: PRIMARY_BTN_CLIP }}
                >
                  Engager la bataille
                </button>
                <span className="absolute bottom-full right-0 mb-[6px] whitespace-nowrap text-[10px] uppercase tracking-[0.12em] bg-[rgba(8,12,24,0.95)] border border-tactica-amber px-[10px] py-[6px] rounded-[2px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Disponible Phase 1
                </span>
              </span>

              <button
                onClick={handleLeave}
                disabled={busy || !iAmIn}
                className="bg-transparent border border-destructive/50 text-destructive hover:bg-destructive hover:text-white disabled:opacity-50 disabled:cursor-not-allowed px-3 py-[7px] text-[11px] font-semibold uppercase tracking-[0.12em] rounded-[2px] transition-colors"
              >
                {iAmHost ? 'Dissoudre la partie' : 'Quitter la bataille'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Bracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const cls = {
    tl: 'top-1 left-1 border-r-0 border-b-0',
    tr: 'top-1 right-1 border-l-0 border-b-0',
    bl: 'bottom-1 left-1 border-r-0 border-t-0',
    br: 'bottom-1 right-1 border-l-0 border-t-0',
  }[position]
  return (
    <span
      aria-hidden
      className={cn('absolute w-[10px] h-[10px] border border-tactica-amber opacity-50', cls)}
    />
  )
}
