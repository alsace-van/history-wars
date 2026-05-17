// v1.1 (17/05/2026) — MAX_GLB_BYTES 10 → 50 MB (decimation auto reduit le fichier ensuite)
// v1.0 (17/05/2026) — Phase 5 Lot B (ext) : modale bibliotheque GLB avec preview 3D mini par asset
// Affiche en grid les hex_assets disponibles. Click sur un asset -> callback onPick (ajout a la map).

import * as Dialog from '@radix-ui/react-dialog'
import { Suspense, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { toast } from 'sonner'
import type { HexAsset, HexAssetDraft } from '@hooks/useHexAssets'

// Limite haute : la decimation auto (uploadGLB v1.2) reduit ensuite le fichier final.
// Au-dela de 50 MB, on rejette pour eviter de crasher le browser au parse GLTF.
const MAX_GLB_BYTES = 50 * 1024 * 1024
const ACCEPTED_GLB_EXT = ['glb', 'gltf']

const MODAL_CLIP = 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)'

interface PropLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assets: HexAsset[]
  userId: string
  onPick: (assetId: string) => void
  onUploadGLB: (file: File, userId: string, assetId: string) => Promise<string>
  onCreateAsset: (draft: HexAssetDraft) => Promise<HexAsset>
  onRemoveAsset: (id: string) => Promise<void>
}

export function PropLibraryDialog({
  open,
  onOpenChange,
  assets,
  userId,
  onPick,
  onUploadGLB,
  onCreateAsset,
  onRemoveAsset,
}: PropLibraryDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const ext = (f.name.split('.').pop() ?? '').toLowerCase()
    if (!ACCEPTED_GLB_EXT.includes(ext)) {
      toast.error('Format non supporte. GLB ou GLTF uniquement.')
      return
    }
    if (f.size > MAX_GLB_BYTES) {
      toast.error(`Fichier trop volumineux (${(f.size / 1024 / 1024).toFixed(1)} MB, max ${MAX_GLB_BYTES / 1024 / 1024} MB). Decime dans Blender avant upload.`)
      return
    }
    setUploading(true)
    try {
      const newId = crypto.randomUUID()
      const url = await onUploadGLB(f, userId, newId)
      const baseName = f.name.replace(/\.[^.]+$/, '')
      await onCreateAsset({
        id: newId,
        created_by: userId,
        name: baseName,
        url,
        category: 'building',
      })
      toast.success(`${baseName} importe.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Echec import')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(a: HexAsset) {
    if (!confirm(`Supprimer "${a.name}" de la bibliotheque ? Les maps qui l'utilisent l'afficheront comme manquant.`)) return
    try {
      await onRemoveAsset(a.id)
      toast.success('Supprime.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Echec suppression')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(2,6,23,0.85)] backdrop-blur-[6px] animate-fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none animate-fade-in"
          style={{
            background: 'rgba(20, 28, 50, 0.96)',
            border: '1px solid #EF9F27',
            clipPath: MODAL_CLIP,
            width: 'min(900px, 92vw)',
            maxHeight: '88vh',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title asChild>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber mb-1">
                  Bibliotheque
                </div>
                <h2 className="m-0 font-serif italic text-[22px] font-medium text-foreground tracking-[0.02em]">
                  GLB disponibles ({assets.length})
                </h2>
              </div>
            </Dialog.Title>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="bg-tactica-amber/15 border border-tactica-amber/50 hover:bg-tactica-amber/25 text-tactica-amber px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.10em] rounded-[2px] transition-colors disabled:opacity-50"
            >
              {uploading ? 'Upload...' : '+ Importer GLB'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
          </div>
          <Dialog.Description className="text-[12px] italic text-muted-foreground">
            Click sur un GLB pour le poser au centre de la map (tu pourras le deplacer ensuite par drag).
          </Dialog.Description>

          <div className="overflow-y-auto pr-1" style={{ flex: 1 }}>
            {assets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="italic mb-2">Aucun GLB.</p>
                <p className="text-[12px]">Click sur "+ Importer GLB" pour ajouter ton premier modele 3D.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {assets.map(a => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    onPick={() => { onPick(a.id); onOpenChange(false) }}
                    onDelete={() => handleDelete(a)}
                  />
                ))}
              </div>
            )}
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className="bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-tactica-amber text-muted-foreground hover:text-foreground px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors rounded-[2px]"
            >
              Fermer
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface AssetCardProps {
  asset: HexAsset
  onPick: () => void
  onDelete: () => void
}

function AssetCard({ asset, onPick, onDelete }: AssetCardProps) {
  return (
    <div
      className="relative flex flex-col gap-1.5 p-2 transition-colors hover:border-tactica-amber"
      style={{
        background: 'rgba(2, 6, 23, 0.5)',
        border: '1px solid rgba(226, 232, 240, 0.12)',
        borderRadius: 2,
      }}
    >
      <button
        type="button"
        onClick={onPick}
        title={`Poser ${asset.name} sur la map`}
        className="cursor-pointer block w-full"
        style={{ aspectRatio: '1 / 1' }}
      >
        <Canvas
          camera={{ position: [1.4, 1.2, 1.4], fov: 38 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          dpr={1}
          frameloop="demand"
          style={{ background: '#070d1a', borderRadius: 2 }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 4, 2]} intensity={0.9} />
          <Suspense fallback={null}>
            <PreviewGLB url={asset.url} />
          </Suspense>
        </Canvas>
      </button>
      <div className="text-[10px] text-foreground/90 truncate">{asset.name}</div>
      <button
        type="button"
        onClick={onDelete}
        title="Supprimer de la bibliotheque"
        className="absolute top-1 right-1 w-5 h-5 bg-[rgba(2,6,23,0.75)] border border-[rgba(226,232,240,0.18)] text-muted-foreground hover:text-red-400 hover:border-red-500 rounded-[2px] flex items-center justify-center text-[12px] transition-colors"
      >
        ×
      </button>
    </div>
  )
}

/**
 * Charge un GLB et le normalise pour la mini preview : bounding box -> bbox cible 1.2 unite,
 * centre absolument (X/Y/Z) pour avoir l'objet bien au milieu de la mini Canvas.
 * Independant de CustomGLBMesh (qui colle base au sol pour le placement reel).
 */
function PreviewGLB({ url }: { url: string }) {
  const { scene } = useGLTF(url) as unknown as { scene: THREE.Group }
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    const box = new THREE.Box3().setFromObject(c)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const fit = maxDim > 0.001 ? 1.2 / maxDim : 1
    c.scale.setScalar(fit)
    const box2 = new THREE.Box3().setFromObject(c)
    const center = new THREE.Vector3()
    box2.getCenter(center)
    c.position.set(-center.x, -center.y, -center.z)
    return c
  }, [scene])
  return <primitive object={cloned} />
}
