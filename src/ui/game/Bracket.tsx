// v1.0 (10/05/2026) — Phase 2 2D.6 : extrait depuis Game.tsx pour rester sous 600 lignes (cf. CLAUDE.md règle 4)
import { cn } from '@lib/cn'

export function Bracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const cls = {
    tl: 'top-1 left-1 border-r-0 border-b-0',
    tr: 'top-1 right-1 border-l-0 border-b-0',
    bl: 'bottom-1 left-1 border-r-0 border-t-0',
    br: 'bottom-1 right-1 border-l-0 border-t-0',
  }[position]
  return <span aria-hidden className={cn('absolute w-[10px] h-[10px] border border-tactica-amber opacity-50', cls)} />
}
