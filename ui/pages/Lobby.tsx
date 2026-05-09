// v1.0b (09/05/2026) — Auto-redirect host vers /game quand un 2e joueur rejoint
// v1.0a (08/05/2026) — Sous-titre header plus grand
// v1.0 (08/05/2026) — Page Lobby : liste parties, creer/rejoindre, sync Realtime
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useRequireAuth } from '@hooks/useRequireAuth'
import { useGames } from '@hooks/useGames'
import { useRealtime } from '@hooks/useRealtime'
import { isHost, isPlayerInGame } from '@/types/game'
import { PageBackground } from '@ui/layout/PageBackground'
import { GameCard } from '@ui/lobby/GameCard'
import { CreateGameDialog } from '@ui/lobby/CreateGameDialog'
import { cn } from '@lib/cn'

const PRIMARY_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

type Tab = 'all' | 'mine'

export function Lobby() {
  const { user, loading: authLoading, signOut } = useRequireAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)

  const { games, loading, refresh, createGame, joinGame } = useGames(user?.id ?? null)

  // Realtime : tout changement de games/game_players → refresh la liste.
  // + presence sur le channel pour compter les officiers en ligne.
  useRealtime({
    channelName: 'lobby:public',
    enabled: !!user,
    postgresChanges: [
      { table: 'games', event: '*', onChange: () => void refresh() },
      { table: 'game_players', event: '*', onChange: () => void refresh() }
    ],
    presence: user
      ? {
          userId: user.id,
          onSync: state => setOnlineCount(Object.keys(state).length)
        }
      : undefined
  })

  const username =
    (user?.user_metadata?.username as string | undefined) ?? user?.email ?? 'Officier'

  const filteredGames = useMemo(() => {
    if (tab === 'all') return games
    return games.filter(
      g => isHost(g, user?.id ?? null) || isPlayerInGame(g.players, user?.id ?? null)
    )
  }, [games, tab, user?.id])

  const myCount = useMemo(
    () =>
      games.filter(
        g => isHost(g, user?.id ?? null) || isPlayerInGame(g.players, user?.id ?? null)
      ).length,
    [games, user?.id]
  )

  async function handleJoin(gameId: string) {
    const { error } = await joinGame(gameId)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Rejointe.')
    navigate(`/game/${gameId}`)
  }

  function handleView(gameId: string) {
    navigate(`/game/${gameId}`)
  }

  async function handleCreate(params: { name: string; maxPlayers: number }) {
    const result = await createGame(params)
    if (result.gameId && !result.error) {
      navigate(`/game/${result.gameId}`)
    }
    return result
  }

  // Auto-redirect : si une de mes parties passe a >= 2 joueurs (2e user a
  // rejoint), naviguer vers /game/:id. Tracker via ref pour eviter de re-navigate
  // au mount si la partie a deja 2+ joueurs (ex : retour depuis /game).
  const prevMyGamePlayersCount = useRef<Map<string, number>>(new Map())
  useEffect(() => {
    if (!user) return

    for (const game of games) {
      if (game.created_by !== user.id) continue
      const prev = prevMyGamePlayersCount.current.get(game.id) ?? game.players.length
      if (game.players.length > prev && game.players.length >= 2) {
        navigate(`/game/${game.id}`)
        return
      }
    }

    const next = new Map<string, number>()
    for (const game of games) {
      if (game.created_by === user.id) {
        next.set(game.id, game.players.length)
      }
    }
    prevMyGamePlayersCount.current = next
  }, [games, user, navigate])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative font-sans">
      <PageBackground />

      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <header className="relative flex items-center justify-between px-10 py-[18px] border-b border-[rgba(226,232,240,0.18)] bg-gradient-to-b from-[rgba(8,12,24,0.85)] to-transparent">
          <div className="text-[20px] font-bold tracking-[0.32em] text-foreground">
            TACTICA
            <span className="ml-3 align-middle font-serif italic font-normal text-[18px] tracking-[0.04em] text-tactica-amber">
              — Salle de commandement
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[12px] text-muted-foreground tracking-[0.05em]">
              Officier <strong className="text-foreground font-semibold">{username}</strong>
            </span>
            <button
              onClick={() => void signOut()}
              className="px-3 py-[7px] text-[11px] font-semibold uppercase tracking-[0.12em] bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-tactica-amber hover:bg-[rgba(226,232,240,0.06)] text-foreground rounded-[2px] transition-colors"
            >
              Quitter
            </button>
          </div>
          {/* liseré ambre sous header */}
          <div
            aria-hidden
            className="absolute left-10 right-10 -bottom-px h-px opacity-40"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, #EF9F27 25%, #EF9F27 75%, transparent 100%)'
            }}
          />
        </header>

        {/* Sub-header */}
        <div className="flex items-end justify-between gap-5 px-10 pt-9 pb-5 max-w-[1040px] w-full mx-auto">
          <div>
            <h1 className="font-serif italic text-[36px] font-medium m-0 leading-[1.1] text-foreground">
              Bataillons en attente
            </h1>
            <p className="mt-[6px] m-0 text-[13px] text-muted-foreground max-w-[520px]">
              Choisis une opération à rejoindre, ou ouvre ton propre champ de bataille.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="bg-tactica-amber hover:bg-[#ffb13d] text-[#1a1208] px-[22px] py-[11px] text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors shrink-0"
            style={{ clipPath: PRIMARY_BTN_CLIP }}
          >
            + Nouvelle opération
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-10 max-w-[1040px] w-full mx-auto border-b border-[rgba(226,232,240,0.18)]">
          <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
            Toutes les parties
            <Badge count={games.length} />
          </TabButton>
          <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
            Mes parties
            <Badge count={myCount} />
          </TabButton>
        </div>

        {/* Liste */}
        <main className="flex-1 px-10 pt-5 pb-20 max-w-[1040px] w-full mx-auto">
          {loading && games.length === 0 ? (
            <SkeletonList />
          ) : filteredGames.length === 0 ? (
            <EmptyState
              tab={tab}
              onCreate={() => setCreateOpen(true)}
            />
          ) : (
            filteredGames.map(g => (
              <GameCard
                key={g.id}
                game={g}
                currentUserId={user.id}
                onJoin={handleJoin}
                onView={handleView}
              />
            ))
          )}

          {/* Footer compteur */}
          <div className="max-w-[1040px] mx-auto pt-[14px] pb-5 mt-6 flex gap-6 justify-center text-[11px] text-muted-foreground tracking-[0.1em] uppercase border-t border-[rgba(226,232,240,0.10)]">
            <span className="inline-flex items-center">
              <span
                className="w-[7px] h-[7px] rounded-full bg-tactica-green mr-[7px] inline-block animate-pulse"
                style={{ boxShadow: '0 0 10px #97C459' }}
              />
              {games.length} {games.length > 1 ? 'opérations actives' : 'opération active'}
            </span>
            <span className="opacity-40">·</span>
            <span>
              {onlineCount} {onlineCount > 1 ? 'officiers en ligne' : 'officier en ligne'}
            </span>
          </div>
        </main>
      </div>

      <CreateGameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />
    </div>
  )
}

