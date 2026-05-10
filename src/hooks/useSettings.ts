// v1.0 (10/05/2026) — Phase 2 2.5 : préférences utilisateur persistées (localStorage)
// Stocke des préférences UX qui ne touchent pas l'état serveur. Source unique pour CombatAnimator
// et DamageFloater (durées + activation/désactivation des animations).
import { useCallback, useEffect, useState } from 'react'

export type AnimationSpeed = 'instant' | 'fast' | 'normal'

export interface Settings {
  animationSpeed: AnimationSpeed
}

export const ANIMATION_DURATION_MS: Record<AnimationSpeed, number> = {
  instant: 0,
  fast: 800,
  normal: 1800,
}

const STORAGE_KEY = 'tactica:settings'
const DEFAULT_SETTINGS: Settings = { animationSpeed: 'normal' }

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    const speed = parsed.animationSpeed
    if (speed !== 'instant' && speed !== 'fast' && speed !== 'normal') return DEFAULT_SETTINGS
    return { animationSpeed: speed }
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

  return {
    settings,
    setAnimationSpeed,
    animationDurationMs: ANIMATION_DURATION_MS[settings.animationSpeed],
  }
}
