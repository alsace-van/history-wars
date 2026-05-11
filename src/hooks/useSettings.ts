// v1.1 (11/05/2026) — Phase 2.5 C : ajout skipShakenWarning (modale Ébranlé)
// v1.0 (10/05/2026) — Phase 2 2.5 : préférences utilisateur persistées (localStorage)
import { useCallback, useEffect, useState } from 'react'

export type AnimationSpeed = 'instant' | 'fast' | 'normal'

export interface Settings {
  animationSpeed: AnimationSpeed
  /** Phase 2.5 — si true, ne plus afficher la modale "Attaquer en sous-effectif" pour les unités Ébranlées. */
  skipShakenWarning: boolean
}

export const ANIMATION_DURATION_MS: Record<AnimationSpeed, number> = {
  instant: 0,
  fast: 800,
  normal: 1800,
}

const STORAGE_KEY = 'tactica:settings'
const DEFAULT_SETTINGS: Settings = { animationSpeed: 'normal', skipShakenWarning: false }

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    const speed = parsed.animationSpeed
    const validSpeed = speed === 'instant' || speed === 'fast' || speed === 'normal' ? speed : DEFAULT_SETTINGS.animationSpeed
    return {
      animationSpeed: validSpeed,
      skipShakenWarning: typeof parsed.skipShakenWarning === 'boolean' ? parsed.skipShakenWarning : DEFAULT_SETTINGS.skipShakenWarning,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function persistSettings(s: Settings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // quota / mode privé — best effort
  }
}

interface UseSettingsResult {
  settings: Settings
  setAnimationSpeed: (speed: AnimationSpeed) => void
  setSkipShakenWarning: (skip: boolean) => void
  /** Durée d'animation courante en ms (dérivée de animationSpeed). */
  animationDurationMs: number
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  // Sync inter-onglets : un autre onglet change la pref → on met à jour.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      setSettings(loadSettings())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setAnimationSpeed = useCallback((speed: AnimationSpeed) => {
    setSettings(prev => {
      const next: Settings = { ...prev, animationSpeed: speed }
      persistSettings(next)
      return next
    })
  }, [])

  const setSkipShakenWarning = useCallback((skip: boolean) => {
    setSettings(prev => {
      const next: Settings = { ...prev, skipShakenWarning: skip }
      persistSettings(next)
      return next
    })
  }, [])

  return {
    settings,
    setAnimationSpeed,
    setSkipShakenWarning,
    animationDurationMs: ANIMATION_DURATION_MS[settings.animationSpeed],
  }
}