// ------ subcomponents -------

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-[18px] py-3 bg-transparent text-[12px] uppercase tracking-[0.12em] cursor-pointer border-b-2 border-transparent transition-colors',
        active ? 'text-tactica-amber border-tactica-amber' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function Badge({ count }: { count: number }) {
  return (
    <span className="ml-[6px] text-[10px] bg-tactica-amber/15 text-tactica-amber px-[6px] py-[2px] rounded-[8px] tracking-normal">
      {count}
    </span>
  )
}

function SkeletonList() {
  return (
    <div>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="h-[78px] mb-[10px] rounded-[2px] border border-[rgba(226,232,240,0.10)] bg-gradient-to-r from-[rgba(15,23,42,0.78)] via-[rgba(15,23,42,0.6)] to-[rgba(15,23,42,0.78)] bg-[length:200%_100%] animate-pulse"
        />
      ))}
    </div>
  )
}

function EmptyState({
  tab,
  onCreate
}: {
  tab: Tab
  onCreate: () => void
}) {
  return (
    <div className="text-center py-12 px-4 border border-dashed border-[rgba(226,232,240,0.18)] rounded-[2px] bg-[rgba(15,23,42,0.5)] backdrop-blur-[6px]">
      <p className="font-serif italic text-[18px] text-foreground mb-2">
        {tab === 'mine'
          ? 'Tu n\'es engagé dans aucune bataille.'
          : 'Aucune opération en attente.'}
      </p>
      <p className="text-[13px] text-muted-foreground mb-5">
        Lance la première : ton état-major t'attend.
      </p>
      <button
        onClick={onCreate}
        className="bg-tactica-amber hover:bg-[#ffb13d] text-[#1a1208] px-[22px] py-[11px] text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors"
        style={{ clipPath: PRIMARY_BTN_CLIP }}
      >
        + Nouvelle opération
      </button>
    </div>
  )
}
