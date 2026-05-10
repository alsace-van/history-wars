# WIP.md

---

## Session 13 &mdash; 10/05/2026 &mdash; Phase 1.5 polish : wounded + visuels asymétriques + toasts combat

**Objectif** : combler 2 trous UX signalés post-Phase 1 (pas de retour visuel des combats sans cliquer ; pas de notion de blessés distinguable de tués). Préparation Phase 3 unité Infirmier.

**Audit + plan livrés** : `PLAN-PHASE-1-5-AUDIT.md` (PR #9). 9 TASKs sur 5 vagues, 4 PRs.

**Fait** :
- **Migration 011** appliquée sur Supabase prod (`abhbkdyoknrsdavimbpr`) via MCP : `units.wounded integer NOT NULL DEFAULT 0 check (>= 0)`. Advisors clean.
- **Engine** v1.1 : `UnitState.wounded`, `CombatResult.{killed, woundedAdd, actualDamage, defenderWoundedAfter}`, helper `splitCasualties()` ratio 60/40, `CombatPreview` enrichi avec bornes split.
- **EF `resolve_action` v1.2** : engine-port mirror, UPDATE `units.wounded` côté défenseur + côté attaquant si riposte mêlée, snapshot `AttackResult` enrichi.
- **`useTacticalSelection` v1.1** déjà fait en Phase 1 — pas re-touché.
- **Render asymétrique** :
  - `UnitInstance` enrichi (hp/hpMax/wounded optionnels) + `unitRowToInstance` map.
  - `UnitPlaceholder` v1.8 : scale soldat selon `(hp+wounded)/hpMax` lerp `[0.65, 1.0]`, hitbox + ring stables (baseScale).
  - `UnitHealthBar` (NEW, 73 lignes) : Billboard 3-segments vert/orange/sombre, **own only**.
  - Effectif chiffré sous le label kind aussi conditionné `viewerTeam` (fog of war confirmé).
- **`useCombatNotifications`** (NEW, 170 lignes) : Realtime listener INSERT `game_actions` filter `game_id`, parser asymétrique :
  - Attaquant moi → toast vert `"Charge : X ennemis abattus"` (kills uniquement)
  - Défenseur moi → toast rouge `"Cavalerie sous attaque — X morts, Y blessés, Z restants"` (full info)
  - Riposte mêlée : 2 toasts distincts selon perspective
  - Observateur tiers (4-joueurs en équipe Phase 4 future) → silencieux
- **`CombatPreviewTooltip` v1.2** : retire ligne `PV ennemi exact` (PR #12) puis ajoute split estimé `≈3–5 tués · ≈1–2 blessés` sous les dégâts.
- **`UnitInspector` v1.1** : barre HP devient 2-segments flex (vert hp + orange wounded) + ligne stats `X blessés · Y morts au combat`.

**PRs livrées** :
- #9 audit (mergée)
- #10 wounded data model + scale + barre PV (mergée)
- #11 fog count chiffré (mergée)
- #12 fog PV ennemi tooltip (mergée)
- #13 (à ouvrir) NOTIF + PREV + INSP + DOCS

**Pièges ajoutés** :
- **#50** Realtime payload `INSERT game_actions` arrive parfois avant le DELETE/UPDATE de `units` → lookup unit kind cote client peut être null. Solution : fallback générique "Unité ennemie".
- **#51** Le `result` JSONB d'`AttackResult` doit être typé en mirror entre client et EF. Toute évolution → 2 fichiers à update.

**Backlog enrichi** :
- Rebalance ratio split par UnitKind (artillerie 0.7 plus létal, mêlée 0.55-0.6).
- Unité Infirmier (Phase 3) : action `heal` qui transfère `wounded → hp`.
- Wounded reset partiel en fin de tour (récupération naturelle 5 % ?).
- Toast combat fusion : si 2 actions de combat dans le même seconde côté défenseur, fusionner en un seul toast.

**Phase 1.5 — état** : ✅ complète (sous réserve merge PR #13).

**Prochain Lot** : Phase 2 — IA solo (audit + plan à produire en début de Phase 2).

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
