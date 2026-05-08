# dependency-map.md

Graph des imports entre fichiers du projet. Mis a jour quand de nouveaux modules sont crees ou des imports modifies.

Format : `fichier <- dependants` (qui depend de moi).

---

## Lot 1

```
src/lib/env.ts
  <- src/lib/supabase.ts
  <- src/App.tsx

src/lib/supabase.ts
  <- (aucun pour l'instant, sera utilise Lot 2 par useAuth)

src/main.tsx
  <- (point d'entree, pas de dependants)

src/App.tsx
  <- src/main.tsx
```

Aucun cycle d'import, structure plate.
