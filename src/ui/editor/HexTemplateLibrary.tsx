// v1.3 (17/05/2026) — Card refondue : preview 3D composite + chips Texture/Assets + lightbox au click
// v1.2 (17/05/2026) — Feature : upload batch (input file multiple, queue, push 1-a-1 dans l'editeur)
// v1.1 (17/05/2026) — Fix : actions hisstees ici et passees au HexTemplateEditor (1 seul Realtime channel)

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useRequireAuth } from '@hooks/useRequireAuth'
import { useHexTemplates, type HexTemplate } from '@hooks/useHexTemplates'
import { useHexAssets, type HexAsset } from '@hooks/useHexAssets'
import { HexTemplateEditor } from './HexTemplateEditor'
import { HexPreview3D } from './HexPreview3D'

const MAX_BYTES = 4 * 1024 * 1024
const ACCEPTED_EXT = ['jpg', 'jpeg', 'png', 'webp']

const ADMIN_EMAIL = 'alsacevancreation@hotmail.com'

const PRIMARY_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

export function HexTemplateLibrary() {
  const { user, loading: authLoading } = useRequireAuth()
  const navigate = useNavigate()
  const { templates, loading, error, create, update, remove, uploadTexture } = useHexTemplates(!!user)
  const {
    assets: customAssets,
    byId: customAssetsById,
    create: createCustomAsset,
    remove: removeCustomAsset,
    uploadGLB,
  } = useHexAssets(!!user)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<HexTemplate | null>(null)
  // Queue batch upload : liste de Files restants a traiter + index courant (0-based).
  const [batchQueue, setBatchQueue] = useState<File[]>([])
  const [batchIndex, setBatchIndex] = useState(0)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  if (authLoading) return null
  if (!user) return null  // useRequireAuth gere la redirection
  if (user.email !== ADMIN_EMAIL) {
    return <Navigate to="/lobby" replace />
  }

  function openNew() {
    setEditTarget(null)
    setBatchQueue([])
    setBatchIndex(0)
    setEditorOpen(true)
  }

  function openEdit(t: HexTemplate) {
    setEditTarget(t)
    setBatchQueue([])
    setBatchIndex(0)
    setEditorOpen(true)
  }

  function handleUploadInput(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const valid: File[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const ext = (f.name.split('.').pop() ?? '').toLowerCase()
      if (!ACCEPTED_EXT.includes(ext)) {
        toast.error(`${f.name} : format non supporte`)
        continue
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name} : trop volumineux (max 4 MB)`)
        continue
      }
      valid.push(f)
    }
    e.target.value = ''
    if (valid.length === 0) return
    setEditTarget(null)
    setBatchQueue(valid)
    setBatchIndex(0)
    setEditorOpen(true)
  }

  function handleBatchSaved() {
    // Avance dans la queue. Si dernier traite, reset.
    setBatchIndex(i => {
      const next = i + 1
      if (next >= batchQueue.length) {
        setBatchQueue([])
        return 0
      }
      return next
    })
  }

  function handleEditorOpenChange(next: boolean) {
    setEditorOpen(next)
    if (!next) {
      // Fermeture (manuelle ou apres dernier batch) : reset queue.
      setBatchQueue([])
      setBatchIndex(0)
    }
  }

  async function handleDelete(t: HexTemplate) {
    if (!confirm(`Supprimer le template "${t.name}" ?`)) return
    try {
      await remove(t.id)
      toast.success('Supprime.')
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
              Editeur de terrain
            </div>
            <h1 className="m-0 font-serif italic text-[30px] font-medium tracking-[0.02em]">
              Bibliotheque de hex
            </h1>
            <p className="text-[13px] italic text-muted-foreground mt-1">
              {templates.length} template{templates.length > 1 ? 's' : ''} - Realtime sync actif.
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
              onClick={openNew}
              className="bg-transparent border border-tactica-amber hover:bg-tactica-amber/10 text-tactica-amber px-4 py-[9px] text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors rounded-[2px]"
            >
              + Nouveau (vide)
            </button>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="bg-tactica-amber hover:bg-[#ffb13d] text-[#1a1208] px-[22px] py-[11px] text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors"
              style={{ clipPath: PRIMARY_BTN_CLIP }}
            >
              + Upload textures (batch)
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleUploadInput}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground italic">Chargement...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="italic mb-3">Aucun template encore.</p>
            <p className="text-[12px]">Clique sur "Nouveau template" pour creer le premier.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {templates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                customAssetsById={customAssetsById}
                onEdit={() => openEdit(t)}
                onDelete={() => handleDelete(t)}
              />
            ))}
          </div>
        )}
      </div>

      <HexTemplateEditor
        open={editorOpen}
        onOpenChange={handleEditorOpenChange}
        template={editTarget}
        userId={user.id}
        onCreate={create}
        onUpdate={update}
        onUploadTexture={uploadTexture}
        customAssets={customAssets}
        customAssetsById={customAssetsById}
        onCreateCustomAsset={createCustomAsset}
        onRemoveCustomAsset={removeCustomAsset}
        onUploadGLB={uploadGLB}
        prefillFile={batchQueue.length > 0 ? (batchQueue[batchIndex] ?? null) : null}
        batchProgress={
          batchQueue.length > 0
            ? { current: batchIndex + 1, total: batchQueue.length }
            : null
        }
        onSaved={batchQueue.length > 0 ? handleBatchSaved : undefined}
      />
    </div>
  )
}

type LightboxMode = 'composite' | 'texture' | 'assets'

interface TemplateCardProps {
  template: HexTemplate
  customAssetsById: Map<string, HexAsset>
  onEdit: () => void
  onDelete: () => void
}

function TemplateCard({ template, customAssetsById, onEdit, onDelete }: TemplateCardProps) {
  const [lightbox, setLightbox] = useState<LightboxMode | null>(null)
  const assetsCount = template.assets_3d?.length ?? 0

  return (
    <>
      <div
        className="relative flex flex-col gap-2 p-3 transition-colors hover:border-tactica-amber"
        style={{
          background: 'rgba(20, 28, 50, 0.6)',
          border: '1px solid rgba(226, 232, 240, 0.12)',
          borderRadius: 2,
        }}
      >
        {/* Grand preview 3D composite */}
        <button
          type="button"
          onClick={() => setLightbox('composite')}
          className="block w-full cursor-zoom-in transition-opacity hover:opacity-90"
          title="Voir en grand"
          style={{ aspectRatio: '1 / 1' }}
        >
          <HexPreview3D
            textureUrl={template.texture_url}
            textureScale={template.texture_scale}
            textureMode={template.texture_mode}
            assets={template.assets_3d}
            customAssetsById={customAssetsById}
            size={220}
          />
        </button>

        <div className="text-[13px] font-medium text-foreground truncate">{template.name}</div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {template.texture_mode}{template.texture_mode === 'tile' && ` × ${template.texture_scale}`}
        </div>

        {/* Mini chips Texture / Assets */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLightbox('texture')}
            title="Voir la texture en grand"
            className="flex items-center gap-1.5 bg-[rgba(2,6,23,0.5)] border border-[rgba(226,232,240,0.15)] hover:border-tactica-amber rounded-[2px] px-1.5 py-1 transition-colors flex-1"
          >
            <img
              src={template.texture_url}
              alt="texture"
              className="w-7 h-7 object-cover rounded-[2px]"
              style={{ border: '1px solid rgba(226, 232, 240, 0.10)' }}
            />
            <span className="text-[9px] uppercase tracking-[0.10em] text-muted-foreground">Texture</span>
          </button>
          <button
            type="button"
            onClick={() => assetsCount > 0 && setLightbox('assets')}
            disabled={assetsCount === 0}
            title={assetsCount > 0 ? 'Voir les assets en grand' : 'Aucun asset'}
            className="flex items-center gap-1.5 bg-[rgba(2,6,23,0.5)] border border-[rgba(226,232,240,0.15)] hover:border-tactica-amber disabled:opacity-40 disabled:cursor-not-allowed rounded-[2px] px-1.5 py-1 transition-colors flex-1"
          >
            <span className="w-7 h-7 flex items-center justify-center text-[14px]">🎨</span>
            <span className="text-[9px] uppercase tracking-[0.10em] text-muted-foreground">
              Assets ({assetsCount})
            </span>
          </button>
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

      <TemplateLightbox
        mode={lightbox}
        template={template}
        customAssetsById={customAssetsById}
        onClose={() => setLightbox(null)}
      />
    </>
  )
}

interface TemplateLightboxProps {
  mode: LightboxMode | null
  template: HexTemplate
  customAssetsById: Map<string, HexAsset>
  onClose: () => void
}

function TemplateLightbox({ mode, template, customAssetsById, onClose }: TemplateLightboxProps) {
  return (
    <Dialog.Root open={mode !== null} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(2,6,23,0.85)] backdrop-blur-[6px] animate-fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none animate-fade-in"
          style={{
            background: 'rgba(20, 28, 50, 0.94)',
            border: '1px solid #EF9F27',
            borderRadius: 2,
            padding: 24,
          }}
        >
          <Dialog.Title asChild>
            <div className="mb-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber mb-1">
                {mode === 'composite' && 'Aperçu composite'}
                {mode === 'texture' && 'Aperçu texture'}
                {mode === 'assets' && 'Aperçu assets 3D'}
              </div>
              <h2 className="m-0 font-serif italic text-[20px] font-medium text-foreground tracking-[0.02em]">
                {template.name}
              </h2>
            </div>
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Aperçu agrandi du template "{template.name}".
          </Dialog.Description>

          {mode === 'texture' && (
            <img
              src={template.texture_url}
              alt={template.name}
              style={{ width: 560, height: 560, objectFit: 'contain', borderRadius: 2 }}
            />
          )}
          {(mode === 'composite' || mode === 'assets') && (
            <HexPreview3D
              textureUrl={mode === 'composite' ? template.texture_url : null}
              textureScale={template.texture_scale}
              textureMode={template.texture_mode}
              assets={template.assets_3d}
              customAssetsById={customAssetsById}
              size={560}
              placeholderHex={mode === 'assets'}
            />
          )}

          <Dialog.Close asChild>
            <button
              type="button"
              className="mt-3 w-full bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-tactica-amber text-muted-foreground hover:text-foreground px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors rounded-[2px]"
            >
              Fermer
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
