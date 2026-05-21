// v1.5 (17/05/2026) — Perf zoom : bornes OrbitControls (min/maxDistance) + zoomSpeed + Stats/PerfProbe debug
// v1.4 (17/05/2026) — Sidebar epuree (bouton bibliotheque modale + panel "Asset selectionne")
//                      + fix drag (plan invisible Y=0.5 above-hex actif pendant drag uniquement)
// v1.3 (17/05/2026) — Perf : frameloop="demand" + dpr=1 strict
// v1.2 (17/05/2026) — Perf : Canvas dpr capped a [1, 1.5] (insuffisant)

import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import { useRequireAuth } from '@hooks/useRequireAuth'
import { useHexMaps, type HexMapTiles, type PlacedProp } from '@hooks/useHexMaps'
import { useHexTemplates } from '@hooks/useHexTemplates'
import { useHexAssets } from '@hooks/useHexAssets'
import { HexGrid } from '@render/hex/HexGrid'
import { TerrainDecor } from '@render/decor/TerrainDecor'
import { SceneLighting } from '@render/lighting/SceneLighting'
import { CustomGLBMesh } from '@render/decor/assets/CustomGLBMesh'
import { PropLibraryDialog } from './PropLibraryDialog'
import { spiral, cubeKey, type Cube } from '@engine/hex'
import { SCALE_CONFIG } from '@engine/scales'
import type { TerrainType } from '@engine/terrain/types'

const ADMIN_EMAIL = 'alsacevancreation@hotmail.com'

const PRIMARY_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

// v1.5b debug temp : sonde perf qui logue render+memory toutes les 500 ms.
function PerfProbe() {
  const gl = useThree(s => s.gl)
  const lastLogRef = useRef(0)
  useFrame(() => {
    const now = performance.now()
    if (now - lastLogRef.current < 500) return
    lastLogRef.current = now
    const r = gl.info.render
    const m = gl.info.memory
    // eslint-disable-next-line no-console
    console.log('[PerfProbe v1.5b]', { calls: r.calls, tris: r.triangles, geom: m.geometries, tex: m.textures, frame: r.frame })
  })
  return null
}

