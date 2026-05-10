# WIP.md

---

## Session 16 &mdash; 10/05/2026 &mdash; Phase 2 closure : polish 2.5 + 2 fix balance + déploiement prod complet

**Phase 2 + Phase 2.5 = COMPLÈTES côté code/prod.** Reste pour officiellement clore :
- Test humain 2 navigateurs (partie complète split/merge/charge/attrition).
- `npm run build` PWA + Lighthouse ≥ 90.
- Tag git `phase-2-complete` après validation.

### 2.5 — Polish (PR #24, mergée)
- `hooks/useSettings.ts` (NEW) v1.0 : préférence `animationSpeed` persistée `localStorage`.
- `render/effects/DamageFloater.tsx` (NEW) v1.0 : Billboard 3D `-N` tués (rouge) / `+N` blessés (orange), montée Y + shrink, auto-disparition.
- `hooks/useCombatAnimator.ts` (NEW) v1.0 : queue de floaters branchée sur `useCombatNotifications`, **skip Espace** global.
- `render/scenes/TacticalScene.tsx` v1.6 : props `damageFloaters` + `damageFloaterDurationMs` + `onDamageFloaterDone`.
- `ui/pages/Game.tsx` v3.16 : câblage useSettings + useCombatAnimator + transmission queue.

### 2.6 — Split UX (PR #22 puis #23)
- `ui/game/UnitInspector.tsx` v2.1 : remplace grille 6 boutons q/r par bouton CTA "Sélectionner la case →" + panneau pulsant.
- `render/types.ts` + `render/colors.ts` + `render/hex/HexTile.tsx` : nouveau state `'split-target'` (ambre vif).
- `hooks/useTacticalSelection.ts` v1.3 : param `splitMode`, calcul `splitTargetKeys` (6 voisins libres in-board).
- `hooks/useSplitMode` puis inlining dans Game.tsx (cycle hooks).
- `ui/game/Bracket.tsx` (extracted from Game.tsx pour rester sous 600 lignes).

### Fix balance #1 — plancher attrition (PR #25, déployé EF v6)
- Bug user 10/05/2026 : 800I vs 800I plaine → 1 dégât (égalité parfaite).
- `engine/combat/v2/types.ts` : `CombatConfig.baseAttritionRate?` + `DEFAULT_BASE_ATTRITION_RATE = 0.08`.
- `engine/combat/v2/contact.ts` v1.1 + `preview.ts` v1.1 : plancher `max(menEngaged × 0.08, power-resistance)`. À égalité 200 hommes engagés → 16 morts minimum.
- Mirror Deno + `UPDATE combat_config SET config = jsonb_set(...)` BDD.
- 2 tests régression `contact.test.ts`.

### Fix balance #2 — nerf cav (commit 89499fa, déployé EF v7)
- Bug user 10/05/2026 : 180 C vs 180 C plaine → one-shot (variance haute).
- `engine/units/stats.ts` v2.1 : `C attack=1.5/defense=0.7 → 1.1/0.9` (ratio 1.22 au lieu de 2.14).
- Power-resistance passe de ~150 à ~38 → ~30-45 morts/tour, 4-5 tours pour anéantir.
- Cavalerie reste dominante via charge (matchup 1.5 × multi 1.3-1.5).
- 1 test régression `contact.test.ts`.
- Mirror Deno + redéploiement EF.

### Déploiements prod EF
- `resolve_action` v4 (Phase 1.5) → v5 (handlers Phase 2) → v6 (plancher attrition) → **v7** (nerf cav).
- `start_battle` v1 → **v2** (seed effective + terrain_tiles).
- `resolve_turn` v1 → **v2** (reset last_move_path début tour).
- `combat_config` BDD updated : `baseAttritionRate: 0.08` explicit.

### Vérifs finales
- `npx tsc --noEmit` : 0 erreur.
- `npx vitest run` : **205/205** tests verts.
- `wc -l src/ui/pages/Game.tsx` : 599 < 600 (CLAUDE.md §4 respecté via extraction Bracket).

