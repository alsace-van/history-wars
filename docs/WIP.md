# WIP.md

---

## Session 12 &mdash; 10/05/2026 &mdash; Phase 1 fin : clôture L1C (combat MVP tactique complet)

**Contexte** : reprise après session 5 (WIP-PHASE-1-SESSION-5.md), bug ring sélection ouvert, L1C.4 + L1C.5 à démarrer.

**Fait** :
- **Fix ring sélection** (PR #1, #2, #3) :
  - Option A retenue : retire le state `'selected'` du `tileStates` (l'anneau autour du soldat suffit, cf piège #47).
  - `RING_LIFT` 0.06 → 0.1, halo et net séparés en Y (anti z-fight coplanaire).
  - Glow naturel : 3 halos `AdditiveBlending` + breathing pulse (`useFrame` + `clock.elapsedTime`), segments 48 → 64.
- **P1-REFACTOR-01** (PR #4) : extraction `BattleSidebar` depuis Game.tsx → `src/ui/game/BattleSidebar.tsx` (92 lignes). Game.tsx 569 → 525.
- **P1-L1C4-04** (PR #5) : 4e state `HexTileState = 'dangerous'` (orange `0x5a3514` / `0xfb923c`) pour les hex en ZoC ennemie reachable.
- **P1-REFACTOR-02 + P1-L1C4-02 + L1C5-01/02/03 + L1C4-01/03** (PR #7, bundle) :
  - `useTacticalSelection` (168 lignes) : extrait selection + reachable + `targetableUnitIds` (`cubeDistance` ≤ range + `hasLineOfSight` si range > 1) + `dangerousZocKeys` (`computeEnemyZoc` mémoïsé partagé) + `tileStates` (cyan reachable, orange si en ZoC).
  - `GameHUD` (102 lignes) : bandeau bas overlay, boutons Engager / Fin de tour / Quitter selon contexte.
  - `EndGameModal` (160 lignes) : Radix Dialog auto sur `status='finished'`, vainqueur + tours + stats agrégées (moves, mêlée, tirs, fins de tour) depuis `game_actions`.
  - `CombatPreviewTooltip` (110 lignes) : HTML overlay anchor souris, `previewMelee/previewRanged` (dégâts min-max + issue Tue à coup sûr / Tue possible / Affaiblit).
  - Game.tsx v3.7 (560 lignes < 600) : intégration HUD + modal + tooltip, `handleEndTurn`, `handleUnitClick` composite (click ennemi targetable → `submitAction attack_*`), retire boutons inline.

**Pièges ajoutés** :
- **#47** state `'selected'` sur la tile + ring au-dessus = z-fight visible (rayures radiales). Fix : ring autour du soldat seul.
- **#48** halo + net rings transparents au même Y = z-fight coplanaire (rayures radiales). Fix : `depthWrite=false` + `renderOrder` + Y séparés (4 mm).
- **#49** R3F `onPointerOver/Out` sur figurine ne donne pas l'event → tracker souris via `onMouseMove` sur le conteneur scène pour positionner le tooltip.

**Tests** : 107/107 verts. `tsc 0`. PWA build à valider en preview.

**Phase 1 — état** : ✅ **13/13 complète**.

**À faire côté utilisateur** :
1. Tester manuellement la partie complète (lobby → bataille → combat → fin de tour → victoire).
2. Pousser le tag git `phase-1-complete`.
3. Lancer Lighthouse PWA en preview pour valider le score ≥ 90.

**Prochain Lot** : Phase 2 — IA solo (audit + plan master à lancer en nouvelle session).

---

## Session 11 &mdash; 09/05/2026 &mdash; Phase 0 Lot 7 : PWA + Skill `tactica`

**Fait** :
- `package.json` v0.0.4 : ajout `vite-plugin-pwa@^0.20.5` + `workbox-window@^7.1.0`.
- `vite.config.ts` v1.0d : config VitePWA complète (manifest TACTICA + workbox runtimeCaching Google Fonts SWR/CacheFirst + Supabase NetworkOnly + denylist navigateFallback). `devOptions.enabled: true, type: 'module'` pour exposer `virtual:pwa-register/react` en dev (sinon erreur d'import).
- `src/vite-env.d.ts` : ajout `/// <reference types="vite-plugin-pwa/react" />` + `vite-plugin-pwa/client`.
- `index.html` v1.0a : favicon SVG `T` ambre `#EF9F27`, `apple-touch-icon`, metas `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `mobile-web-app-capable`, `viewport-fit=cover`.
- `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` : générés via PIL, `T` ambre `#EF9F27` sur fond `#0f172a`, padding 18 % maskable.
- `src/hooks/useOnlineStatus.ts` v1.0 : hook `online`/`offline` window events.
- `src/ui/components/UpdatePrompt.tsx` v1.0 : `useRegisterSW` + toast sonner "Recharger" `duration: Infinity` + check périodique 1h + check sur `visibilitychange`.
- `src/App.tsx` v1.0f : mount `<UpdatePrompt />` après `<Toaster />`.
- `src/ui/pages/Game.tsx` v2.0a : badge online/offline en bas de la sidebar (pastille verte / rouge clignotante), `useOnlineStatus` ajouté EN QUEUE des hooks (avant les helpers `iAmHost`/`iAmIn`).
- Skill `/mnt/skills/user/tactica/SKILL.md` créé (13 sections, 11 pièges connus).

**Manifest PWA — décisions** :
- `orientation: 'any'` (Phase 0 — durcir Phase 7 tablette si besoin).
- `display_override: ['window-controls-overlay', 'standalone']`.
- `categories: ['games', 'strategy']`.
- `start_url: '/lobby'` (le `useRequireAuth` redirige vers `/auth` si non loggué).
- `theme_color` + `background_color` `#0f172a` (cohérence index.html).

**Pièges ajoutés** (CLAUDE.md + skill) :
- Piège 10 : `registerType: 'prompt'` sans `<UpdatePrompt />` monté → SW silencieux.
- Piège 11 : `virtual:pwa-register/react` introuvable en dev avec `devOptions.enabled: false` → activer en dev avec `type: 'module'`.

**Sous-tâches Phase 0 validées** :
- 0.12 (PWA manifest + SW) : ✅
- 0.13 (Skill `tactica`) : ✅

**Phase 0 — état** : ✅ **13/13 complète**.

**À faire côté utilisateur** :
1. Copier `skill-tactica/SKILL.md` dans `/mnt/skills/user/tactica/SKILL.md` (création du dossier si absent).
2. Pousser le tag git `phase-0-complete` sur le repo.
3. Lancer Lighthouse PWA en preview pour valider le score ≥ 90.

**Prochain Lot** :
- Phase 1 (Combat MVP tactique) — audit + plan master à lancer en nouvelle session.

---

## Session 10 &mdash; 09/05/2026 &mdash; Phase 0 Lot 6 sous-lot 6B : intégration TacticalScene dans Game.tsx

**Fait** :
- `src/ui/game/TeamPanel.tsx` v1.0 : extraction du composant `TeamPanel` (était inline dans Game.tsx). Ajout prop `compact` pour le mode sidebar (padding/font size réduits).
- `src/ui/pages/Game.tsx` v2.0 : refonte complète layout 3 zones :
  - Header (sticky top, inchangé).
  - Body flex horizontal avec `flex-1` pour la zone scène et `w-[340px]` sidebar droite.
  - Zone scène : game-header inline (titre + meta condensés) au-dessus + `<TacticalScene />` plein espace.
  - Sidebar : 2 panneaux équipes en compact + footer actions sticky.
  - Disque hex rayon 5 (91 hex) via `spiral({0,0,0}, 5)`, 6 unités factices via `buildMvpUnitPlacement()`.
- `src/App.tsx` v1.0e : route `/render-test` supprimée.
- Page `RenderTest.tsx` à supprimer manuellement côté repo.

**Sous-tâches Phase 0 validées** :
- 0.8 (Grille hex R3F) : ✅
- 0.9 (Caméra contrainte) : ✅
- 0.10 (Placeholders unités) : ✅

---

## Session 9 &mdash; 09/05/2026 &mdash; Phase 0 Lot 6 sous-lot 6A

- engine render : colors, types, scenes/SceneShell+Loader+TacticalScene, hex/HexGrid+HexTile, camera/CameraController, units/UnitPlaceholder, lighting, _data/mvpUnitPlacement.
- Page démo `/render-test`.
- 6 nouveaux tests (63 total).
- 3 hotfixes HexTile : retrait rotation incorrecte, edges custom (sans diagonales internes), Shape+ExtrudeGeometry pour aligner mesh sur cubeToWorld.

---

## Session 8 &mdash; 08/05/2026 &mdash; Lot 5 hex foundation + SCALE_CONFIG

57 tests verts.

---

## Session 7 &mdash; 08/05/2026 &mdash; Lot 4C page Game + RLS fix

Migrations 004 + 005 (SECURITY DEFINER + drop legacy policies).

---

## Session 6 &mdash; 08/05/2026 &mdash; Lot 4B hooks + Lobby React

sonner, useRealtime, useGames, Lobby.tsx, CreateGameDialog, GameCard.

---

## Session 5 &mdash; 08/05/2026 &mdash; Lot 4A migration BDD + types + maquettes

Migration 003, types/game.ts, 2 maquettes HTML.

---

## Session 4 &mdash; 08/05/2026 &mdash; Lot 2 carrousel images réelles

Bouvines, Austerlitz, Verdun.

---

## Session 3 &mdash; 08/05/2026 &mdash; Lot 2 addendum carrousel

AuthBackground.tsx Ken Burns 4 slides.

---

## Session 2 &mdash; 08/05/2026 &mdash; Lot 2

Migrations 001 + 002, composants atomes, Auth.tsx, hooks auth.
