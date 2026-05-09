# dependency-map.md

Format : `fichier <- dependants`.

---

## Lot 1

```
src/lib/env.ts <- src/lib/supabase.ts
src/lib/supabase.ts <- src/hooks/useAuth.ts, useGames.ts, useGame.ts, useRealtime.ts
```

## Lot 2

```
src/lib/cn.ts <- Label.tsx, Input.tsx, Button.tsx, PasswordInput.tsx, GameCard.tsx, Lobby.tsx, Game.tsx, PlayerSlot.tsx
src/ui/components/* <- Auth.tsx, GameCard.tsx
src/hooks/useAuth.ts <- useRequireAuth.ts, Auth.tsx
src/hooks/useRequireAuth.ts <- Lobby.tsx, Game.tsx
src/App.tsx <- main.tsx
```

## Lot 4

```
src/types/game.ts <- useGames, useGame, GameCard, CreateGameDialog, Lobby, Game, PlayerSlot, engine/scales/types.ts
src/hooks/useRealtime.ts <- Lobby, Game
src/ui/layout/PageBackground.tsx <- Lobby, Game
src/ui/lobby/* <- Lobby
src/ui/game/PlayerSlot.tsx <- Game
src/ui/pages/Lobby.tsx, Game.tsx <- App.tsx
```

## Lot 5 (engine pur, aucun import depuis React)

```
src/engine/hex/types.ts
  <- src/engine/hex/coordinates.ts
  <- src/engine/hex/distance.ts
  <- src/engine/hex/neighbors.ts
  <- src/engine/hex/line.ts
  <- src/engine/hex/key.ts

src/engine/hex/coordinates.ts
  <- src/engine/hex/line.ts
  <- src/engine/hex/index.ts

src/engine/hex/distance.ts
  <- src/engine/hex/line.ts
  <- src/engine/hex/index.ts

src/engine/hex/neighbors.ts
  <- src/engine/hex/index.ts

src/engine/hex/line.ts
  <- src/engine/hex/index.ts

src/engine/hex/key.ts
  <- src/engine/hex/index.ts

src/engine/hex/index.ts
  <- (sera importe par src/render/hex/HexGrid.tsx au Lot 6)

src/engine/scales/types.ts
  <- src/engine/scales/config.ts
  <- src/engine/scales/index.ts
  (importe Scale depuis @/types/game)

src/engine/scales/config.ts
  <- src/engine/scales/index.ts

src/engine/scales/index.ts
  <- (sera importe par src/render/* au Lot 6)
```

**Vérifications** :
- `engine/` n'importe rien depuis `render/`, `ui/`, `hooks/` : OK (engine pur).
- `engine/scales/types.ts` importe `Scale` depuis `@/types/game` : 1 import unidirectionnel, pas de cycle (`@/types/game` n'importe rien depuis engine).

---

Aucun cycle d'import.
