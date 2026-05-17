// v1.5 (17/05/2026) — Fix : actions hex_assets recues en props (evite 2x channel "hex_assets:all")
// v1.4 (17/05/2026) — Phase 5 Lot B.4-bis : consomme useHexAssets, wire-up custom GLB upload + dispatch
// v1.3 (17/05/2026) — Phase 5 Lot B.4 : section Assets 3D (palette + liste editable + persist JSONB)
// v1.2 (17/05/2026) — Feature batch : prefillFile + batchProgress + onSaved ; bouton "Suivant" en batch

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { HexPreview3D } from './HexPreview3D'
import { TexturePicker } from './TexturePicker'
import { AssetPalette } from './AssetPalette'
import type { AssetKind, HexTemplate, HexTemplateDraft, PlacedAsset } from '@hooks/useHexTemplates'
import type { HexAsset, HexAssetDraft } from '@hooks/useHexAssets'

const MODAL_CLIP = 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)'
const PRIMARY_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

interface HexTemplateEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = mode creation. HexTemplate = mode edition. */
  template: HexTemplate | null
  /** User connecte (pour created_by + upload path). Toujours present quand l'editeur est ouvert. */
  userId: string
  /** Actions injectees par le parent (qui detient le hook useHexTemplates). */
  onCreate: (draft: HexTemplateDraft) => Promise<HexTemplate>
  onUpdate: (id: string, patch: Partial<HexTemplateDraft>) => Promise<HexTemplate>
  onUploadTexture: (file: File, userId: string, templateId: string) => Promise<string>
  /** Mode batch : fichier a pre-charger comme texture en attente. Override pendingFile au mount. */
  prefillFile?: File | null
  /** Mode batch : progression { current: index 1-based, total } pour afficher "2 / 5" en header. */
  batchProgress?: { current: number; total: number } | null
  /** Appele apres sauvegarde reussie (mode batch : permet au parent de pousser le suivant). */
  onSaved?: () => void
  /** Bibliotheque des GLB custom uploades (resolus par le parent qui detient useHexAssets). */
  customAssets: HexAsset[]
  customAssetsById: Map<string, HexAsset>
  onCreateCustomAsset: (draft: HexAssetDraft) => Promise<HexAsset>
  onRemoveCustomAsset: (id: string) => Promise<void>
  onUploadGLB: (file: File, userId: string, assetId: string) => Promise<string>
}

interface FormState {
  name: string
  scale: number
  mode: 'stretch' | 'tile'
}

const DEFAULT_FORM: FormState = { name: '', scale: 1, mode: 'stretch' }

