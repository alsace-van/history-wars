// v1.0 (17/05/2026) — Phase 5 Lot B (extension) : page liste des cartes sauvegardees
// Route /editor/maps. Guard email-based : seul alsacevancreation peut acceder.
// Grid des maps + bouton "+ Nouvelle carte" + boutons editer/supprimer.

import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useRequireAuth } from '@hooks/useRequireAuth'
import { useHexMaps, type HexMap } from '@hooks/useHexMaps'

const ADMIN_EMAIL = 'alsacevancreation@hotmail.com'

const PRIMARY_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

export function MapsList() {
  const { user, loading: authLoading } = useRequireAuth()
  const navigate = useNavigate()
  const { maps, loading, error, create, remove } = useHexMaps(!!user)

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  if (authLoading) return null
  if (!user) return null
  if (user.email !== ADMIN_EMAIL) return <Navigate to="/lobby" replace />

  async function handleNew() {
    const name = window.prompt('Nom de la nouvelle carte :', 'Ma carte')?.trim()
    if (!name) return
    try {
      const created = await create({
        created_by: user!.id,
        name,
        radius: 7,
        tiles: {},
        props: [],
        preview_url: null,
      })
      toast.success('Carte creee.')
      navigate(`/editor/map/${created.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Echec creation'
      toast.error(msg)
    }
  }

  async function handleDelete(m: HexMap) {
    if (!confirm(`Supprimer la carte "${m.name}" ?`)) return
    try {
      await remove(m.id)
      toast.success('Supprimee.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Echec suppression'
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-8 py-10">
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber mb-1">
              Editeur de cartes
            </div>
            <h1 className="m-0 font-serif italic text-[30px] font-medium tracking-[0.02em]">
              Mes cartes
            </h1>
            <p className="text-[13px] italic text-muted-foreground mt-1">
              {maps.length} carte{maps.length > 1 ? 's' : ''} sauvegardee{maps.length > 1 ? 's' : ''}.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/lobby')}
              className="bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-tactica-amber text-muted-foreground hover:text-foreground px-4 py-[9px] text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors rounded-[2px]"
            >
              Retour lobby
            </button>
            <button
              type="button"
              onClick={() => navigate('/editor/hex-templates')}
              className="bg-transparent border border-tactica-amber hover:bg-tactica-amber/10 text-tactica-amber px-4 py-[9px] text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors rounded-[2px]"
            >
              Bibliotheque hex
            </button>
            <button
              type="button"
              onClick={handleNew}
              className="bg-tactica-amber hover:bg-[#ffb13d] text-[#1a1208] px-[22px] py-[11px] text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors"
              style={{ clipPath: PRIMARY_BTN_CLIP }}
            >
              + Nouvelle carte
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground italic">Chargement...</div>
        ) : maps.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="italic mb-3">Aucune carte encore.</p>
            <p className="text-[12px]">Clique sur "Nouvelle carte" pour creer la premiere.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {maps.map(m => (
              <MapCard key={m.id} map={m} onEdit={() => navigate(`/editor/map/${m.id}`)} onDelete={() => handleDelete(m)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface MapCardProps {
  map: HexMap
  onEdit: () => void
  onDelete: () => void
}

function MapCard({ map, onEdit, onDelete }: MapCardProps) {
  const tilesCount = Object.keys(map.tiles).length
  return (
    <div
      className="flex flex-col gap-2 p-3 transition-colors hover:border-tactica-amber"
      style={{
        background: 'rgba(20, 28, 50, 0.6)',
        border: '1px solid rgba(226, 232, 240, 0.12)',
        borderRadius: 2,
      }}
    >
      <div
        className="flex items-center justify-center text-[40px]"
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          background: 'rgba(2, 6, 23, 0.5)',
          border: '1px solid rgba(226, 232, 240, 0.08)',
          borderRadius: 2,
        }}
      >
        🗺
      </div>
      <div className="text-[13px] font-medium text-foreground truncate">{map.name}</div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        rayon {map.radius} - {tilesCount} hex peint{tilesCount > 1 ? 's' : ''}
      </div>
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-tactica-amber hover:text-tactica-amber text-foreground px-3 py-[6px] text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors rounded-[2px]"
        >
          Editer
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-red-500 hover:text-red-400 text-muted-foreground px-3 py-[6px] text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors rounded-[2px]"
        >
          Suppr.
        </button>
      </div>
    </div>
  )
}