### Reste à faire (côté humain)
- Test humain 2 navigateurs : split/merge/charge cav/saturation terrain/attrition I vs I.
- `npm run build` + audit Lighthouse PWA ≥ 90.
- Tag git `phase-2-complete` après validation.

### Reportés explicitement Phase 3+
- Settings panel UI pour `animationSpeed` (pour l'instant : localStorage manuel + raccourci Espace).
- Projectile 3D ranged + courbe d'approche cav animée.
- Lock interactif pendant l'anim combat (overlay HTML 2s skippable).

---

## Session 15 &mdash; 10/05/2026 &mdash; Phase 2 refonte combat (sessions 1-7 + closure docs)

**Contexte** : audit + plan Phase 2 livres `AUDIT-PHASE-2-COMBAT-V2.md` + `PLAN-PHASE-2-COMBAT-V2.md` + `02-PLAN-MASTER-V2.md`.

Refonte combat MVP → modele riche : effectif elastique, 3 phases (melee/ranged/charge), saturation terrain, charge cavalerie, scission/fusion, breakdown UI lisible.

**Sous-lots livres** :

### 2A — Engine pur (Session 1+2)
- `engine/units/types.ts` v2.0 : UnitState etend `effective`, `effectiveMax`, `effectiveMin`, `killed`, `lastMovePath?`, `subKind?`, `regimentId?`, `formation?`.
- `engine/units/stats.ts` v2.0 : `UNIT_STATS_V2` (I=800, C=180, A=120) + `resolveUnitStatsV2(kind, subKind)` (override archer).
- `engine/units/sizing.ts` (NEW) : `splitUnit`, `mergeUnits`, `isSizingError`. 3 ratios preset.
- `engine/terrain/{types,caps,index}.ts` (NEW) : 6 types terrain MVP, `TERRAIN_CAPS` avec `contactCap` Thermopyles.
- `engine/combat/v2/{types,matchup,charge,distance,contact,preview,index}.ts` (NEW) :
  - 3 matrices matchup melee/ranged/charge.
  - `resolveContact()` pipeline puissance - resistance × variance ±15%, plancher 1 si attackPossible.
  - `resolveCombat()` dispatch + riposte melee uniquement.
  - `chargeMultiplier()` + `isChargeApplicable()` + `isPathStraight()` + `chargedDistance()`.
  - `distancePrecision()` sweet spot 50-70% range, tail-off 0.5 a max.
  - `previewCombatV2()` avec breakdown ligne par ligne (sans rng).

### 2A — Tests Vitest
- 22 tests sizing + 5 tests terrain + 8 tests stats v2 + 7 tests matchup + 14 tests charge + 8 tests distance + 16 tests contact + 8 tests preview + 8 tests integration = **+93 nouveaux** (203 total vs baseline 110).
- `npm run test` : 24 fichiers / 203 tests **verts**.

### 2A — Mise a jour fixtures legacy
- `combat/{melee,ranged,preview}.test.ts` + `morale/morale.test.ts` + `zoc/zoc.test.ts` : ajout `effective/effectiveMax/effectiveMin/killed` aux factories `makeUnit`.
- `unitAdapter.unitRowToState` : derive Phase 2 depuis hp/hpMax+kind si BDD pas encore migree.

### 2B — Migrations BDD (Session 3)
- **Migration 012** `units_effective_elastique.sql` : ajoute `effective`, `effective_max`, `effective_min`, `killed`, `sub_kind`, `regiment_id`, `formation`, `last_move_path`. Backfill conservatif depuis hp/hp_max + UNIT_STATS_V2. Constraints + defaults.
- **Migration 013** `terrain_tiles.sql` : table `terrain_tiles {game_id, q, r, type}` + RLS SELECT membre + Realtime + REPLICA IDENTITY FULL.
- **Migration 014** `combat_config.sql` : table + seed initial JSONB qui mirror `DEFAULT_COMBAT_CONFIG` (stats, terrainCaps, matchupMatrix, diceVariance, chargeMultipliers, moraleThresholds).
- `start_battle` EF v2.0 : seed `effective/effective_max/effective_min/killed` + seed `terrain_tiles` (defaut plaine_standard sur tout le board, 91 hex pour radius=5). Rollback if terrain insert echoue.
- **Migrations appliquees en prod** (verifie 10/05/2026) : 012/013/014 presentes via `list_migrations`. `terrain_tiles` + `combat_config` tables OK (RLS active, 1 row seed combat_config). Backfill `units` 10/10 OK (0 NULL, effective range 48-800). `get_advisors` : 0 ERROR, warnings restants sont anterieurs Phase 2 (piege #8 + dette tech Phase 1).

### 2C — Engine-port miroir Deno (Session 4)
- `_shared/engine-port/units.ts` v2.0 : ajoute `UnitStatsV2`, `UnitSubKind`, `UNIT_STATS_V2`, `resolveUnitStatsV2`, sizing `splitUnit/mergeUnits/isSizingError`.
- `_shared/engine-port/terrain/{types,caps,index}.ts` (NEW).
- `_shared/engine-port/combat/v2/{types,matchup,charge,distance,contact,preview,index}.ts` (NEW). Mirror exact du client.

### 2C — Refacto resolve_action en handlers (Session 5)
- `resolve_action/index.ts` v2.0 : pure dispatcher (~165 lignes vs 609 avant).
- `_handlers/_common.ts` : `UnitRow` Phase 2, `buildUnitState`, `loadTerrainMap`, `loadCombatConfig`, `terrainAt`, `UNIT_SELECT_COLUMNS`.
- `_handlers/handleMove.ts` v1.0 : extrait + tracking `last_move_path` (interpolation cubique du path start→dest pour detection charge).
- `_handlers/handleAttack.ts` v1.0 : refonte v2 avec `resolveCombat`, terrain map, combat_config, snapshot `AttackResultV2` enrichi.
- `_handlers/handleSplit.ts` v1.0 (NEW) : validation adjacence + libre + effectif, UPDATE source + INSERT new unit, rollback sur race UNIQUE.
- `_handlers/handleMerge.ts` v1.0 (NEW) : validation same kind/team/adjacent + cap effectif, UPDATE target + DELETE source.
- `resolve_turn` v1.1 : reset `last_move_path = null` en debut de tour pour toTeam.
- `_shared/types.ts` v2.0 : `ActionType` etendu `split_unit`/`merge_unit`, `AttackPhase`, `BonusBreakdownEntry`, `CombatResultSnapshotV2`, `AttackResultV2`, `SplitPayload/Result`, `MergePayload/Result`, codes erreur Phase 2.

### 2D — UI (Session 6)
- `useCombatActions` v2.0 : `SplitAction` + `MergeAction` types, codes erreur humanises Phase 2.
- `useUnitSizing` (NEW) : hook `canSplit`, `canMerge`, `splitTargets`, `mergeTargets`, `performSplit/Merge` (POST EF).
- `UnitInspector` v2.0 : affiche effective + section "Manoeuvre" avec boutons Scinder/Fusionner + sub-modale inline (3 ratio + cases adjacentes).
- `BattleSidebar` v1.1 : effectifs cumules par camp en haut + propage `gameId/allUnits` a Inspector.
- `CombatPreviewTooltip` v2.0 : breakdown ligne par ligne (ATK base, matchup, charge, terrain, moral, variance), hommes engages, cap terrain.
- `CombatResultPanel` v3.0 : icone 🐎 + label "Charge cav" pour kind='charge'. `useCombatNotifications` v2.0 supporte 'charge' + champs effective optionnels.
- `Game.tsx` : passe `gameId={game.id}` + `allUnits={unitStates}` a BattleSidebar.

### 2E — Render (Session 7)
- `UnitPlaceholder` v2.0 : scale soldat selon `effective/effectiveMax` (plage 0.35-1.0 amplifiee). Fallback hp/hpMax legacy.
- `UnitHealthBar` v2.0 : props `effective/effectiveMax/wounded` (au lieu de hp/hpMax/wounded). Toujours own-only.
- `UnitInstance` (`render/types.ts`) v2.0 : ajoute `effective?`, `effectiveMax?`. `unitRowToInstance` propage.

### 2F — Closure docs (Session 8)
- `docs/COMBAT-V2.md` (NEW, ~250 lignes) : reference complete des regles Phase 2 (stats, terrain caps, matrices matchup, pipeline calcul, charge, distance, sizing, riposte, config runtime, snapshot AttackResultV2).
- `docs/WIP.md` : cette session en tete.

### Verifications finales
- `npx tsc --noEmit` : 0 erreur.
- `npm run test` : 24 fichiers / 203 tests verts.
- Aucun fichier > 600 lignes (resolve_action/index 165, handlers 100-220 chacun).

### Reportes (Session 2.5 polish ulterieur)
- `CombatAnimator` (anim 2s skippable, projectile, courbe charge, deroute).
- `DamageFloater` (chiffre rouge flottant).
- `SettingsContext.animationSpeed` persistant + raccourci `Espace` skip.
- ~~Application des migrations 012/013/014 en prod~~ — DEJA FAIT (verif 10/05/2026).
- ~~`Supabase:get_advisors` apres migrations~~ — DEJA FAIT (0 ERROR, warnings preexistants Phase 1).
- Test humain 2 navigateurs avec une partie complete.
- `npm run build` PWA + Lighthouse >= 90.
- Tag git `phase-2-complete` apres validation humaine.

**Fichiers touches (resume)** :
- Engine : 13 fichiers nouveaux (engine/units/sizing.ts, engine/terrain/*, engine/combat/v2/*, tests)
- BDD : 3 migrations 012-014
- EF Deno : 5 nouveaux handlers (_handlers/_common, handleMove, handleAttack, handleSplit, handleMerge), engine-port miroir Phase 2 complet
- UI/hooks : useUnitSizing (NEW), useCombatActions/useCombatNotifications/UnitInspector/BattleSidebar/CombatPreviewTooltip/CombatResultPanel mis a jour
- Render : UnitPlaceholder/UnitHealthBar/types/unitAdapter mis a jour
- Docs : COMBAT-V2.md (NEW), WIP.md

---

## Session 14 &mdash; 10/05/2026 &mdash; Audit fin de Phase 1.5 + corrections de dette

**Contexte** : audit rigoureux post-Phase 1.5 demandé (3 écarts identifiés vs CLAUDE.md/plan master).

**Écarts détectés** :
1. `src/ui/pages/Game.tsx` à **618 lignes** (> 600 max). Violation règle architecture CLAUDE.md.
2. `src/hooks/useGameRealtime.ts` créé en L1C.1 (session 5) **jamais câblé** — 0 dépendant. Dette tech.
3. Suspicion de divergence count tests (grep ≠ vitest). **Faux positif** : vitest reporte 110 ✓.

**Corrections livrées** :
- **Game.tsx v3.14** : remplace le `useRealtime` inline (19 lignes, lignes 63-81) par `useGameRealtime({ gameId, onGameUpdate, onGameDelete, onPlayersChange })` (8 lignes). Channel `game-meta:${gameId}` désormais utilisé.
- **GameTopBar.tsx (NEW, 39 lignes)** : extraction du header global de Game.tsx (logo TACTICA + bouton Salle de commandement + Officier). Game.tsx perd 27 lignes JSX, gagne 5 lignes (import + appel).
- **Game.tsx total : 618 → 588 lignes** (sous le seuil 600).
- **`useGameRealtime` câblé** : la dette tech `BACKLOG.md → useGameRealtime` est résolue.

**Vérifs** :
- `npx tsc --noEmit` : 0 erreur.
- `npx vitest run` : **110/110 tests verts** (1.10 s).
- `wc -l src/ui/pages/Game.tsx` : 588.

**Fichiers touchés** :
- `src/ui/pages/Game.tsx` v3.14
- `src/ui/game/GameTopBar.tsx` v1.0 (NEW)
- `docs/WIP.md`, `docs/BACKLOG.md`, `docs/dependency-map.md` (MAJ)

**Prochain Lot** : Phase 2 — IA solo (audit + plan à produire en début de session).

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
