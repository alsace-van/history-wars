// v1.0 (11/05/2026) — Phase 2.5 C : modale confirmation attaque sur unité Ébranlée (skipable)
// Source : docs/PLAN-MORAL-COHESION.md § 4 — état Ébranlé
import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'

const MODAL_CLIP =
  'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)'
const CONFIRM_BTN_CLIP =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

interface ShakenAttackConfirmProps {
  open: boolean
  /** Effectif courant de l'unité (pour message contextuel). */
  effective: number
  effectiveMax: number
  onConfirm: (dontShowAgain: boolean) => void
  onCancel: () => void
}

/**
 * Modale affichée quand le joueur tente d'attaquer avec une unité Ébranlée
 * (cohésion 0.2-0.5). Confirmation explicite + option "Ne plus afficher".
 *
 * UX :
 *  - 2 boutons : Annuler (gris) / Attaquer quand même (ambre)
 *  - Checkbox "Ne plus afficher cet avertissement" → persiste via useSettings.skipShakenWarning
 *  - Texte explique le risque + suggère attaque conjointe
 */
export function ShakenAttackConfirm({
  open,
  effective,
  effectiveMax,
  onConfirm,
  onCancel,
}: ShakenAttackConfirmProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const tauxPertes = effectiveMax > 0 ? Math.round((1 - effective / effectiveMax) * 100) : 0

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2
                     border border-amber-500/50 bg-slate-950/95 p-7 text-slate-100"
          style={{ clipPath: MODAL_CLIP }}
        >
          <Dialog.Title className="mb-3 text-lg font-bold uppercase tracking-wider text-amber-300">
            ⚠ Sous-effectif détecté
          </Dialog.Title>
          <Dialog.Description className="mb-5 text-sm leading-relaxed text-slate-300">
            Votre unité a perdu <span className="font-semibold text-amber-200">{tauxPertes}% de ses hommes</span>{' '}
            ({effective}/{effectiveMax}). Elle est <span className="text-amber-300">ébranlée</span> : engager seule
            un ennemi plein peut tourner au désastre.
            <br /><br />
            <span className="text-slate-400">
              Une attaque conjointe (avec une autre unité en flanc ou de la cavalerie) augmenterait
              significativement vos chances.
            </span>
          </Dialog.Description>

          <label className="mb-5 flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-300">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-amber-500"
            />
            Ne plus afficher cet avertissement
          </label>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="border border-slate-600 bg-slate-800/50 px-5 py-2 text-sm font-medium text-slate-300
                         transition hover:bg-slate-700/50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => onConfirm(dontShowAgain)}
              className="bg-amber-500 px-5 py-2 text-sm font-bold uppercase tracking-wider text-slate-950
                         transition hover:bg-amber-400"
              style={{ clipPath: CONFIRM_BTN_CLIP }}
            >
              Attaquer quand même
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
