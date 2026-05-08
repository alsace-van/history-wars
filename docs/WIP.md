# WIP.md

Journal des sessions de developpement, plus recente en haut. Maximum 10 entrees, on tronque en bas.

---

## Session 1 &mdash; 08/05/2026 &mdash; Phase 0 Lot 1

**Fait** :
- Initialisation du projet Vite + React 18 + TypeScript strict.
- Configuration Tailwind, Radix, alias d'imports (`@/`, `@engine/`, `@render/`, `@ui/`, `@hooks/`, `@lib/`).
- Structure de dossiers complete `src/{engine,render,ui,hooks,types,styles,lib}` avec README placeholders.
- Validation Zod des env vars (`src/lib/env.ts`).
- Client Supabase singleton (`src/lib/supabase.ts`).
- Page d'accueil minimale (App.tsx) qui affiche TACTICA + statut config Supabase.
- `.env.local` rempli avec credentials projet "history wars" (`abhbkdyoknrsdavimbpr`).
- Documentation initiale : CLAUDE.md, BACKLOG.md, dependency-map.md.

**A faire** :
- `npm install` cote utilisateur.
- `npm run dev`, verifier que `localhost:5173` rend "TACTICA" + badge "Supabase configure" en vert.
- `npm run tsc` doit passer 0 erreur.
- Premier commit + push sur le repo GitHub.

**Decisions** :
- Pas encore de `react-router-dom` cable : `App.tsx` est une seule page. Sera ajoute Lot 3 (lobby).
- Pas de TacticalScene en Lot 1 : la 3D arrive en Lot 4.
- `SCALE_CONFIG` n'existe pas encore : tous les composants R3F qui en dependront seront crees en Lot 4.

**Prochain Lot** :
- Lot 2 : Supabase + auth (tables avec RLS, signup, login, logout, hook `useAuth`).
