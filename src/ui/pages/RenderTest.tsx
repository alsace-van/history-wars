// v1.0 (09/05/2026) — Page demo /render-test : valide la scene 3D en isolation
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { spiral } from '@engine/hex'
import { TacticalScene, buildMvpUnitPlacement } from '@/render'

export function RenderTest() {
  const cubes = useMemo(() => spiral({ q: 0, r: 0, s: 0 }, 5), [])
  const units = useMemo(() => buildMvpUnitPlacement(), [])

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: '#0f172a' }}
    >
      {/* Mini header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[rgba(226,232,240,0.18)] bg-[rgba(8,12,24,0.85)] z-10">
        <div className="flex items-center gap-4">
          <Link
            to="/lobby"
            className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-tactica-amber transition-colors"
          >
            ← Lobby
          </Link>
          <div className="text-[16px] font-bold tracking-[0.3em]">
            TACTICA
            <span className="ml-2 font-serif italic font-normal text-[14px] tracking-[0.04em] text-tactica-amber align-middle">
              — Render test
            </span>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground tracking-[0.05em]">
          {cubes.length} hex · {units.length} unités · échelle tactique
        </div>
      </header>

      {/* Scene 3D plein espace */}
      <div className="flex-1 relative">
        <TacticalScene
          scale="tactical"
          cubes={cubes}
          units={units}
          onTileClick={(c) =>
            // eslint-disable-next-line no-console
            console.log('[RenderTest] tile clicked:', c)
          }
        />
        {/* Overlay aide controles */}
        <div className="absolute bottom-4 left-4 px-4 py-3 bg-[rgba(15,23,42,0.85)] backdrop-blur-[6px] border border-[rgba(226,232,240,0.18)] rounded-[2px] text-[11px] text-muted-foreground tracking-[0.05em] uppercase pointer-events-none">
          <div>Clic gauche + glisser : rotation</div>
          <div>Clic droit + glisser : pan</div>
          <div>Molette : zoom</div>
        </div>
      </div>
    </div>
  )
}
