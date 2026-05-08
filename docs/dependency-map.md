# dependency-map.md

Graph des imports entre fichiers du projet. Mis a jour quand de nouveaux modules sont crees ou des imports modifies.

Format : `fichier <- dependants` (qui depend de moi).

---

## Lot 1

```
src/lib/env.ts
  <- src/lib/supabase.ts

src/lib/supabase.ts
  <- src/hooks/useAuth.ts
  <- src/hooks/useGames.ts
  <- src/hooks/useRealtime.ts
```

## Lot 2

```
src/lib/cn.ts
  <- src/ui/components/Label.tsx
  <- src/ui/components/Input.tsx
  <- src/ui/components/Button.tsx
  <- src/ui/components/PasswordInput.tsx
  <- src/ui/lobby/GameCard.tsx
  <- src/ui/pages/Lobby.tsx

src/ui/components/Label.tsx
  <- src/ui/components/PasswordInput.tsx
  <- src/ui/pages/Auth.tsx

src/ui/components/Input.tsx
  <- src/ui/components/PasswordInput.tsx
  <- src/ui/pages/Auth.tsx

src/ui/components/Button.tsx
  <- src/ui/pages/Auth.tsx
  <- src/ui/lobby/GameCard.tsx

src/ui/components/PasswordInput.tsx
  <- src/ui/pages/Auth.tsx

src/ui/components/Typewriter.tsx
  <- src/ui/auth/AuthBackground.tsx

src/ui/auth/AuthBackground.tsx
  <- src/ui/pages/Auth.tsx

src/hooks/useAuth.ts
  <- src/hooks/useRequireAuth.ts
  <- src/ui/pages/Auth.tsx

src/hooks/useRequireAuth.ts
  <- src/ui/pages/Lobby.tsx

src/ui/pages/Auth.tsx
  <- src/App.tsx

src/App.tsx
  <- src/main.tsx
```

## Lot 4 (sous-lots 4A + 4B)

```
src/types/game.ts
  <- src/hooks/useGames.ts
  <- src/ui/lobby/GameCard.tsx
  <- src/ui/lobby/CreateGameDialog.tsx
  <- src/ui/pages/Lobby.tsx

src/hooks/useGames.ts
  <- src/ui/pages/Lobby.tsx

src/hooks/useRealtime.ts
  <- src/ui/pages/Lobby.tsx
  (sera importe par Game.tsx au sous-lot 4C)

src/ui/layout/PageBackground.tsx
  <- src/ui/pages/Lobby.tsx
  (sera importe par Game.tsx au sous-lot 4C)

src/ui/lobby/GameCard.tsx
  <- src/ui/pages/Lobby.tsx

src/ui/lobby/CreateGameDialog.tsx
  <- src/ui/pages/Lobby.tsx

src/ui/pages/Lobby.tsx
  <- src/App.tsx
```

**Fichiers supprimes** (sous-lot 4B) :
```
src/ui/pages/Home.tsx                          [remplace par redirection / -> /lobby]
src/ui/auth/scenes/SceneInfantryMarch.tsx      [non importe depuis Lot 2 Session 4]
src/ui/auth/scenes/SceneCavalryCharge.tsx      [non importe depuis Lot 2 Session 4]
src/ui/auth/scenes/SceneBattleFormation.tsx    [non importe depuis Lot 2 Session 4]
src/ui/auth/scenes/SceneTopoMap.tsx            [non importe depuis Lot 2 Session 4]
```

---

Aucun cycle d'import.