export function HexTemplateEditor({
  open,
  onOpenChange,
  template,
  userId,
  onCreate,
  onUpdate,
  onUploadTexture,
  prefillFile = null,
  batchProgress = null,
  onSaved,
  customAssets,
  customAssetsById,
  onCreateCustomAsset,
  onRemoveCustomAsset,
  onUploadGLB,
}: HexTemplateEditorProps) {
  const inBatch = !!batchProgress
  const hasMoreInBatch = !!batchProgress && batchProgress.current < batchProgress.total
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null)
  const [assets, setAssets] = useState<PlacedAsset[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (template) {
      setForm({
        name: template.name,
        scale: template.texture_scale,
        mode: template.texture_mode,
      })
      setAssets(template.assets_3d ?? [])
      setPendingFile(null)
      setPendingDataUrl(null)
      return
    }
    // Mode creation : reset form. Si prefillFile (batch), pre-charger comme texture en attente.
    // Nom propose = basename du fichier sans extension (l'user peut l'ecraser).
    setForm({
      ...DEFAULT_FORM,
      name: prefillFile ? prefillFile.name.replace(/\.[^.]+$/, '') : '',
    })
    setAssets([])
    if (prefillFile) {
      const reader = new FileReader()
      reader.onload = () => {
        setPendingFile(prefillFile)
        setPendingDataUrl(reader.result as string)
      }
      reader.readAsDataURL(prefillFile)
    } else {
      setPendingFile(null)
      setPendingDataUrl(null)
    }
  }, [open, template, prefillFile])

  const displayUrl = pendingDataUrl ?? template?.texture_url ?? null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Donne un nom au template.')
      return
    }
    if (!template && !pendingFile) {
      toast.error('Choisis une texture.')
      return
    }
    setSubmitting(true)
    try {
      if (template) {
        let textureUrl = template.texture_url
        if (pendingFile) {
          textureUrl = await onUploadTexture(pendingFile, userId, template.id)
        }
        await onUpdate(template.id, {
          name: form.name.trim(),
          texture_url: textureUrl,
          texture_scale: form.scale,
          texture_mode: form.mode,
          assets_3d: assets,
        })
        toast.success('Template mis a jour.')
      } else {
        const newId = crypto.randomUUID()
        const textureUrl = await onUploadTexture(pendingFile!, userId, newId)
        await onCreate({
          id: newId,
          created_by: userId,
          name: form.name.trim(),
          texture_url: textureUrl,
          texture_scale: form.scale,
          texture_mode: form.mode,
          assets_3d: assets,
          preview_url: null,
        })
        toast.success('Template cree.')
      }
      // Mode batch : notifier le parent qui poussera le fichier suivant. La modale reste ouverte
      // tant qu'il reste des fichiers. Sinon, fermer normalement.
      onSaved?.()
      if (!hasMoreInBatch) {
        onOpenChange(false)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Echec sauvegarde'
      toast.error(msg)
      // eslint-disable-next-line no-console
      console.error('[HexTemplateEditor]', 'submit failed', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(2,6,23,0.78)] backdrop-blur-[6px] animate-fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-[720px] -translate-x-1/2 -translate-y-1/2 px-8 pt-8 pb-7 outline-none animate-slide-up"
          style={{
            background: 'rgba(20, 28, 50, 0.94)',
            border: '1px solid #EF9F27',
            clipPath: MODAL_CLIP,
            boxShadow:
              '0 0 0 4px rgba(8, 12, 24, 0.5), 0 30px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(239, 159, 39, 0.10)',
          }}
        >
          <Dialog.Title asChild>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber mb-1">
                Editeur de hex{inBatch ? ` — batch ${batchProgress.current} / ${batchProgress.total}` : ''}
              </div>
              <h2 className="m-0 font-serif italic text-[24px] font-medium text-foreground tracking-[0.02em]">
                {template ? 'Modifier le template' : 'Nouveau template'}
              </h2>
            </div>
          </Dialog.Title>
          <Dialog.Description className="mt-1 mb-5 text-[12px] italic text-muted-foreground">
            {inBatch
              ? `Renseigne ce template puis passe au suivant. ${batchProgress.total - batchProgress.current} restant${batchProgress.total - batchProgress.current > 1 ? 's' : ''} apres celui-ci.`
              : 'Texture personnalisee + parametres de tiling.'}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="grid grid-cols-[1fr_300px] gap-6">
            {/* Colonne formulaire */}
            <div className="space-y-4">
              <div>
                <label className="block mb-[7px] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Nom
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
                  maxLength={80}
                  placeholder="Ex : Foret de Compiegne"
                  autoFocus
                  className="w-full bg-[rgba(2,6,23,0.5)] border border-[rgba(226,232,240,0.18)] border-b-tactica-amber/40 text-foreground placeholder:text-foreground/30 placeholder:italic px-3 py-[10px] rounded-[2px] text-[14px] outline-none focus:border-tactica-amber"
                />
              </div>

              <div>
                <label className="block mb-[7px] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Texture
                </label>
                <TexturePicker
                  currentUrl={displayUrl}
                  onFileSelected={(file, dataUrl) => {
                    setPendingFile(file)
                    setPendingDataUrl(dataUrl)
                  }}
                  uploading={submitting}
                />
              </div>

              <div>
                <label className="block mb-[7px] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Mode
                </label>
                <div className="flex gap-3 text-[13px] text-foreground/85">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      checked={form.mode === 'stretch'}
                      onChange={() => setForm(s => ({ ...s, mode: 'stretch' }))}
                    />
                    Stretch
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      checked={form.mode === 'tile'}
                      onChange={() => setForm(s => ({ ...s, mode: 'tile' }))}
                    />
                    Tile
                  </label>
                </div>
              </div>

              <div>
                <label className="block mb-[7px] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Echelle de tiling : {form.scale}×
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={form.scale}
                  onChange={e => setForm(s => ({ ...s, scale: Number(e.target.value) }))}
                  disabled={form.mode === 'stretch'}
                  className="w-full accent-tactica-amber disabled:opacity-30"
                />
                <p className="text-[11px] italic text-muted-foreground mt-[5px]">
                  Actif uniquement en mode "tile". 1 = pas de repetition, 10 = grille 10×10.
                </p>
              </div>
            </div>

            {/* Colonne preview */}
            <div className="flex flex-col gap-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Preview
              </div>
              <HexPreview3D
                textureUrl={displayUrl}
                textureScale={form.scale}
                textureMode={form.mode}
                size={300}
                assets={assets}
                customAssetsById={customAssetsById}
              />
              <div className="text-[11px] italic text-muted-foreground">
                {displayUrl ? 'Mis a jour en direct.' : 'Selectionne une texture pour voir le rendu.'}
              </div>
            </div>

            {/* Section Assets 3D (col-span-2) */}
            <div className="col-span-2 pt-4 border-t border-[rgba(226,232,240,0.10)]">
              <AssetPalette
                placed={assets}
                customAssets={customAssets}
                onAddPreset={(kind: Exclude<AssetKind, 'custom'>) =>
                  setAssets(prev => [...prev, { kind, dx: 0, dz: 0, scale: 1, rotationY: 0 }])
                }
                onAddCustom={(assetId: string) =>
                  setAssets(prev => [
                    ...prev,
                    { kind: 'custom', customAssetId: assetId, dx: 0, dz: 0, scale: 1, rotationY: 0 },
                  ])
                }
                onUpdate={(index, patch) =>
                  setAssets(prev => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
                }
                onRemove={index => setAssets(prev => prev.filter((_, i) => i !== index))}
                onUploadGLB={async (file: File) => {
                  const newId = crypto.randomUUID()
                  const url = await onUploadGLB(file, userId, newId)
                  const baseName = file.name.replace(/\.[^.]+$/, '')
                  await onCreateCustomAsset({
                    id: newId,
                    created_by: userId,
                    name: baseName,
                    url,
                    category: 'custom',
                  })
                }}
                onDeleteCustomAsset={async (assetId: string) => {
                  await onRemoveCustomAsset(assetId)
                }}
              />
            </div>

            {/* Footer */}
            <div className="col-span-2 flex gap-[10px] justify-end pt-[18px] border-t border-[rgba(226,232,240,0.10)] mt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={submitting}
                  className="bg-transparent border-none text-muted-foreground hover:text-foreground px-4 py-[9px] rounded-[2px] text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-40"
                >
                  {inBatch ? 'Annuler la batch' : 'Annuler'}
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting}
                className="bg-tactica-amber hover:bg-[#ffb13d] disabled:bg-tactica-amber/25 disabled:text-[#EF9F27]/50 disabled:cursor-not-allowed text-[#1a1208] px-[22px] py-[11px] text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors"
                style={{ clipPath: PRIMARY_BTN_CLIP }}
              >
                {submitting
                  ? 'Sauvegarde...'
                  : hasMoreInBatch
                    ? 'Sauvegarder & suivant'
                    : 'Sauvegarder'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
