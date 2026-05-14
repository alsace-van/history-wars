// v1.0 (14/05/2026) — Phase 4 Lot A5 : bouton lobby "Ajouter bot" + dropdown difficulté
import { useState } from 'react'

export type BotDifficulty = 'easy' | 'medium' | 'hard'

interface AddBotButtonProps {
  onAddBot: (difficulty: BotDifficulty) => Promise<void> | void
  disabled?: boolean
}

const DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
}

export function AddBotButton({ onAddBot, disabled }: AddBotButtonProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handlePick(diff: BotDifficulty) {
    if (busy || disabled) return
    setBusy(true)
    try {
      await onAddBot(diff)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setOpen(true)}
        className="w-full px-3 py-2 mt-2 border border-dashed border-tactica-amber/40 rounded-[2px] text-[11px] uppercase tracking-[0.1em] text-tactica-amber hover:bg-tactica-amber/10 disabled:opacity-40"
      >
        🤖 Ajouter un bot
      </button>
    )
  }

  return (
    <div className="mt-2 p-2 border border-tactica-amber/40 rounded-[2px] bg-[rgba(239,159,39,0.05)] space-y-1">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1">
        Choisir difficulté
      </div>
      <div className="grid grid-cols-3 gap-1">
        {(['easy', 'medium', 'hard'] as const).map(diff => (
          <button
            key={diff}
            type="button"
            disabled={busy}
            onClick={() => void handlePick(diff)}
            className="px-2 py-1 text-[10px] uppercase tracking-[0.08em] border border-tactica-amber/40 rounded-[2px] text-tactica-amber hover:bg-tactica-amber/20 disabled:opacity-40"
          >
            {DIFFICULTY_LABELS[diff]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="w-full mt-1 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
      >
        Annuler
      </button>
    </div>
  )
}
