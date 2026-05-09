# dependency-map.md

Format : `fichier <- dependants`.

---

## Lots 1-5 (rappel condensé)

```
src/lib/env.ts <- supabase.ts
src/lib/supabase.ts <- useAuth, useGames, useGame, useRealtime
src/lib/cn.ts <- composants UI
src/types/game.ts <- hooks, ui/*, render/*, engine/scales/types.ts
src/hooks/useAuth.ts <- useRequireAuth, Auth.tsx
src/hooks/useRequireAuth.ts <- Lobby, Game
src/engine/hex/* <- engine/hex/index.ts <- render/hex/HexTile, HexGrid, render/_data/mvpUnitPlacement.test
src/engine/scales/* <- engine/scales/index.ts <- render/hex/HexGrid, render/camera/CameraController, render/scenes/TacticalScene
src/ui/lobby/*, src/ui/game/* <- Lobby, Game
src/App.tsx <- main.tsx
```

## Lot 6A — render/

```
src/render/colors.ts
  <- src/render/hex/HexTile.tsx
  <- src/render/units/UnitPlaceholder.tsx
  <- src/render/index.ts

src/render/types.ts
  <- src/render/hex/HexTile.tsx
  <- src/render/hex/HexGrid.tsx
  <- src/render/units/UnitPlaceholder.tsx
  <- src/render/scenes/TacticalScene.tsx
  <- src/render/_data/mvpUnitPlacement.ts
  <- src/render/index.ts

src/render/hex/HexTile.tsx
  <- src/render/hex/HexGrid.tsx
  <- src/render/index.ts

src/render/hex/HexGrid.tsx
  <- src/render/scenes/TacticalScene.tsx
  <- src/render/index.ts

src/render/units/UnitPlaceholder.tsx
  <- src/render/scenes/TacticalScene.tsx
  <- src/render/index.ts

src/render/camera/CameraController.tsx
  <- src/render/scenes/TacticalScene.tsx
  <- src/render/index.ts

src/render/lighting/SceneLighting.tsx
  <- src/render/scenes/TacticalScene.tsx
  <- src/render/index.ts

src/render/scenes/SceneLoader.tsx
  <- src/render/scenes/SceneShell.tsx

src/render/scenes/SceneShell.tsx
  <- src/render/scenes/TacticalScene.tsx
  <- src/render/index.ts

src/render/scenes/TacticalScene.tsx
  <- src/render/index.ts
  <- src/ui/pages/Game.tsx

src/render/_data/mvpUnitPlacement.ts
  <- src/render/index.ts
  <- src/ui/pages/Game.tsx

src/render/index.ts
  <- src/ui/pages/Game.tsx
```

## Lot 7 — PWA + hooks

```
src/hooks/useOnlineStatus.ts
  <- src/ui/pages/Game.tsx

src/ui/components/UpdatePrompt.tsx
  <- src/App.tsx

virtual:pwa-register/react (généré par vite-plugin-pwa)
  <- src/ui/components/UpdatePrompt.tsx
```

**Vérifications** :
- `render/` importe depuis `engine/hex`, `engine/scales`, `@/types/game`, drei/three. Aucun import depuis `hooks/`, `ui/components/`.
- `engine/` n'importe rien depuis `render/` ou `ui/` (engine reste pur).
- `hooks/useOnlineStatus.ts` : zéro dépendance externe (juste React).
- `ui/components/UpdatePrompt.tsx` : importe `virtual:pwa-register/react` + `sonner`. Zéro Three.js.

Aucun cycle.
