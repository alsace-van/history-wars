// v1.0 (08/05/2026) — Modale "Ordre de bataille" : creation de partie
import * as Dialog from '@radix-ui/react-dialog'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { MAX_PLAYERS_DEFAULT } from '@/types/game'

const MODAL_CLIP = 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)'
const PRIMARY_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

interface CreateGameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (params: {
    name: string
    maxPlayers: number
  }) => Promise<{ gameId: string | null; error: string | null }>
}

export function CreateGameDialog({ open, onOpenChange, onCreate }: CreateGameDialogProps) {
  const [name, setName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState<number>(MAX_PLAYERS_DEFAULT)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName('')
    setMaxPlayers(MAX_PLAYERS_DEFAULT)
    setSubmitting(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Donne un nom à la bataille.')
      return
    }
    setSubmitting(true)
    const { gameId, error } = await onCreate({ name, maxPlayers })
    setSubmitting(false)

    if (error || !gameId) {
      toast.error(error ?? 'Echec de la création.')
      return
    }
    toast.success('Opération engagée.')
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={next => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(2,6,23,0.78)] backdrop-blur-[6px] animate-fade-in" />

        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2 px-8 pt-8 pb-7 outline-none animate-slide-up"
          style={{
            background: 'rgba(20, 28, 50, 0.94)',
            border: '1px solid #EF9F27',
            clipPath: MODAL_CLIP,
            boxShadow:
              '0 0 0 4px rgba(8, 12, 24, 0.5), 0 30px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(239, 159, 39, 0.10)'
          }}
        >
          {/* Triangle decoratif sur le coin coupe */}
          <span
            aria-hidden
            className="absolute top-0 right-0 w-[16px] h-[16px] opacity-40"
            style={{
              background: 'linear-gradient(225deg, transparent 50%, #EF9F27 50%)'
            }}
          />

          {/* Brackets aux 3 coins restants */}
          <span
            aria-hidden
            className="absolute top-2 left-2 w-[14px] h-[14px] border border-tactica-amber border-r-0 border-b-0"
          />
          <span
            aria-hidden
            className="absolute bottom-2 left-2 w-[14px] h-[14px] border border-tactica-amber border-r-0 border-t-0"
          />
          <span
            aria-hidden
            className="absolute bottom-2 right-2 w-[14px] h-[14px] border border-tactica-amber border-l-0 border-t-0"
          />

          <Dialog.Title asChild>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-tactica-amber mb-1">
                Ordre de bataille
              </div>
              <h2 className="m-0 font-serif italic text-[26px] font-medium text-foreground tracking-[0.02em]">
                Nouvelle opération
              </h2>
            </div>
          </Dialog.Title>

          <Dialog.Description className="mt-1 mb-6 text-[13px] italic text-muted-foreground">
            Tu seras placé en général de l'État-Major Bleu.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nom de la bataille">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={80}
                placeholder="Ex : La revanche de Bouvines"
                autoFocus
                className="w-full bg-[rgba(2,6,23,0.5)] border border-[rgba(226,232,240,0.18)] border-b-tactica-amber/40 text-foreground placeholder:text-foreground/30 placeholder:italic px-3 py-[10px] rounded-[2px] text-[14px] outline-none focus:border-tactica-amber focus:shadow-[inset_0_0_0_1px_rgba(239,159,39,0.3)]"
              />
            </Field>

            <div className="flex gap-[14px]">
              <Field label="Effectif" className="flex-1">
                <select
                  value={maxPlayers}
                  onChange={e => setMaxPlayers(Number(e.target.value))}
                  className="w-full bg-[rgba(2,6,23,0.5)] border border-[rgba(226,232,240,0.18)] border-b-tactica-amber/40 text-foreground px-3 py-[10px] rounded-[2px] text-[14px] outline-none focus:border-tactica-amber"
                >
                  <option value={2}>2 officiers (1 contre 1)</option>
                  <option value={4}>4 officiers (2 contre 2)</option>
                </select>
              </Field>
              <Field label="Scénario" className="flex-1">
                <select
                  disabled
                  className="w-full bg-[rgba(2,6,23,0.5)] border border-[rgba(226,232,240,0.18)] text-foreground/60 px-3 py-[10px] rounded-[2px] text-[14px] cursor-not-allowed"
                >
                  <option>MVP-Plaine</option>
                </select>
                <p className="text-[11px] italic text-muted-foreground mt-[5px]">
                  D'autres terrains arrivent en Phase 1.
                </p>
              </Field>
            </div>

            {/* Toggle privee : pre-cable mais desactive en Phase 0 */}
            <div className="flex items-center justify-between p-[11px_13px] bg-[rgba(2,6,23,0.4)] border border-dashed border-[rgba(226,232,240,0.18)] rounded-[2px] opacity-50 cursor-not-allowed">
              <div>
                <div className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-semibold">
                  Opération secrète
                </div>
                <small className="block text-[11px] italic text-muted-foreground mt-[2px]">
                  Code d'invitation requis (bientôt)
                </small>
              </div>
              <input type="checkbox" disabled />
            </div>

            <div className="flex gap-[10px] justify-end pt-[18px] border-t border-[rgba(226,232,240,0.10)] mt-[24px]">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="bg-transparent border-none text-muted-foreground hover:text-foreground px-4 py-[9px] rounded-[2px] text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors"
                >
                  Annuler
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting}
                className="bg-tactica-amber hover:bg-[#ffb13d] disabled:bg-tactica-amber/25 disabled:text-[#EF9F27]/50 disabled:cursor-not-allowed text-[#1a1208] px-[22px] py-[11px] text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors"
                style={{ clipPath: PRIMARY_BTN_CLIP }}
              >
                {submitting ? 'Engagement…' : 'Engager'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface FieldProps {
  label: string
  className?: string
  children: ReactNode
}

function Field({ label, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label className="block mb-[7px] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
