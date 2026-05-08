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
  <- src/ui/pages/Home.tsx          [supprime au sous-lot 4B]
```

## Lot 2

```
src/lib/cn.ts
  <- src/ui/components/Label.tsx
  <- src/ui/components/Input.tsx
  <- src/ui/components/Button.tsx
  <- src/ui/components/PasswordInput.tsx

src/ui/components/Label.tsx
  <- src/ui/components/PasswordInput.tsx
  <- src/ui/pages/Auth.tsx

src/ui/components/Input.tsx
  <- src/ui/components/PasswordInput.tsx
  <- src/ui/pages/Auth.tsx

src/ui/components/Button.tsx
  <- src/ui/pages/Auth.tsx
  <- src/ui/pages/Home.tsx          [supprime au sous-lot 4B]

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
  <- src/ui/pages/Home.tsx          [supprime au sous-lot 4B]

src/ui/pages/Auth.tsx
  <- src/App.tsx

src/App.tsx
  <- src/main.tsx
```

## Lot 4 - sous-lot 4A (en cours)

**Nouveau fichier** :
```
src/types/game.ts
  <- (sera importe par useGames, Lobby, Game, GameCard, PlayerSlot au sous-lot 4B/4C)
```

**Fichiers supprimes** :
```
src/ui/auth/scenes/SceneInfantryMarch.tsx       [non importe]
src/ui/auth/scenes/SceneCavalryCharge.tsx       [non importe]
src/ui/auth/scenes/SceneBattleFormation.tsx     [non importe]
src/ui/auth/scenes/SceneTopoMap.tsx             [non importe]
```

`AuthBackground.tsx` ne les importait plus depuis Lot 2 Session 4 (passage aux images reelles).

---

Aucun cycle d'import.
