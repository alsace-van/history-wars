// v1.0 (09/05/2026) — Lot 7 : detection nouvelle version SW + toast sonner "Recharger"
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1h

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // Check periodique toutes les heures
      const interval = window.setInterval(() => {
        void registration.update()
      }, UPDATE_CHECK_INTERVAL_MS)
      // Check aussi a la reprise de focus de l'onglet (sessions longues)
      const onVisibility = () => {
        if (document.visibilityState === 'visible') {
          void registration.update()
        }
      }
      document.addEventListener('visibilitychange', onVisibility)
      // Pas de cleanup explicite : registration persiste sur la duree de vie de la page
      void interval
      void onVisibility
    },
    onRegisterError(error) {
      console.error('[UpdatePrompt v1.0] SW register failed', error)
    },
  })

  useEffect(() => {
    if (!needRefresh) return
    const id = toast('Nouvelle version disponible', {
      description: 'Recharge pour appliquer la mise à jour.',
      duration: Infinity,
      action: {
        label: 'Recharger',
        onClick: () => {
          setNeedRefresh(false)
          void updateServiceWorker(true)
        },
      },
      cancel: {
        label: 'Plus tard',
        onClick: () => setNeedRefresh(false),
      },
    })
    return () => {
      toast.dismiss(id)
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker])

  return null
}
