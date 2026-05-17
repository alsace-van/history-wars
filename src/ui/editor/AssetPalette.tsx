// v1.2 (17/05/2026) — Slider scale etendu 0.05-30 (couvre GLB en cm) + input number pour saisie precise
// v1.1 (17/05/2026) — Phase 5 Lot B.4-bis : section Custom + bouton upload GLB + dispatch label custom
// v1.0 (17/05/2026) — Phase 5 Lot B.4 : palette boutons assets 3D + liste editable

import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { PRESET_KINDS_ORDERED, ASSET_LABEL } from '@render/decor/AssetRenderer'
import type { AssetKind, PlacedAsset } from '@hooks/useHexTemplates'
import type { HexAsset } from '@hooks/useHexAssets'

const MAX_GLB_BYTES = 10 * 1024 * 1024
const ACCEPTED_GLB_EXT = ['glb', 'gltf']

interface AssetPaletteProps {
  placed: PlacedAsset[]
  customAssets: HexAsset[]
  onAddPreset: (kind: Exclude<AssetKind, 'custom'>) => void
  onAddCustom: (assetId: string) => void
  onUpdate: (index: number, patch: Partial<PlacedAsset>) => void
  onRemove: (index: number) => void
  onUploadGLB: (file: File) => Promise<void>
  onDeleteCustomAsset: (assetId: string) => Promise<void>
}

export function AssetPalette({
  placed,
  customAssets,
  onAddPreset,
  onAddCustom,
  onUpdate,
  onRemove,
  onUploadGLB,
  onDeleteCustomAsset,
}: AssetPaletteProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const ext = (f.name.split('.').pop() ?? '').toLowerCase()
    if (!ACCEPTED_GLB_EXT.includes(ext)) {
      toast.error(`Format non supporte. GLB ou GLTF uniquement.`)
      return
    }
    if (f.size > MAX_GLB_BYTES) {
      toast.error(`Fichier trop volumineux (${(f.size / 1024 / 1024).toFixed(1)} MB, max 10 MB)`)
      return
    }
    setUploading(true)
    try {
      await onUploadGLB(f)
      toast.success(`${f.name} uploade.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Echec upload'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  function labelFor(asset: PlacedAsset): string {
    if (asset.kind === 'custom') {
      const meta = asset.customAssetId
        ? customAssets.find(a => a.id === asset.customAssetId)
        : undefined
      return meta ? meta.name : '⚠ Asset supprime'
    }
    return ASSET_LABEL[asset.kind]
  }

  return (
    <div className="space-y-3">
      {/* Palette presets */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Presets builtin
        </div>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_KINDS_ORDERED.map(kind => (
            <button
              key={kind}
              type="button"
              onClick={() => onAddPreset(kind)}
              className="bg-[rgba(2,6,23,0.5)] border border-[rgba(226,232,240,0.18)] hover:border-tactica-amber hover:text-tactica-amber text-foreground px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors rounded-[2px]"
            >
              + {ASSET_LABEL[kind]}
            </button>
          ))}
        </div>
      </div>

      {/* Palette custom GLB */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Mes GLB ({customAssets.length})
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-tactica-amber/15 border border-tactica-amber/50 hover:bg-tactica-amber/25 text-tactica-amber px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors rounded-[2px] disabled:opacity-50"
          >
            {uploading ? 'Upload...' : '+ Upload GLB'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </div>
        {customAssets.length === 0 ? (
          <div className="text-[11px] italic text-muted-foreground">
            Aucun GLB perso. Uploade tes propres modeles pour remplacer les presets.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
            {customAssets.map(a => (
              <div
                key={a.id}
                className="flex items-center gap-1 p-1 rounded-[2px]"
                style={{ background: 'rgba(2, 6, 23, 0.45)', border: '1px solid rgba(239, 159, 39, 0.25)' }}
              >
                <button
                  type="button"
                  onClick={() => onAddCustom(a.id)}
                  className="flex-1 text-left text-[11px] text-foreground/95 hover:text-tactica-amber px-1 py-1 truncate transition-colors"
                  title={`Ajouter ${a.name}`}
                >
                  + {a.name}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Supprimer l'asset "${a.name}" ? (Les hex qui l'utilisent l'afficheront comme manquant)`)) return
                    try {
                      await onDeleteCustomAsset(a.id)
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Echec suppression')
                    }
                  }}
                  title="Supprimer"
                  className="text-muted-foreground hover:text-red-400 text-[12px] w-5 h-5 flex items-center justify-center transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Liste des placed */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Places ({placed.length})
        </div>
        {placed.length === 0 ? (
          <div className="text-[11px] italic text-muted-foreground">
            Aucun. Clique un bouton ci-dessus pour ajouter au centre.
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {placed.map((a, i) => (
              <PlacedAssetRow
                key={i}
                index={i}
                asset={a}
                label={labelFor(a)}
                onUpdate={patch => onUpdate(i, patch)}
                onRemove={() => onRemove(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface PlacedAssetRowProps {
  index: number
  asset: PlacedAsset
  label: string
  onUpdate: (patch: Partial<PlacedAsset>) => void
  onRemove: () => void
}

function PlacedAssetRow({ index, asset, label, onUpdate, onRemove }: PlacedAssetRowProps) {
  return (
    <div
      className="grid grid-cols-[80px_1fr_28px] gap-2 items-center p-2 rounded-[2px]"
      style={{ background: 'rgba(2, 6, 23, 0.45)', border: '1px solid rgba(226, 232, 240, 0.10)' }}
    >
      <div className="text-[11px] text-foreground/90 truncate">
        <span className="text-[9px] uppercase text-muted-foreground">#{index + 1}</span><br />
        {label}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <NumField label="dx" value={asset.dx} min={-1} max={1} step={0.05} onChange={v => onUpdate({ dx: v })} />
        <NumField label="dz" value={asset.dz} min={-1} max={1} step={0.05} onChange={v => onUpdate({ dz: v })} />
        <NumField label="scale" value={asset.scale} min={0.05} max={30} step={0.05} editable onChange={v => onUpdate({ scale: v })} />
        <NumField label="rot" value={asset.rotationY} min={-Math.PI} max={Math.PI} step={Math.PI / 12} onChange={v => onUpdate({ rotationY: v })} />
      </div>
      <button
        type="button"
        onClick={onRemove}
        title="Supprimer"
        className="text-muted-foreground hover:text-red-400 text-[14px] h-7 flex items-center justify-center transition-colors"
      >
        ×
      </button>
    </div>
  )
}

interface NumFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  /** Si true, la valeur a droite est un input number editable (saisie precise au-dela de la plage slider). */
  editable?: boolean
}

function NumField({ label, value, min, max, step, onChange, editable }: NumFieldProps) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground w-7">{label}</span>
      <input
        type="range"
        value={Math.min(max, Math.max(min, value))}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-tactica-amber h-3"
      />
      {editable ? (
        <input
          type="number"
          value={value}
          step={step}
          min={0}
          onChange={e => {
            const v = Number(e.target.value)
            if (Number.isFinite(v)) onChange(v)
          }}
          className="w-12 text-right text-foreground/80 tabular-nums bg-transparent border border-[rgba(226,232,240,0.18)] rounded-[2px] px-1 text-[10px] outline-none focus:border-tactica-amber"
        />
      ) : (
        <span className="w-9 text-right text-foreground/80 tabular-nums">{value.toFixed(2)}</span>
      )}
    </label>
  )
}
