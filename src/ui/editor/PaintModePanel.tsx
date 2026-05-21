// v1.0 (17/05/2026) — Phase 5 Lot B.6 : panel flottant Game pour paint mode (admin uniquement)
// Liste mini des templates dispos + bouton "Effacer" + bouton "Desactiver".
// Quand un template est selectionne ou le mode erase active, l'indicateur affiche l'etat.

import { useState } from 'react'
import type { HexTemplate } from '@hooks/useHexTemplates'
import type { UsePaintModeResult } from '@hooks/usePaintMode'

interface PaintModePanelProps {
  templates: HexTemplate[]
  paintMode: UsePaintModeResult
}

export function PaintModePanel({ templates, paintMode }: PaintModePanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const selectedTemplate = paintMode.selectedTemplateId
    ? templates.find(t => t.id === paintMode.selectedTemplateId)
    : null

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 left-4 z-40 bg-[rgba(20,28,50,0.94)] border border-tactica-amber hover:bg-tactica-amber/15 text-tactica-amber px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] rounded-[2px] transition-colors"
        style={{ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)' }}
      >
        🎨 Paint
      </button>
    )
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-40 w-[280px] flex flex-col gap-3 p-3"
      style={{
        background: 'rgba(20, 28, 50, 0.94)',
        border: '1px solid #EF9F27',
        borderRadius: 2,
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber">
          Paint mode
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="Reduire"
          className="text-muted-foreground hover:text-foreground text-[14px] transition-colors"
        >
          −
        </button>
      </div>

      {/* Indicateur etat actif */}
      <div
        className="text-[11px] px-2 py-1.5 rounded-[2px]"
        style={{
          background: paintMode.active ? 'rgba(239, 159, 39, 0.12)' : 'rgba(2, 6, 23, 0.5)',
          border: `1px solid ${paintMode.active ? 'rgba(239, 159, 39, 0.5)' : 'rgba(226, 232, 240, 0.10)'}`,
        }}
      >
        {paintMode.active ? (
          <>
            <span className="text-tactica-amber font-semibold uppercase tracking-[0.12em] text-[9px]">
              Actif :
            </span>{' '}
            <span className="text-foreground/90">
              {paintMode.kind === 'erase' ? 'Effacer template' : selectedTemplate?.name ?? '?'}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground italic">
            Selectionne un template, puis clique un hex.
          </span>
        )}
      </div>

      {/* Liste mini des templates */}
      <div className="max-h-[280px] overflow-y-auto pr-1">
        {templates.length === 0 ? (
          <div className="text-[11px] italic text-muted-foreground py-2">
            Aucun template. Va dans /editor/hex-templates pour en creer.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {templates.map(t => {
              const isSelected = paintMode.kind === 'paint' && paintMode.selectedTemplateId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => paintMode.activatePaint(t.id)}
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
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      borderRadius: 2,
                    }}
                  />
                  <div className="text-[9px] text-foreground/85 truncate">{t.name}</div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-[rgba(226,232,240,0.10)]">
        <button
          type="button"
          onClick={paintMode.activateErase}
          className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-3 py-2 rounded-[2px] transition-colors ${
            paintMode.kind === 'erase'
              ? 'bg-red-500/15 border border-red-500 text-red-300'
              : 'bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-red-500 hover:text-red-400 text-muted-foreground'
          }`}
        >
          🧹 Effacer (set null)
        </button>
        <button
          type="button"
          onClick={paintMode.deactivate}
          disabled={!paintMode.active}
          className="text-[10px] font-semibold uppercase tracking-[0.12em] px-3 py-2 rounded-[2px] transition-colors bg-transparent border border-[rgba(226,232,240,0.18)] hover:border-tactica-amber hover:text-tactica-amber text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Desactiver
        </button>
      </div>
    </div>
  )
}
