# WIP.md

Journal des sessions de developpement, plus recente en haut. Maximum 10 entrees, on tronque en bas.

---

## Session 7 &mdash; 08/05/2026 &mdash; Phase 0 Lot 4 sous-lot 4C : page Game + fix RLS recursion

**Fait** :
- Migration `004_fix_rls_recursion.sql` ecrite et appliquee sur Supabase.
  - Cause : la policy `game_players_select_visible` faisait un `EXISTS (SELECT FROM game_players gp2)` qui re-declenche la meme policy → recursion infinie.
  - Fix : 3 fonctions `SECURITY DEFINER` qui contournent la RLS pour le check booleen :
    - `is_player_in_game(_game_id uuid)` → bool
    - `is_game_host(_game_id uuid)` → bool
    - `is_game_public_lobby(_game_id uuid)` → bool
  - Permissions : `revoke execute from public, anon` + `grant execute to authenticated` sur les 3 fonctions.
  - 3 policies recrites : `games_select_member`, `game_players_select_visible`, `game_players_delete_host`.
- Migration `005_drop_legacy_policies.sql` ecrite et appliquee.
  - Cause : la migration 001 avait laisse 6 policies en francais ("Voir les joueurs des parties accessibles", "Rejoindre une partie", etc.) qui faisaient des `EXISTS` croises sans `SECURITY DEFINER`. Postgres combine toutes les policies PERMISSIVE en OR, donc les anciennes faisaient toujours la recursion meme avec mes nouvelles policies propres.
  - Fix : drop des 6 policies par leur nom exact.
- `src/hooks/useGame.ts` v1.0 : single game CRUD pour la page Game.
  - 3 requetes : game (single), players (par game_id), profiles.
  - Expose `game`, `players`, `loading`, `notFound`, `error`, `refresh`, `leaveGame`, `kickPlayer`, `deleteGame`.
- `src/ui/game/PlayerSlot.tsx` v1.0 : composant slot pour la page Game.
  - Variante `PlayerSlot` (slot rempli) avec avatar carré, pseudo, badges Toi/Hote, role en uppercase, bouton kick (si autorise).
  - Variante `EmptyPlayerSlot` (slot vacant) en dashed border.
- `src/ui/pages/Game.tsx` v1.0 : page route `/game/:id`.
  - Header back-to-lobby + logo TACTICA + pseudo.
  - Game header : eyebrow ambre + titre serif italique + meta uppercase (scenario / scale / hote / tour / cree).
  - 2 colonnes equipes (`TeamPanel`) avec border-top color blue/red, slots blue (pair) et red (impair) selon `deriveSlotAssignment`.
  - Footer actions : compteur effectif + bouton "Quitter la bataille" / "Dissoudre la partie" (selon role) + bouton "Engager la bataille" disabled avec tooltip "Disponible Phase 1".
  - Brackets ambre dans les 4 coins du footer.
  - Realtime sur channel `game:{gameId}` : UPDATE games + DELETE games (notifie + redirige) + tout sur game_players → refresh.
  - Securite : redirect vers /lobby si la partie n'existe pas OU si je n'y suis pas (membre OU hote).
- `src/App.tsx` v1.0c : route `/game/:id` ajoutee.
- `docs/CLAUDE.md` : ajout sonner dans le stack, ajout pieges 8 (RLS recursive) et 9 (policies legacy non supprimees).

