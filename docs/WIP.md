# WIP.md

Journal des sessions de developpement, plus recente en haut. Maximum 10 entrees, on tronque en bas.

---

## Session 4 &mdash; 08/05/2026 &mdash; Lot 2 carrousel images reelles

**Fait** :
- 3 images uploadees dans `public/scenes/` :
  - `bouvines.png` (peinture cinematique medievale, format vertical 941x1672)
  - `austerlitz.png` (carte ancienne style etat-major, format paysage 1536x1024)
  - `verdun.png` (carte ancienne, format paysage 1536x1024)
- `AuthBackground.tsx` v1.0b : bascule des SVG composants vers `<img>` avec `object-cover` + `object-position: center`. Tableau `SLIDES` de 3 entrees pour l'instant.
- Citations adaptees aux epoques :
  - Bouvines -> Sun Tzu (intemporel, va avec medieval)
  - Austerlitz -> Napoleon "Le genie de la guerre est de bien voir tout d'un coup d'oeil"
  - Verdun -> Nivelle "Ils ne passeront pas" (citation iconique de Verdun, 1916)
- Overlay double : un gradient global + un gradient renforce en bas pour la lisibilite de la citation. Bg de secours `#0a1224` sur le container pendant le chargement de l'image.
- `loading="eager"` sur la premiere image, `lazy` sur les suivantes pour optimiser le LCP.

**A noter (incoherence stylistique a regler plus tard)** :
- Bouvines est en peinture cinematique, Austerlitz et Verdun sont en cartes anciennes.
- A unifier quand l'utilisateur regenerera des images : soit toutes en peintures, soit toutes en cartes. La 4eme image (Renaissance/Marignan) sera generee demain.

**Non utilises** (mais laisses dans le projet en attendant) :
- `src/ui/auth/scenes/SceneInfantryMarch.tsx`
- `src/ui/auth/scenes/SceneCavalryCharge.tsx`
- `src/ui/auth/scenes/SceneBattleFormation.tsx`
- `src/ui/auth/scenes/SceneTopoMap.tsx`
A supprimer plus tard si l'utilisateur ne revient pas aux SVG.

**A faire cote utilisateur** :
- Dezipper sur le dossier existant.
- `npm run dev` (pas de nouvelles deps).
- Aller sur `/auth?mode=signin`, voir le carrousel de 3 images defiler avec Ken Burns et citations sync.
- Demain : ajouter la 4eme image (epoque Renaissance/Marignan ou autre), drag&drop dans la conversation, je l'integrerai.

**Prochain Lot** :
- Lot 3 : Lobby + Realtime sync 2 onglets. Maquette HTML d'abord.

---

## Session 3 &mdash; 08/05/2026 &mdash; Lot 2 addendum carrousel

**Fait** :
- Refonte de `AuthBackground.tsx` en carrousel automatique : 4 slides, tempo 8s, transition fade 1s, effet Ken Burns (zoom 1.08x + leger translate sur 9s).
- 4 scenes SVG separees dans `src/ui/auth/scenes/` (qui seront remplacees par des images reelles).
- Citations defilent en sync avec les images. Le Typewriter se reset a chaque changement de slide via cle React.
- `Auth.tsx` simplifie : la zone citation deplacee dans `AuthBackground`.
- Tailwind config etendue avec keyframe `kenburns` et animation `animate-kenburns`.

---

## Session 2 &mdash; 08/05/2026 &mdash; Phase 0 Lot 2

**Fait** :
- Migration BDD `001_foundations` appliquee : tables `profiles`, `games`, `game_players` avec RLS active sur les 3.
- Trigger `handle_new_user` cree le profil automatiquement au signup.
- Migration `002_secure_handle_new_user` : revoke EXECUTE pour anon/authenticated/public.
- Nouvelles deps : `@radix-ui/react-slot`, `@radix-ui/react-label`, `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`, `tailwindcss-animate`.
- Tailwind config etendue avec systeme shadcn (CSS variables HSL).
- Composants atomes : `Label`, `Input`, `Button`, `PasswordInput`, `Typewriter`.
- `Auth.tsx` : page split-screen 4 modes (`?mode=signin|signup|reset|update-password`).
- `Home.tsx` : page d'accueil placeholder protegee.
- Hooks : `useAuth`, `useRequireAuth`.
- `App.tsx` : router avec `/` (Home protegee) et `/auth`.

---

## Session 1 &mdash; 08/05/2026 &mdash; Phase 0 Lot 1

**Fait** :
- Initialisation Vite + React 18 + TypeScript strict.
- Configuration Tailwind, Radix, alias d'imports.
- Structure de dossiers complete.
- Validation Zod des env vars.
- Client Supabase singleton.
- Page d'accueil minimale.
- `.env.local` rempli avec credentials projet "history wars".
