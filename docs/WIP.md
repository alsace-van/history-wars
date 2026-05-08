# WIP.md

Journal des sessions de developpement, plus recente en haut. Maximum 10 entrees, on tronque en bas.

---

## Session 5 &mdash; 08/05/2026 &mdash; Phase 0 Lot 4 sous-lot 4A : migration BDD + types + maquettes

**Fait** :
- Migration `003_lobby_columns.sql` ecrite (idempotente, peut etre rejouee sans casser).
  - Colonnes ajoutees a `games` : `turn_number`, `mode`, `is_private`, `invite_code`, `last_action_at`, `max_players`, `scenario_id`.
  - CHECK constraints sur `mode`, `status`, `max_players`.
  - Index unique partiel sur `invite_code` (NULL autorise).
  - Colonnes ajoutees a `game_players` : `team`, `role`, `slot_index`, `is_bot`, `bot_difficulty`.
  - CHECK constraints sur `team`, `role`, `bot_difficulty`.
  - Contraintes UNIQUE sur `(game_id, user_id)` et `(game_id, slot_index)`.
  - 4 RLS policies sur `games` (select public lobby, select member, insert self, update host, delete host).
  - 4 RLS policies sur `game_players` (select visible, insert self humain, delete self, delete host kick).
  - Publication `supabase_realtime` etendue a `games` et `game_players` (idempotent via `pg_publication_tables`).
  - Index secondaires : `games_status_idx` (partiel sur lobby), `games_created_by_idx`, `game_players_game_id_idx`, `game_players_user_id_idx`.

- `src/types/game.ts` cree :
  - Types literaux : `GameStatus`, `GameMode`, `Scale`, `Team`, `PlayerRole`, `BotDifficulty`.
  - Constantes : `MAX_PLAYERS_DEFAULT/MIN/MAX`, `DEFAULT_SCENARIO_ID`, `DEFAULT_SCALE`, `DEFAULT_MODE`.
  - Interfaces BDD : `Game`, `GamePlayer`.
  - Modeles enrichis : `GameWithPlayers`, `GamePlayerWithProfile`.
  - Helpers : `isHost`, `isPlayerInGame`, `freeSlotsCount`, `isGameFull`, `nextFreeSlot`, `deriveSlotAssignment`.

- 2 maquettes HTML statiques pour validation visuelle avant React :
  - `maquettes/maquette-lobby.html` : header + sub-header + tabs + 3 cartes de partie + footer compteur + modale "Creer une partie" ouverte.
  - `maquettes/maquette-game.html` : header + 2 colonnes equipes (blue/red) + slots + bouton Demarrer desactive avec tooltip "Phase 1".

**Decisions retenues (recommandations PLAN-LOT-4)** :
- Migration **idempotente** avec `DROP POLICY IF EXISTS ... CREATE POLICY ...` (parce que `CREATE POLICY IF NOT EXISTS` n'existe pas avant Postgres 17).
- `Home.tsx` sera **supprime** au sous-lot 4B au profit d'une redirection `/` -> `/lobby`.
- `sonner` sera installe au sous-lot 4B pour les toasts.
- `is_bot` et `bot_difficulty` ajoutees des la migration 003 (Phase 2 ne necessitera pas de migration BDD, juste de l'UI).
- Code de partie privee : colonne `invite_code` ajoutee mais UI cachee/desactivee en Phase 0.

**A faire cote utilisateur** :
1. Copier-coller le contenu de `supabase/migrations/003_lobby_columns.sql` dans le SQL editor Supabase et l'executer. **0 erreur attendue**.
2. Verifier dans Database > Replication que les tables `games` et `game_players` sont bien dans la publication `supabase_realtime`.
3. Supprimer manuellement les 4 fichiers SVG inutilises :
   - `src/ui/auth/scenes/SceneCavalryCharge.tsx`
   - `src/ui/auth/scenes/SceneInfantryMarch.tsx`
   - `src/ui/auth/scenes/SceneTopoMap.tsx`
   - `src/ui/auth/scenes/SceneBattleFormation.tsx`
   - Le dossier `src/ui/auth/scenes/` peut etre supprime s'il est vide.
4. Ouvrir les 2 maquettes HTML dans un navigateur pour valider l'esthetique avant que je code en React.
5. Quand tu valides, je passe au sous-lot 4B (hooks `useGames` + `useRealtime`, page `Lobby.tsx`).

**Prochain Lot** :
- Sous-lot 4B : hooks + page Lobby React. Sous-lot 4C : page Game placeholder + mises a jour finales.

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
A supprimer au Lot 4 (deja flagge).

**Prochain Lot** :
- Lot 4 : Lobby + Realtime sync 2 onglets. Maquette HTML d'abord.

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
