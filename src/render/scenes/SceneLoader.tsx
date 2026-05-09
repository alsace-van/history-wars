// v1.0 (09/05/2026) — Fallback Suspense scene
import { Html } from '@react-three/drei'

export function SceneLoader() {
  return (
    <Html center>
      <div className="text-[12px] uppercase tracking-[0.18em] text-foreground/70 font-semibold">
        Chargement de la carte…
      </div>
    </Html>
  )
}