**A faire cote utilisateur** :
1. **`npm install`** non necessaire, sonner deja installe au sous-lot 4B.
2. Pas de migration a appliquer cote BDD : les migrations 004 et 005 ont deja ete appliquees via les tools Supabase. Les fichiers `.sql` sont livres dans `supabase/migrations/` pour la tracabilite git uniquement.
3. **`npm run dev`**, recharger la page.
4. **Tester en 2 navigateurs** :
   - A cree une partie (du Lobby) → A est redirige sur `/game/:id` (apres clic Voir).
   - B rejoint depuis le Lobby → B est redirige sur `/game/:id`. A voit B arriver dans son slot **sans refresh**.
   - A (hote) clique sur la croix du slot de B → B est kicke, son slot redevient libre. **B est redirige vers /lobby** (Realtime DELETE + check "tu n'es pas dans cette partie").
   - A (hote) clique "Dissoudre la partie" → confirm → la partie est supprimee. A et B (s'il etait connecte sur la page) sont rediriges vers /lobby avec toast "L'hote a dissous la partie".
   - B (non-hote) clique "Quitter la bataille" → leave + redirect vers /lobby.
5. `npm run tsc` doit passer 0 erreur.

**Sous-taches Phase 0 validees** :
- 0.5 (Lobby) : ✅
- 0.11 (Realtime sync lobby) : ✅

**Prochain Lot** :
- Lot 5 : hex foundation pure (sous-taches 0.6 + 0.7) — code engine, testable Vitest, zero React.
  Audit + plan detaille livres au prochain message.

---

## Session 6 &mdash; 08/05/2026 &mdash; Phase 0 Lot 4 sous-lot 4B : hooks + page Lobby React

**Fait** :
- `package.json` v0.0.3 : ajout `sonner@^1.7.1`.
- `index.html` : ajout link Google Fonts pour `Cormorant Garamond` (italique 400-600).
- `src/hooks/useRealtime.ts` v1.0 : hook generique Supabase Realtime (postgres_changes + presence).
- `src/hooks/useGames.ts` v1.0 : CRUD parties pour le Lobby.
- `src/ui/layout/PageBackground.tsx` v1.0 : composant fond global (Austerlitz + overlay).
- `src/ui/lobby/GameCard.tsx` v1.0 : carte d'une partie dans la liste.
- `src/ui/lobby/CreateGameDialog.tsx` v1.0 : modale "Ordre de bataille".
- `src/ui/pages/Lobby.tsx` v1.0 : page principale `/lobby`.
- `src/App.tsx` v1.0b : routes `/lobby` + redirection `/` → `/lobby`. Toaster sonner monte au top.

---

## Session 5 &mdash; 08/05/2026 &mdash; Phase 0 Lot 4 sous-lot 4A : migration BDD + types + maquettes

**Fait** :
- Migration `003_lobby_columns.sql` ecrite (idempotente).
- `src/types/game.ts` cree.
- 2 maquettes HTML statiques validees par utilisateur (BG Austerlitz, typo serif Cormorant, accent ambre, modale "Ordre de bataille" avec coin coupe).

---

## Session 4 &mdash; 08/05/2026 &mdash; Lot 2 carrousel images reelles

**Fait** :
- 3 images uploadees dans `public/scenes/` : `bouvines.png`, `austerlitz.png`, `verdun.png`.
- `AuthBackground.tsx` v1.0b : bascule des SVG composants vers `<img>`.
- Citations adaptees aux epoques.

---

## Session 3 &mdash; 08/05/2026 &mdash; Lot 2 addendum carrousel

**Fait** :
- Refonte de `AuthBackground.tsx` en carrousel automatique : 4 slides, Ken Burns.
- Citations defilent en sync avec les images.

---

## Session 2 &mdash; 08/05/2026 &mdash; Phase 0 Lot 2

**Fait** :
- Migration BDD `001_foundations` appliquee : tables `profiles`, `games`, `game_players` avec RLS active.
- Trigger `handle_new_user`. Migration `002_secure_handle_new_user`.
- Composants atomes : `Label`, `Input`, `Button`, `PasswordInput`, `Typewriter`.
- `Auth.tsx` : page split-screen 4 modes.
- Hooks : `useAuth`, `useRequireAuth`.

---

## Session 1 &mdash; 08/05/2026 &mdash; Phase 0 Lot 1

**Fait** :
- Initialisation Vite + React 18 + TypeScript strict.
- Configuration Tailwind, Radix, alias d'imports.
- Validation Zod des env vars.
- Client Supabase singleton.
