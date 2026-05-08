# WIP.md

Journal des sessions de developpement, plus recente en haut. Maximum 10 entrees, on tronque en bas.

---

## Session 3 &mdash; 08/05/2026 &mdash; Lot 2 addendum carrousel

**Fait** :
- Refonte de `AuthBackground.tsx` en carrousel automatique : 4 slides, tempo 8s, transition fade 1s, effet Ken Burns (zoom 1.08x + leger translate sur 9s).
- 4 scenes SVG separees dans `src/ui/auth/scenes/` :
  - `SceneInfantryMarch.tsx` (l'originale, infanterie en marche + lune + grille hex)
  - `SceneCavalryCharge.tsx` (cavaliers au galop + poussiere)
  - `SceneBattleFormation.tsx` (formations carrees vues du dessus, drapeaux, deux camps)
  - `SceneTopoMap.tsx` (carte topographique style etat-major, courbes de niveau, riviere, villages)
- Citations defilent en sync avec les images (4 citations, une par slide). Le Typewriter se reset a chaque changement de slide via cle React.
- `Auth.tsx` simplifie : la zone citation disparait du composant, gere par `AuthBackground`. La page mode-specifique ne contient plus que titre + sous-titre + formulaire cote gauche.
- Tailwind config etendue avec keyframe `kenburns` et animation `animate-kenburns`.

**A faire cote utilisateur** :
- Dezipper sur le dossier existant (ecrase Auth.tsx, AuthBackground.tsx, tailwind.config.js, WIP.md, dependency-map.md ; ajoute les 4 scenes).
- `npm run dev` (pas de nouvelles deps).
- Tester : aller sur `/auth?mode=signin`, voir les 4 images defiler toutes les 8 secondes avec un leger zoom, et la citation changer en sync.

**Decisions** :
- Les SVG restent placeholders. Quand l'utilisateur trouvera ses 3-4 vraies gravures/cartes, il suffira de remplacer le tableau `SLIDES` dans `AuthBackground.tsx` par des `<img src="..." />` ou des composants Scene custom.
- Les citations sont independantes du mode (signin/signup/reset). Quel que soit le mode, le carrousel droite tourne. Le titre/sous-titre cote formulaire reste lui mode-specifique.

**Prochain Lot** :
- Lot 3 : Lobby (creer/lister/rejoindre une partie) + Realtime sync 2 onglets. Avant : maquette HTML du lobby.

---

## Session 2 &mdash; 08/05/2026 &mdash; Phase 0 Lot 2

**Fait** :
- Migration BDD `001_foundations` appliquee : tables `profiles`, `games`, `game_players` avec RLS active sur les 3.
- Trigger `handle_new_user` cree le profil automatiquement au signup, derive le pseudo depuis `raw_user_meta_data.username` (avec fallback email).
- Migration `002_secure_handle_new_user` : revoke EXECUTE pour anon/authenticated/public sur la fonction (advisor security WARN resolu).
- 0 lint security restant.
- Nouvelles deps installees (a faire `npm install` cote utilisateur) : `@radix-ui/react-slot`, `@radix-ui/react-label`, `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`, `tailwindcss-animate`.
- Tailwind config etendue avec systeme shadcn (CSS variables HSL : `--background`, `--foreground`, `--primary`, etc.) en plus des tokens custom TACTICA.
- `src/index.css` avec definitions CSS variables dark mode.
- Composants atomes ajoutes : `Label`, `Input`, `Button`, `PasswordInput`, `Typewriter`.
- `AuthBackground.tsx` initial avec un seul SVG.
- `Auth.tsx` : page split-screen 4 modes (`?mode=signin|signup|reset|update-password`).
- `Home.tsx` : page d'accueil placeholder protegee.
- Hooks : `useAuth`, `useRequireAuth`.
- `cn.ts` utility clsx + tailwind-merge.
- `App.tsx` : router avec `/` (Home protegee) et `/auth`.

**Prochain Lot** :
- Lot 3 : Lobby + Realtime.

---

## Session 1 &mdash; 08/05/2026 &mdash; Phase 0 Lot 1

**Fait** :
- Initialisation du projet Vite + React 18 + TypeScript strict.
- Configuration Tailwind, Radix, alias d'imports (`@/`, `@engine/`, `@render/`, `@ui/`, `@hooks/`, `@lib/`).
- Structure de dossiers complete `src/{engine,render,ui,hooks,types,styles,lib}` avec README placeholders.
- Validation Zod des env vars (`src/lib/env.ts`).
- Client Supabase singleton (`src/lib/supabase.ts`).
- Page d'accueil minimale (App.tsx) qui affiche TACTICA + statut config Supabase.
- `.env.local` rempli avec credentials projet "history wars".
- Documentation initiale.

**Prochain Lot** :
- Lot 2 : Supabase + auth.
