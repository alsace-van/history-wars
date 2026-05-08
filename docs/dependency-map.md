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
  <- src/ui/pages/Home.tsx
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
  <- src/ui/pages/Home.tsx

src/ui/components/PasswordInput.tsx
  <- src/ui/pages/Auth.tsx

src/ui/components/Typewriter.tsx
  <- src/ui/pages/Auth.tsx

src/ui/auth/AuthBackground.tsx
  <- src/ui/pages/Auth.tsx

src/hooks/useAuth.ts
  <- src/hooks/useRequireAuth.ts
  <- src/ui/pages/Auth.tsx

src/hooks/useRequireAuth.ts
  <- src/ui/pages/Home.tsx

src/ui/pages/Auth.tsx
  <- src/App.tsx

src/ui/pages/Home.tsx
  <- src/App.tsx

src/App.tsx
  <- src/main.tsx
```

Aucun cycle d'import.
