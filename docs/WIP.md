# WIP.md

Journal des sessions de developpement, plus recente en haut. Maximum 10 entrees, on tronque en bas.

---

## Session 6 &mdash; 08/05/2026 &mdash; Phase 0 Lot 4 sous-lot 4B : hooks + page Lobby React

**Fait** :
- `package.json` v0.0.3 : ajout dependance `sonner@^1.7.1` (toasts).
- `index.html` : ajout link Google Fonts pour `Cormorant Garamond` (italique 400-600), preconnect googleapis + gstatic.
- `src/hooks/useRealtime.ts` v1.0 : hook generique pour Supabase Realtime.
  - Signature `useRealtime({ channelName, enabled, postgresChanges, presence })`.
  - `postgresChanges` : tableau de configs `{ table, event, filter, onChange }` — INSERT/UPDATE/DELETE.
  - `presence` : `{ userId, userMeta, onSync }` — tracker qui est en ligne sur le channel.
  - Callbacks stockes en ref → passer un nouveau tableau de configs ne re-subscribe pas.
  - Cleanup obligatoire dans useEffect (`removeChannel`).
  - Retourne `{ stale }` qui passe a `true` au CHANNEL_ERROR / TIMED_OUT / CLOSED.
- `src/hooks/useGames.ts` v1.0 : CRUD parties.
  - `list` (refresh) : 3 requetes (games + game_players + profiles), compose `GameWithPlayers[]` cote client.
  - `createGame({ name, maxPlayers })` : insert `games`, puis insert host comme slot 0 (general bleu). Rollback si erreur sur le 2e insert.
  - `joinGame(gameId)` : calcule prochain slot libre via `nextFreeSlot`, derive team/role via `deriveSlotAssignment`, insert.
  - `leaveGame(gameId)` : delete game_player de l'utilisateur courant.
  - `kickPlayer(playerId)` : delete par id (RLS verifie que je suis hote).
  - `deleteGame(gameId)` : delete game (RLS verifie hote + status=lobby, cascade sur game_players).
  - try/catch + retours `{ error: string | null }` partout. Logs versionnes avec TAG.
- `src/ui/layout/PageBackground.tsx` v1.0 : composant fond global (carte Austerlitz `/scenes/austerlitz.png` + overlay sombre eclairci). Reutilise par Game.tsx au sous-lot 4C.
- `src/ui/lobby/GameCard.tsx` v1.0 : carte d'une partie dans la liste.
  - Bordure gauche ambre quand c'est ma partie.
  - Pastilles colorees blue/red/free pour les slots.
  - Bouton variable selon le contexte : "Voir" (mes parties), "Pleine" disabled, "Rejoindre →" pill bleu.
  - `formatRelative()` interne pour "il y a X min".
- `src/ui/lobby/CreateGameDialog.tsx` v1.0 : modale "Ordre de bataille".
  - Radix Dialog (overlay + content + close).
  - Coin coupe en haut-droite via `clip-path: polygon(...)`, brackets ambre aux 3 autres coins.
  - 3 champs : nom, effectif (2 ou 4), scenario (disabled MVP-Plaine).
  - Toggle "Operation secrete" pre-cable mais desactive (Phase 0).
  - Bouton "Engager" en ambre avec coin coupe.
  - Validation : nom obligatoire, toast.error sinon. toast.success a la creation.
- `src/ui/pages/Lobby.tsx` v1.0 : page principale `/lobby`.
  - Header : logo TACTICA + sous-titre "Salle de commandement", pseudo, bouton Quitter.
  - Sub-header : titre "Bataillons en attente" en serif italique + bouton "+ Nouvelle operation".
  - Tabs "Toutes les parties" / "Mes parties" avec badges.
  - Liste GameCard. Si vide : EmptyState avec CTA. Si loading : SkeletonList (3 placeholders).
  - Footer compteur : N operations actives + N officiers en ligne (presence Realtime).
  - useRealtime sur channel `lobby:public` : INSERT/UPDATE/DELETE sur games + game_players → refresh.
- `src/App.tsx` v1.0b : routes `/lobby` + redirection `/` → `/lobby`. `<Toaster />` sonner monte au top, theme dark, bordure ambre, position top-right.

