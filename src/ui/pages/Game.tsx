// v1.0 (08/05/2026) — Page Game placeholder : 2 panneaux equipes + actions
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useRequireAuth } from '@hooks/useRequireAuth'
import { useGame } from '@hooks/useGame'
import { useRealtime } from '@hooks/useRealtime'
import {
  type GamePlayerWithProfile,
  type PlayerRole,
  type Team,
  isHost,
  isPlayerInGame,
  deriveSlotAssignment
} from '@/types/game'
import { PageBackground } from '@ui/layout/PageBackground'
import { PlayerSlot, EmptyPlayerSlot } from '@ui/game/PlayerSlot'
import { cn } from '@lib/cn'

const PRIMARY_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

interface SlotData {
  index: number
  team: Team
  role: PlayerRole
  player: GamePlayerWithProfile | null
}

export function Game() {
  const { id: gameId } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useRequireAuth()
  const navigate = useNavigate()

  const { game, players, loading, notFound, refresh, leaveGame, kickPlayer, deleteGame } =
    useGame(gameId, user?.id ?? null)

  const [busy, setBusy] = useState(false)

  // Realtime : tout changement sur cette partie ou ses players → refresh
  useRealtime({
    channelName: gameId ? `game:${gameId}` : '',
    enabled: !!gameId && !!user,
    postgresChanges: gameId
      ? [
          {
            table: 'games',
            event: 'UPDATE',
            filter: `id=eq.${gameId}`,
            onChange: () => void refresh()
          },
          {
            table: 'games',
            event: 'DELETE',
            filter: `id=eq.${gameId}`,
            onChange: () => {
              toast.error("L'hôte a dissous la partie.")
              navigate('/lobby')
            }
          },
          {
            table: 'game_players',
            event: '*',
            filter: `game_id=eq.${gameId}`,
            onChange: () => void refresh()
          }
        ]
      : undefined
  })

  // Si la partie n'existe pas ou que je n'y suis pas, retour au lobby
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

  // Construit le tableau des slots (vides + remplis) selon max_players
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

  const iAmHost = !!game && isHost(game, user?.id ?? null)
  const iAmIn = isPlayerInGame(players, user?.id ?? null)

  async function handleLeave() {
    if (!user || busy) return
    if (iAmHost) {
      const ok = window.confirm(
        'Tu es l\'hôte. Quitter va dissoudre la partie pour tous les joueurs. Continuer ?'
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

  // États de chargement / non-prêt : on retourne tot
  if (authLoading || !user || loading || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  const hostUserId = game.created_by
  const ago = formatRelative(game.created_at)
  const scaleLabel = game.current_scale === 'tactical' ? 'Échelle tactique' :
    game.current_scale === 'operational' ? 'Échelle opérationnelle' : 'Échelle stratégique'

  return (
    <div className="min-h-screen relative font-sans">
      <PageBackground />

      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <header className="relative flex items-center justify-between px-10 py-[18px] border-b border-[rgba(226,232,240,0.18)] bg-gradient-to-b from-[rgba(8,12,24,0.85)] to-transparent">
          <div className="flex items-center gap-[18px]">
            <button
              onClick={() => navigate('/lobby')}
              className="bg-transparent border-none text-muted-foreground hover:text-tactica-amber px-2 py-[6px] text-[12px] uppercase tracking-[0.12em] cursor-pointer transition-colors"
            >
              ← Salle de commandement
            </button>
            <div className="text-[20px] font-bold tracking-[0.32em] text-foreground">
              TACTICA
              <span className="ml-2 align-middle font-serif italic font-normal text-[12px] tracking-[0.05em] text-tactica-amber">
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
                'linear-gradient(90deg, transparent 0%, #EF9F27 25%, #EF9F27 75%, transparent 100%)'
            }}
          />
        </header>

        {/* Container principal */}
        <main className="max-w-[880px] w-full mx-auto px-10 pt-9 pb-16 flex-1">

          {/* Game header */}
          <div className="mb-7 pb-[18px] border-b border-[rgba(226,232,240,0.10)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber mb-[6px]">
              Ordre de bataille — {game.status === 'lobby' ? 'En attente' : game.status}
            </div>
            <h1 className="font-serif italic text-[38px] font-medium m-0 mb-2 leading-[1.05] text-foreground">
              {game.name}
            </h1>
            <div className="text-muted-foreground text-[11px] uppercase tracking-[0.08em] flex flex-wrap gap-x-[14px] gap-y-1">
              <span>{game.scenario_id ?? '—'}</span>
              <span className="opacity-40">/</span>
              <span>{scaleLabel}</span>
              <span className="opacity-40">/</span>
              <span>Hôte : {players.find(p => p.user_id === hostUserId)?.username ?? '...'}</span>
              <span className="opacity-40">/</span>
              <span>Tour {game.turn_number} — Briefing à venir</span>
              <span className="opacity-40">/</span>
              <span>Créée {ago}</span>
            </div>
          </div>

          {/* 2 colonnes équipes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px] mb-7">
            <TeamPanel
              team="blue"
              slots={blueSlots}
              hostUserId={hostUserId}
              currentUserId={user.id}
              canKick={iAmHost}
              onKick={handleKick}
            />
            <TeamPanel
              team="red"
              slots={redSlots}
              hostUserId={hostUserId}
              currentUserId={user.id}
              canKick={iAmHost}
              onKick={handleKick}
            />
          </div>

          {/* Footer actions */}
          <div className="relative flex flex-wrap items-center justify-between gap-[14px] px-[22px] py-[18px] bg-[rgba(15,23,42,0.78)] backdrop-blur-[6px] border border-[rgba(226,232,240,0.18)] rounded-[2px]">
            {/* Liseré ambre top */}
            <div
              aria-hidden
              className="absolute top-[-1px] left-5 right-5 h-px opacity-40"
              style={{
                background:
                  'linear-gradient(90deg, transparent, #EF9F27, transparent)'
              }}
            />
            {/* Brackets décoratifs */}
            <Bracket position="tl" />
            <Bracket position="tr" />
            <Bracket position="bl" />
            <Bracket position="br" />

            <div className="text-muted-foreground text-[11px] uppercase tracking-[0.12em]">
              <strong className="text-foreground font-semibold">
                {players.length} / {game.max_players} officiers
              </strong>
              {' · '}
              {players.length < game.max_players
                ? 'en attente de renforts'
                : 'effectif complet'}
            </div>

            <div className="flex gap-[10px] items-center">
              <button
                onClick={handleLeave}
                disabled={busy || !iAmIn}
                className="bg-transparent border border-destructive/50 text-destructive hover:bg-destructive hover:text-white disabled:opacity-50 disabled:cursor-not-allowed px-3 py-[7px] text-[11px] font-semibold uppercase tracking-[0.12em] rounded-[2px] transition-colors"
              >
                {iAmHost ? 'Dissoudre la partie' : 'Quitter la bataille'}
              </button>

              <span className="relative group">
                <button
                  disabled
                  className="bg-tactica-amber/20 text-tactica-amber/40 cursor-not-allowed px-[24px] py-[11px] text-[12px] font-semibold uppercase tracking-[0.12em]"
                  style={{ clipPath: PRIMARY_BTN_CLIP }}
                >
                  Engager la bataille
                </button>
                <span
                  className="absolute bottom-full right-0 mb-[6px] whitespace-nowrap text-[10px] uppercase tracking-[0.12em] bg-[rgba(8,12,24,0.95)] border border-tactica-amber px-[10px] py-[6px] rounded-[2px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                >
                  Disponible Phase 1
                </span>
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

// ------ subcomponents ------

interface TeamPanelProps {
  team: Team
  slots: SlotData[]
  hostUserId: string
  currentUserId: string
  canKick: boolean
  onKick: (playerId: string) => void
}

function TeamPanel({
  team,
  slots,
  hostUserId,
  currentUserId,
  canKick,
  onKick
}: TeamPanelProps) {
  const filled = slots.filter(s => s.player !== null).length
  const total = slots.length
  const titleColor = team === 'blue' ? 'text-tactica-blue-bright' : 'text-tactica-red-bright'
  const borderTopColor =
    team === 'blue' ? 'border-t-tactica-blue-bright' : 'border-t-tactica-red-bright'
  const teamLabel = team === 'blue' ? 'État-Major Bleu' : 'État-Major Rouge'
  const teamSub = team === 'blue' ? 'Alliés' : 'Adversaires'

  return (
    <div
      className={cn(
        'p-5 bg-[rgba(15,23,42,0.78)] backdrop-blur-[6px] border border-[rgba(226,232,240,0.18)] border-t-[3px] rounded-[2px]',
        borderTopColor
      )}
    >
      <div className="flex items-center justify-between mb-[14px]">
        <div className={cn('flex items-center gap-[10px] font-serif italic font-medium text-[18px] tracking-[0.03em]', titleColor)}>
          {teamLabel}
          <span className="font-sans not-italic text-[9px] tracking-[0.2em] uppercase text-muted-foreground font-semibold">
            · {teamSub}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
          {filled} / {total}
        </span>
      </div>

      {slots.map(s =>
        s.player ? (
          <PlayerSlot
            key={s.index}
            player={s.player}
            isCurrentUser={s.player.user_id === currentUserId}
            isHost={s.player.user_id === hostUserId}
            canKick={canKick && s.player.user_id !== currentUserId}
            onKick={onKick}
          />
        ) : (
          <EmptyPlayerSlot key={s.index} role={s.role} />
        )
      )}
    </div>
  )
}

function Bracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const cls = {
    tl: 'top-1 left-1 border-r-0 border-b-0',
    tr: 'top-1 right-1 border-l-0 border-b-0',
    bl: 'bottom-1 left-1 border-r-0 border-t-0',
    br: 'bottom-1 right-1 border-l-0 border-t-0'
  }[position]
  return (
    <span
      aria-hidden
      className={cn(
        'absolute w-[10px] h-[10px] border border-tactica-amber opacity-50',
        cls
      )}
    />
  )
}

// ------ helpers ------

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}