export function MapEditor() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useRequireAuth()
  const navigate = useNavigate()
  const { byId: mapsById, update: updateMap } = useHexMaps(!!user)
  const { templates, byId: templatesById } = useHexTemplates(!!user)
  const {
    assets: customAssets,
    byId: customAssetsById,
    create: createCustomAsset,
    remove: removeCustomAsset,
    uploadGLB,
  } = useHexAssets(!!user)

  const map = id ? mapsById.get(id) : null

  // State local de l'edition.
  const [name, setName] = useState('')
  const [tiles, setTiles] = useState<HexMapTiles>({})
  const [props, setProps] = useState<PlacedProp[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [eraseMode, setEraseMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  // Refonte sidebar v1.4 :
  // - selectedPropId : prop actuellement edite (panneau sidebar). Persiste apres drag.
  // - dragPropId : prop en cours de drag (souris enfoncee + mouvement). Bref.
  // - libraryOpen : modale bibliotheque GLB.
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null)
  const [dragPropId, setDragPropId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)

  useEffect(() => {
    if (!map) return
    setName(map.name)
    setTiles({ ...map.tiles })
    setProps(Array.isArray(map.props) ? [...map.props] : [])
    setDirty(false)
    setSelectedPropId(null)
  }, [map?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const cubes = useMemo<Cube[]>(() => (map ? spiral({ q: 0, r: 0, s: 0 }, map.radius) : []), [map?.radius])

  const templateMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const [k, v] of Object.entries(tiles)) m.set(k, v)
    return m
  }, [tiles])

  const terrainMap = useMemo<Map<string, TerrainType>>(() => {
    const m = new Map<string, TerrainType>()
    for (const c of cubes) m.set(cubeKey(c), 'plaine_standard')
    return m
  }, [cubes])

  const hexSize = SCALE_CONFIG.tactical.hexSize
  const selectedProp = selectedPropId ? props.find(p => p.id === selectedPropId) ?? null : null

  if (authLoading) return null
  if (!user) return null
  if (user.email !== ADMIN_EMAIL) return <Navigate to="/lobby" replace />
  if (!id) return <Navigate to="/editor/maps" replace />
  if (!map) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-muted-foreground italic">Chargement de la carte...</div>
      </div>
    )
  }

  function handlePaintHex(cube: Cube) {
    if (dragPropId) return
    // Pas en paint mode : click sur hex = deselect le prop (puisque onPointerMissed du Canvas
    // ne fire jamais quand le terrain est plein d'hex).
    if (!selectedTemplateId && !eraseMode) {
      setSelectedPropId(null)
      return
    }
    const key = cubeKey(cube)
    setTiles(prev => {
      const next = { ...prev }
      if (eraseMode) {
        delete next[key]
      } else if (selectedTemplateId) {
        next[key] = selectedTemplateId
      } else {
        return prev
      }
      return next
    })
    setDirty(true)
  }

  async function handleSave() {
    if (!map) return
    setSaving(true)
    try {
      await updateMap(map.id, { name: name.trim() || map.name, tiles, props })
      setDirty(false)
      toast.success('Carte sauvegardee.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Echec sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    if (dirty && !confirm('Modifications non sauvegardees. Quitter quand meme ?')) return
    navigate('/editor/maps')
  }

  function handleAddProp(assetId: string) {
    const newId = crypto.randomUUID()
    setProps(prev => [
      ...prev,
      { id: newId, assetId, x: 0, y: 0, z: 0, scale: 1, rotationY: 0 },
    ])
    setSelectedPropId(newId)
    setDirty(true)
  }

  function handleUpdateProp(propId: string, patch: Partial<PlacedProp>) {
    setProps(prev => prev.map(p => (p.id === propId ? { ...p, ...patch } : p)))
    setDirty(true)
  }

  function handleRemoveProp(propId: string) {
    setProps(prev => prev.filter(p => p.id !== propId))
    if (selectedPropId === propId) setSelectedPropId(null)
    setDirty(true)
  }

  const paintActive = !!selectedTemplateId || eraseMode
  const paintedCount = Object.keys(tiles).length

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Topbar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-[rgba(226,232,240,0.10)]" style={{ background: 'rgba(20, 28, 50, 0.94)' }}>
        <button
          type="button"
          onClick={handleBack}
          className="bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-tactica-amber text-muted-foreground hover:text-foreground px-3 py-[7px] text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors rounded-[2px]"
        >
          ← Retour
        </button>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setDirty(true) }}
          placeholder="Nom de la carte"
          className="flex-1 max-w-[400px] bg-[rgba(2,6,23,0.5)] border border-[rgba(226,232,240,0.18)] focus:border-tactica-amber text-foreground placeholder:text-foreground/30 px-3 py-[8px] rounded-[2px] text-[14px] outline-none"
        />
        <div className="text-[11px] text-muted-foreground italic">
          {paintedCount} hex • {props.length} props{dirty && ' • non sauvegarde'}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="bg-tactica-amber hover:bg-[#ffb13d] disabled:bg-tactica-amber/25 disabled:text-[#EF9F27]/50 disabled:cursor-not-allowed text-[#1a1208] px-[20px] py-[10px] text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors"
          style={{ clipPath: PRIMARY_BTN_CLIP }}
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Body : Canvas + palette */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <Canvas
            camera={{ position: [0, 14, 10], fov: 38 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            dpr={1}
            frameloop="demand"
            style={{ background: '#0a1224' }}
            onPointerMissed={() => setSelectedPropId(null)}
          >
            <SceneLighting />
            <PerfProbe />
            <Stats />
            <OrbitControls
              makeDefault
              enablePan={true}
              maxPolarAngle={Math.PI / 2.2}
              enabled={!dragPropId}
              minDistance={4}
              maxDistance={22}
              zoomSpeed={0.6}
            />

            <HexGrid
              scale="tactical"
              cubes={cubes}
              onTileClick={handlePaintHex}
            />
            <TerrainDecor
              terrainMap={terrainMap}
              hexSize={hexSize}
              templateMap={templateMap}
              templatesById={templatesById}
              customAssetsById={customAssetsById}
            />

            {/* Props (batiments) en coord monde, draggables. Highlighted = emissive sur le mesh. */}
            {props.map(p => {
              const meta = customAssetsById.get(p.assetId)
              if (!meta) return null
              const isSelected = selectedPropId === p.id
              return (
                <group
                  key={p.id}
                  position={[p.x, p.y ?? 0, p.z]}
                  rotation={[0, p.rotationY, 0]}
                  onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                    e.stopPropagation()
                    setSelectedPropId(p.id)
                    setDragPropId(p.id)
                  }}
                >
                  <CustomGLBMesh url={meta.url} scale={p.scale} highlighted={isSelected} />
                </group>
              )
            })}

            {/* Plan invisible XZ qui capture le drag. Monte AU-DESSUS de la grille (Y=0.5)
                pour que les hex ne mangent pas les pointer events pendant le drag.
                Actif uniquement si dragPropId : sinon les hex restent normalement cliquables. */}
            {dragPropId && (
              <mesh
                position={[0, 0.5, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                onPointerMove={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation()
                  handleUpdateProp(dragPropId, { x: e.point.x, z: e.point.z })
                }}
                onPointerUp={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation()
                  setDragPropId(null)
                }}
                onPointerLeave={() => setDragPropId(null)}
              >
                <planeGeometry args={[400, 400]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
              </mesh>
            )}
          </Canvas>

          {/* Indicateur paint mode (overlay coin) */}
          <div
            className="absolute top-4 left-4 px-3 py-2 rounded-[2px] text-[11px]"
            style={{
              background: paintActive ? 'rgba(239, 159, 39, 0.15)' : 'rgba(20, 28, 50, 0.85)',
              border: `1px solid ${paintActive ? '#EF9F27' : 'rgba(226, 232, 240, 0.18)'}`,
            }}
          >
            {eraseMode ? (
              <span className="text-red-300">🧹 Effacer (clic un hex)</span>
            ) : selectedTemplateId ? (
              <span className="text-tactica-amber">
                🎨 {templatesById.get(selectedTemplateId)?.name ?? '?'}
              </span>
            ) : (
              <span className="text-muted-foreground italic">Drag un prop pour le bouger, ou selectionne un template a droite.</span>
            )}
          </div>
        </div>

        {/* Sidebar : templates hex + bouton bibliotheque + panneau prop selectionne */}
        <div
          className="w-[320px] flex flex-col gap-3 p-4 overflow-y-auto"
          style={{ background: 'rgba(20, 28, 50, 0.94)', borderLeft: '1px solid rgba(239, 159, 39, 0.25)' }}
        >
          {/* Section templates hex */}
          <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber">
            Templates hex
          </div>
          {templates.length === 0 ? (
            <div className="text-[11px] italic text-muted-foreground py-2">
              Aucun template. Cree-en via{' '}
              <button onClick={() => navigate('/editor/hex-templates')} className="underline text-tactica-amber">
                bibliotheque hex
              </button>.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto pr-1">
              {templates.map(t => {
                const isSelected = !eraseMode && selectedTemplateId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setSelectedTemplateId(t.id); setEraseMode(false) }}
                    title={t.name}
                    className="flex flex-col items-stretch gap-1 p-1 transition-colors hover:border-tactica-amber"
                    style={{
                      background: 'rgba(2, 6, 23, 0.5)',
                      border: `1px solid ${isSelected ? '#EF9F27' : 'rgba(226, 232, 240, 0.10)'}`,
                      borderRadius: 2,
                    }}
                  >
                    <img
                      src={t.texture_url}
                      alt={t.name}
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 2 }}
                    />
                    <div className="text-[9px] text-foreground/85 truncate">{t.name}</div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { setEraseMode(true); setSelectedTemplateId(null) }}
              className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded-[2px] transition-colors ${
                eraseMode
                  ? 'bg-red-500/15 border border-red-500 text-red-300'
                  : 'bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-red-500 hover:text-red-400 text-muted-foreground'
              }`}
            >
              🧹 Effacer
            </button>
            <button
              type="button"
              onClick={() => { setSelectedTemplateId(null); setEraseMode(false) }}
              disabled={!paintActive}
              className="text-[10px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded-[2px] transition-colors bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-tactica-amber hover:text-tactica-amber text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Desactiver paint
            </button>
          </div>

          {/* Bouton bibliotheque GLB */}
          <div className="pt-3 border-t border-[rgba(226,232,240,0.10)]">
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="w-full bg-tactica-amber/15 border border-tactica-amber hover:bg-tactica-amber/25 text-tactica-amber px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.10em] rounded-[2px] transition-colors"
            >
              🏠 Bibliotheque GLB ({customAssets.length})
            </button>
          </div>

          {/* Panneau asset selectionne */}
          <div className="pt-3 border-t border-[rgba(226,232,240,0.10)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber mb-2">
              Asset selectionne
            </div>
            {!selectedProp ? (
              <div className="text-[11px] italic text-muted-foreground">
                Click sur un prop dans la map pour editer ses options ici.
              </div>
            ) : (
              <SelectedPropPanel
                prop={selectedProp}
                assetName={customAssetsById.get(selectedProp.assetId)?.name ?? '⚠ asset supprime'}
                onUpdate={patch => handleUpdateProp(selectedProp.id, patch)}
                onRemove={() => handleRemoveProp(selectedProp.id)}
                onDeselect={() => setSelectedPropId(null)}
              />
            )}
          </div>

          <div className="pt-3 border-t border-[rgba(226,232,240,0.10)] text-[10px] text-muted-foreground italic mt-auto">
            <p>Astuces :</p>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>Drag souris (fond) : pivoter cam</li>
              <li>Molette : zoom</li>
              <li>Click sur un prop : selectionne</li>
              <li>Click + drag sur prop : deplacer</li>
              <li>Click sur un hex : peindre</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modale bibliotheque GLB */}
      <PropLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        assets={customAssets}
        userId={user.id}
        onPick={handleAddProp}
        onUploadGLB={uploadGLB}
        onCreateAsset={createCustomAsset}
        onRemoveAsset={removeCustomAsset}
      />
    </div>
  )
}

interface SelectedPropPanelProps {
  prop: PlacedProp
  assetName: string
  onUpdate: (patch: Partial<PlacedProp>) => void
  onRemove: () => void
  onDeselect: () => void
}

function SelectedPropPanel({ prop, assetName, onUpdate, onRemove, onDeselect }: SelectedPropPanelProps) {
  return (
    <div
      className="p-2.5 rounded-[2px] space-y-2"
      style={{ background: 'rgba(2, 6, 23, 0.5)', border: '1px solid rgba(239, 159, 39, 0.4)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-foreground/95 truncate" title={assetName}>{assetName}</div>
        <button
          type="button"
          onClick={onDeselect}
          title="Deselectionner"
          className="text-muted-foreground hover:text-foreground text-[14px] w-5 h-5 flex items-center justify-center transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-1 gap-1.5 text-[10px]">
        <PropField label="x" value={prop.x} min={-30} max={30} step={0.1} onChange={v => onUpdate({ x: v })} />
        <PropField label="z" value={prop.z} min={-30} max={30} step={0.1} onChange={v => onUpdate({ z: v })} />
        <PropField label="y" value={prop.y ?? 0} min={-2} max={5} step={0.05} onChange={v => onUpdate({ y: v })} />
        <PropField label="scale" value={prop.scale} min={0.05} max={30} step={0.05} editable onChange={v => onUpdate({ scale: v })} />
        <PropField label="rot" value={prop.rotationY} min={-Math.PI} max={Math.PI} step={Math.PI / 12} onChange={v => onUpdate({ rotationY: v })} />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="w-full bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-red-500 hover:text-red-400 text-muted-foreground px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors rounded-[2px]"
      >
        🗑 Supprimer ce prop
      </button>
    </div>
  )
}

interface PropFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  editable?: boolean
}

function PropField({ label, value, min, max, step, onChange, editable }: PropFieldProps) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground w-8">{label}</span>
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
          className="w-14 text-right text-foreground/80 tabular-nums bg-transparent border border-[rgba(226,232,240,0.18)] rounded-[2px] px-1 text-[10px] outline-none focus:border-tactica-amber"
        />
      ) : (
        <span className="w-10 text-right text-foreground/80 tabular-nums">{value.toFixed(2)}</span>
      )}
    </label>
  )
}