**Decisions** :
- Toast lib = `sonner@^1.7.1` (compact, accessible, intégré React 18, ~3KB).
- Compteur officiers en ligne via Realtime presence sur `lobby:public` channel.
- Race condition slot au join : on s'appuie sur la contrainte UNIQUE BDD, l'utilisateur voit l'erreur. Pas de retry pour MVP.
- Pas de pagination Lobby pour Phase 0 (limite 50 parties recentes), suffit largement.

**A faire cote utilisateur** :
1. **`npm install`** (recupere `sonner`).
2. **Supprimer manuellement** `src/ui/pages/Home.tsx` — il n'est plus reference, App.tsx route maintenant directement vers Lobby.
3. Si pas deja fait au sous-lot 4A : supprimer les 4 fichiers `src/ui/auth/scenes/Scene*.tsx` + le dossier `scenes/` vide.
4. **`npm run dev`** + se connecter, tu atterris sur `/lobby`.
5. **Tester en 2 navigateurs** (un en navigation privee) :
   - A cree une partie → B la voit apparaitre **sans refresh**.
   - B clique Rejoindre → A voit B arriver dans les slots **sans refresh**.
   - A et B comptent comme "officiers en ligne" en footer.
6. `npm run tsc` doit passer 0 erreur.

**Prochain sous-lot 4C** : page `Game.tsx` placeholder (route `/game/:id`) avec slots blue/red, kick (hote), bouton "Engager la bataille" disabled. Mises a jour finales `AUDIT-PHASE-0.md`.

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
  - Index secondaires.
- `src/types/game.ts` cree.
- 2 maquettes HTML statiques validees par utilisateur (BG Austerlitz, typo serif Cormorant, accent ambre, modale "Ordre de bataille" avec coin coupe).

**Decisions retenues** :
- Migration idempotente avec `DROP POLICY IF EXISTS ... CREATE POLICY ...`.
- `Home.tsx` sera supprime au sous-lot 4B.
- `sonner` sera installe au sous-lot 4B.
- `is_bot` et `bot_difficulty` ajoutees des la migration 003.

---

## Session 4 &mdash; 08/05/2026 &mdash; Lot 2 carrousel images reelles

**Fait** :
- 3 images uploadees dans `public/scenes/` :
  - `bouvines.png` (peinture cinematique medievale, format vertical 941x1672)
  - `austerlitz.png` (carte ancienne style etat-major, format paysage 1536x1024)
  - `verdun.png` (carte ancienne, format paysage 1536x1024)
- `AuthBackground.tsx` v1.0b : bascule des SVG composants vers `<img>`.
- Citations adaptees aux epoques.
- Overlay double + bg de secours pendant le chargement.

**Non utilises** (a supprimer manuellement au sous-lot 4A/4B) :
- `src/ui/auth/scenes/Scene*.tsx` (les 4 fichiers)

---

## Session 3 &mdash; 08/05/2026 &mdash; Lot 2 addendum carrousel

**Fait** :
- Refonte de `AuthBackground.tsx` en carrousel automatique : 4 slides, tempo 8s, transition fade 1s, effet Ken Burns.
- 4 scenes SVG separees (remplacees par images reelles en Session 4).
- Citations defilent en sync avec les images.
- Tailwind config etendue avec keyframe `kenburns`.

---

## Session 2 &mdash; 08/05/2026 &mdash; Phase 0 Lot 2

**Fait** :
- Migration BDD `001_foundations` appliquee : tables `profiles`, `games`, `game_players` avec RLS active sur les 3.
- Trigger `handle_new_user`. Migration `002_secure_handle_new_user`.
- Composants atomes : `Label`, `Input`, `Button`, `PasswordInput`, `Typewriter`.
- `Auth.tsx` : page split-screen 4 modes.
- Hooks : `useAuth`, `useRequireAuth`.
- `App.tsx` : router avec `/` (Home protegee) et `/auth`.

---

## Session 1 &mdash; 08/05/2026 &mdash; Phase 0 Lot 1

**Fait** :
- Initialisation Vite + React 18 + TypeScript strict.
- Configuration Tailwind, Radix, alias d'imports.
- Validation Zod des env vars.
- Client Supabase singleton.
