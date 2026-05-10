# PLAN MASTER CHECKLIST — TACTICA

Mise à jour : 10/05/2026 (session 14 — corrections fin Phase 1.5).
Phase 0 ✅ — Phase 1 ✅ 13/13 — Phase 1.5 ✅ polish wounded + visuels + toasts + corrections dette.

---

## Vue d'ensemble — toutes les phases

| # | Phase | Résumé features | État |
|---|---|---|---|
| 0 | **Foundations** | Vite/TS strict, Tailwind, Auth Supabase, Lobby CRUD, hex flat-top cubique, `SCALE_CONFIG` 3 échelles, R3F + drei, caméra orbitale contrainte, placeholders unités, Realtime sync, PWA installable, skill `tactica`. | ✅ 13/13 |
| 1 | **Combat MVP tactique** | Engine pur (units/movement/zoc/los/combat/morale + Mulberry32). Migrations 007-010. 3 EF Deno. UI selection + reachable + targetable + dangerous (ZoC), preview combat tooltip, lerp + path step animation, GameHUD bandeau bas, EndGameModal stats, idempotence, snapshot result. | ✅ 13/13 |
| 1.5 | **Polish post-combat** | Modèle wounded (split killed/wounded 60/40), visuels asymétriques (UnitHealthBar own-only + scale par effectiveRatio), toasts combat asymétriques via Realtime INSERT game_actions, CombatResultPanel persistant en onglets + highlight unités + bouton Centrer caméra + fog of war highlight (LoS observateurs). Migration 011. Refactor `useGameRealtime` câblé + extraction GameTopBar. | ✅ |
| 2 | **IA solo** | IA tactique heuristique (`scoreAction = damage_max − risk_max`), profils difficulté (easy/normal/hard), simulation Web Worker, bots ajoutables au lobby (`game_players.is_bot`). | ⬜ |
| 3 | **Profondeur tactique** | Terrain typé, formations, fatigue, ravitaillement, aura général, propagation panique, **unité Infirmier** (`heal` transfère wounded → hp). | ⬜ |
| 4 | **Rôles asymétriques** | Rôles commandant/scout/artilleur, ordres limités par rôle, brouillard de guerre (RLS units vue filtrée), points d'ordre. | ⬜ |
| 5 | **Relief 3D** | Heightmap par scenario, normales calculées, post-processing, eau et végétation low-poly, cycle jour/nuit. | ⬜ |
| 6 | **Polish esthétique** | Animations unités, particules combat, bannières flottantes, sons, ambiance période, **animation messager** (cavalier traverse l'écran avec rouleau de pertes). | ⬜ |
| 7 | **Tablette** | Touch events, layout responsive, gestures, orientation lock paysage, safe area iPad. | ⬜ |
| 8 | **Niveau opérationnel** | Hex × 50, journées, logistique, corps d'armée, `ScalingTransition` tactique↔opérationnel. | ⬜ |
| 9 | **Niveau stratégique** | Hex × 500, semaines/tour, économie nationale, diplomatie, événements historiques. | ⬜ |
| 10 | **Asynchrone** | Tour différé 24-48h, notifications push PWA, Background Sync API, ELO async. | ⬜ |
| 11 | **Tournois / replays** | Bracket, ladder ELO sync, replays sérialisés depuis `game_actions`, partage URL `/replay/{id}`. | ⬜ |
| 12 | **Mode siège** | Cartes urbaines, fortifications, brèches dynamiques, machines de siège. | ⬜ |
| 13 | **Open source** | Licence, docs publiques, modabilité via JSONB, modding pack. | ⬜ |

Légende : ✅ validée et finalisée · 🟡 en cours · ⬜ pas commencée.

---

## Phase 0 — Détail (✅ complète 13/13)

| # | Sous-tâche | Lot | État |
|---|---|---|---|
| 0.1 | Init Vite + React + TS strict | 1 | ✅ |
| 0.2 | Tailwind + Radix + alias | 1 | ✅ |
| 0.3 | Supabase schéma + RLS | 2 | ✅ |
| 0.4 | Auth complète | 2-3 | ✅ |
| 0.5 | Lobby CRUD | 4 | ✅ |
| 0.6 | Hex cubique paramétré | 5 | ✅ |
| 0.7 | `SCALE_CONFIG` | 5 | ✅ |
| 0.8 | Grille hex R3F | 6 | ✅ |
| 0.9 | Caméra contrainte | 6 | ✅ |
| 0.10 | Placeholders unités | 6 | ✅ |
| 0.11 | Realtime sync lobby | 4 | ✅ |
| 0.12 | PWA manifest + SW | 7 | ✅ |
| 0.13 | Skill `tactica` Claude | 7 | ✅ |

---

## Phase 1 — Détail (✅ 13/13)

| # | Sous-tâche | Sous-lot | État |
|---|---|---|---|
| 1.1 | Tables `units`, `game_actions`, `state JSONB` (RLS active, advisors clean) | 1B.1 | ✅ |
| 1.2 | Sélection click + UnitInspector + 4 states tile (idle/reachable/targetable/dangerous) | 1C | ✅ |
| 1.3 | Range BFS hex coût-borné | 1A | ✅ |
| 1.4 | A* hex (heuristique cubeDistance) | 1A | ✅ |
| 1.5 | EF `resolve_action` cas `move` | 1B.3 | ✅ |
| 1.6 | Zones de contrôle (entrée OK, sortie +∞) | 1A | ✅ |
| 1.7 | Combat distance — engine + EF | 1A + 1B.4 | ✅ |
| 1.8 | Combat mêlée + riposte — engine + EF | 1A + 1B.4 | ✅ |
| 1.9 | Système moral MVP | 1A | ✅ |
| 1.10 | Ligne de vue (cubeLineDraw + bloqueurs) | 1A | ✅ |
| 1.11 | UI ordres (GameHUD bandeau bas, BattleSidebar, CombatPreviewTooltip, EndGameModal) | 1C | ✅ |
| 1.12 | EF `resolve_turn(scale)` | 1B.4 | ✅ |
| 1.13 | Tests Vitest engine ≥ 80 verts | 1A | ✅ (110/110) |

**Sous-lots de livraison Phase 1** :
- **1A — Engine pur** ✅ : `engine/units/`, `movement/`, `zoc/`, `los/`, `combat/`, `morale/` + 110 tests Vitest.
- **1B — BDD + Edge Functions** ✅ : Migrations 007 (units + game_actions + state JSONB), 008 (fix search_path), 009 (RLS DELETE host any status), 010 (REPLICA IDENTITY FULL pour Realtime DELETE filter). EF `start_battle`, `resolve_action` (move + attack_ranged + attack_melee), `resolve_turn(scale)`.
- **1C — UI tactique** ✅ : `useTacticalSelection` (selection + reachable + targetable + dangerousZocKeys + tileStates), `BattleSidebar`, `GameHUD`, `EndGameModal`, `CombatPreviewTooltip`, `UnitInspector`, animation path step, glow naturel sélection.

---

## Phase 1.5 — Détail (✅ polish post-combat)

| # | Sous-tâche | Vague | État | PR |
|---|---|---|---|---|
| 1.5.1 | Migration 011 `units.wounded int not null default 0` (RLS active, advisors clean) | 1 | ✅ | #10 |
| 1.5.2 | Engine wounded : `UnitState.wounded`, `CombatResult.{killed, woundedAdd, defenderWoundedAfter}`, `splitCasualties()` ratio 60/40 | 1 | ✅ | #10 |
| 1.5.3 | EF `resolve_action` v1.2 mirror engine + UPDATE `units.wounded` (défenseur + riposte attaquant) | 2 | ✅ | #10, #14 |
| 1.5.4 | `unitAdapter` étendu (hp/hpMax/wounded mappés sur UnitInstance) | 2 | ✅ | #10 |
| 1.5.5 | `UnitPlaceholder` v1.8+ : scale lerp `[0.65, 1.0]` selon `(hp+wounded)/hpMax`, hitbox + ring stables (baseScale) | 3 | ✅ | #10 |
| 1.5.6 | `UnitHealthBar` (NEW) Billboard 3-segments vert/orange/sombre, **own only** (fog of war effectif) | 3 | ✅ | #10 |
| 1.5.7 | Effectif chiffré sous label kind conditionné `viewerTeam` (fog of war count) | 3 | ✅ | #11 |
| 1.5.8 | Retrait PV ennemi exact du `CombatPreviewTooltip` (fog of war preview) | 3 | ✅ | #12 |
| 1.5.9 | `useCombatNotifications` (NEW) Realtime listener INSERT `game_actions`, parser asymétrique attaquant / défenseur / observateur | 4 | ✅ | #13 |
| 1.5.10 | `CombatPreviewTooltip` v1.2 affiche split estimé `≈X tués · ≈Y blessés` | 4 | ✅ | #13 |
| 1.5.11 | `UnitInspector` v1.1 barre HP 2-segments flex (vert hp + orange wounded) + ligne `X blessés · Y morts au combat` | 4 | ✅ | #13 |
| 1.5.12 | `MIN_DAMAGE = 1` (pas de combat à 0 dégâts) + `CombatResultPanel` persistant (X close) | bonus | ✅ | #15 |
| 1.5.13 | `CombatResultPanel` v2.0 onglets cliquables + auto-select dernier rapport + highlight `highlightedUnitIds` plateau | bonus | ✅ | #16 |
| 1.5.14 | Bouton "Centrer la vue" dans `CombatResultPanel` → `cameraFocusCube` lerp camera | bonus | ✅ | #16 |
| 1.5.15 | Fog of war highlight rapport combat : ennemi illuminé seulement si LoS via au moins une de mes unités non-routed (`visibleEnemyIds` dans `useTacticalSelection` v1.2) | bonus | ✅ | #17 |
| 1.5.16 | Refactor : câbler `useGameRealtime` (orphelin depuis L1C.1) + extraire `GameTopBar` (Game.tsx 618 → 588 lignes) | clôture | ✅ | #17 |

**Critères fin de Phase 1.5** : tous cochés.
- [x] Migration 011 appliquée prod, RLS clean (advisors)
- [x] `npm run tsc` 0 erreur
- [x] `npm run test` 110/110 verts
- [x] Mes unités ont `UnitHealthBar` 3-segments visible (own only)
- [x] Toutes unités scalent `(hp+wounded)/hpMax` lerp `[0.65, 1.0]`
- [x] Toast asymétrique reçu Realtime côté défenseur ET attaquant
- [x] `CombatPreviewTooltip` affiche split tués/blessés sans PV exact ennemi
- [x] `UnitInspector` affiche segment wounded orange
- [x] Rapports combat empilables en onglets, X par onglet, auto-select dernier
- [x] Bouton Centrer recentre la caméra sur l'unité du rapport actif
- [x] Highlight ennemi filtré par fog of war (LoS via observateurs)
- [x] `useGameRealtime` câblé (0 dépendant → 1 dépendant)
- [x] Game.tsx < 600 lignes (588)
- [x] WIP, BACKLOG, dependency-map à jour

---

## Phases 2-13 — Plans détaillés à produire en début de chaque phase

Convention : à chaque démarrage de phase N, on produit en bloc :
1. `AUDIT-PHASE-N.md` (lecture réelle du code livré, synergies + pièges anticipés).
2. `PLAN-PHASE-N.md` (sous-lots, sous-tâches atomiques, livrables, ordre).
3. Mise à jour de **ce fichier**.

### Phase 2 — préparation (notes pour mémoire)

- **Migration** : `game_players.is_bot bool default false` + `game_players.ai_profile text check in (easy, normal, hard)`.
- **Engine pur** : nouveau module `src/engine/ai/` avec `scoreAction(action, state, profile)`, `chooseBestAction(state, team, profile)`. Heuristique simple : `score = damage_max − weight_risk × risk_max`. Profils = pondérations + lookahead (easy 1 ply, normal 2 ply, hard 3 ply).
- **Web Worker** : `src/workers/aiWorker.ts` exécute la simulation hors main thread. Communication via `postMessage`.
- **Edge Function** : `run_bot_turn(game_id, player_id)` côté serveur OU `useBotRunner` hook côté client qui détecte `is_my_turn=true && current_player.is_bot=true` (host runner pattern, voir piège anticipé).
- **Lobby UI** : bouton "Ajouter un bot" dans slot vide + dropdown profil. Slots `is_bot=true` affichent un avatar IA + libellé profil.
- **Tests engine** : ≥ 10 tests heuristique (scoreAction sur scénarios canoniques, chooseBestAction déterministe sur seed donnée).
- **Pièges anticipés** : (a) qui exécute le bot (host runner vs EF) → décider en début de phase ; (b) Web Worker doit bundler le module engine sans cycles ; (c) bot ne doit pas voir hp ennemis exacts si fog of war reste activé pour cohérence.

---

## Lots livrés (cumulatif)

- **Lot 1** ✅ Init Vite + TS strict + Tailwind + Supabase singleton
- **Lot 2-3** ✅ Auth complète + carrousel Ken Burns
- **Lot 4** ✅ Lobby CRUD + Realtime + page Game slots
- **Lot 5** ✅ engine/hex + engine/scales (57 tests)
- **Lot 6** ✅ render/* intégré dans Game.tsx layout 3 zones
- **Lot 7** ✅ PWA + skill `tactica` + closure Phase 0 (63 tests verts)
- **Lot 8** ✅ Phase 1 sous-lot 1A — Engine combat pur (107 tests verts)
- **Lot 9** ✅ Phase 1 sous-lot 1B — BDD + Edge Functions
  - L1B.1 ✅ Migration 007 + 008
  - L1B.2 ✅ EF `start_battle` + shared
  - L1B.3 ✅ EF `resolve_action` cas move + engine-port étendu
  - L1B.4 ✅ EF `resolve_action` ranged/melee + `resolve_turn`
- **Lot 10** ✅ Phase 1 sous-lot 1C — UI tactique
  - L1C.1 ✅ Hooks foundation (`useBattleUnits`, `useCombatActions`, `useGameRealtime`, `lib/uuid`, `unitAdapter`)
  - L1C.2 ✅ Bouton Engager + switch `lobby`/`in_progress` + units BDD + state JSONB
  - L1C.3 ✅ Sélection + reachable + click move + UnitInspector + soldier glb + animation path step + ring sélection (glow additif + breathing pulse)
  - L1C.4 ✅ Combat targetable + dangerous (ZoC) + click attaque + CombatPreviewTooltip
  - L1C.5 ✅ GameHUD bandeau bas (Engager/Fin de tour/Quitter) + EndGameModal stats
- **Lot 11** ✅ Phase 1.5 — Polish post-combat (5 vagues, PR #9-#17)
  - V1 ✅ Migration 011 wounded + engine split (PR #10)
  - V2 ✅ EF wounded mirror + adapter (PR #10)
  - V3 ✅ Render asymétrique (scale + UnitHealthBar) + fog of war count + tooltip (PR #10, #11, #12)
  - V4 ✅ Notifications Realtime + preview split + UnitInspector wounded (PR #13)
  - V5 ✅ Bonus UX : MIN_DAMAGE 1, CombatResultPanel persistant + onglets + highlight + bouton Centrer + fog of war LoS (PR #15, #16, #17)
  - V6 ✅ Clôture session 14 : refactor useGameRealtime câblé + GameTopBar (PR #17)
- **Lot 12** ⬜ Phase 2 — IA solo (audit + plan à produire en début de Phase 2)

---

## Critères de fin de Phase 1 (rappel)

- [x] Migration 007-010 appliquées, RLS active sur `units` + `game_actions`, advisors clean
- [x] Bouton "Engager la bataille" fonctionnel : transition lobby → in_progress + spawn unités (GameHUD)
- [x] Sélection click + UnitInspector ; drag&drop reporté Phase 6 polish (cf BACKLOG)
- [x] Highlights `reachable` (cyan) + `targetable` (rouge) + `dangerous` (orange ZoC)
- [x] Preview combat affichée en hover ennemi targetable (CombatPreviewTooltip)
- [x] Animation move case par case (path step 1 s/case)
- [x] Mouvement résolu côté serveur uniquement (EF `resolve_action` cas move)
- [x] Combat distance + mêlée serveur, seed stockée
- [x] Idempotence `client_action_id` UUID + UNIQUE
- [x] Moral baisse aux pertes, déclenche `routed` sous seuil
- [x] LoS filtre les cibles tirables (alliés bloquent aussi)
- [x] `resolve_turn` incrémente `turn_number`, bascule `activeTeam`
- [x] GameHUD bandeau bas, BattleSidebar, EndGameModal sur `finished`
- [x] Realtime sync 2 navigateurs sans refetch parasite (`REPLICA IDENTITY FULL` migration 010)
- [x] ≥ 80 tests Vitest verts (110/110)
- [x] `npm run tsc` 0 erreur
- [ ] `npm run build` PWA OK (à valider en preview avant tag `phase-1-complete`)
- [x] `WIP.md`, `dependency-map.md`, `BACKLOG.md` à jour

---

## Cadre transverse — règles non négociables

1. Architecture 3 niveaux : zéro hardcode, tout via `SCALE_CONFIG` ou tables.
2. Frontière `engine/` ↔ `render/` ↔ `ui/` étanche (zéro Three/Supabase dans engine, zéro Supabase dans render).
3. Z = hauteur (Fusion 360), conversion Y↔Z encapsulée dans `render/`.
4. Hex flat-top cubique, voisins `0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE`.
5. TS strict, pas de `any` sans commentaire justifiant.
6. Fichiers max 600 lignes (vérifier en fin de phase, extraire en sous-composants si dépassement).
7. Hooks React : ajout en queue, jamais déplacer.
8. Header versioning 4 entrées max + TAG `console.log` matche.
9. RLS active sur toute nouvelle table + `Supabase:get_advisors` après chaque migration.
10. `service_role` jamais côté client. Combat 100 % serveur.
11. Try/catch + toast sonner sur tout async.
12. Maquette HTML d'abord pour modale/popup/HUD.
13. **Phase 1** : 1 seule EF `resolve_action` (dispatcher) + 1 seule `resolve_turn(scale)`.
14. **Phase 1** : seed combat stockée dans `game_actions.seed`.
15. **Phase 1** : sous-phases via `state.tactical.phase`, pas via `games.status`.
16. **Phase 1** : `state.version: 1` dans le JSONB, lectures avec defaults `?? value`.
17. **Phase 1** : `client_action_id` UUID + UNIQUE pour idempotence.
18. **Phase 1** : `game_actions.result` contient le snapshot post-action (préparation Phase 11 replays).
19. **Phase 1.5** : `hp + wounded ≤ hp_max` invariant géré côté EF (pas de check SQL pour ne pas bloquer race).
20. **Phase 1.5** : `AttackResult` JSONB doit être typé en mirror EF ↔ client (toute évolution = 2 fichiers à update).
21. **Fin de phase** : auditer tout hook créé sans dépendant (dette tech "0 importeur") ; câbler ou supprimer.

---

## Pièges connus (cumulatif)

1. Mélanger conventions hex (axial / offset / cubique).
2. Oublier RLS sur table.
3. Hardcoder valeurs de jeu.
4. Hardcoder `hexSize` dans `HexGrid`.
5. Confondre Y et Z dans Three.js.
6. Coupler composant render à une échelle.
7. Edge Function par échelle au lieu de `resolve_turn(scale)`.
8. RLS récursive → `SECURITY DEFINER` (Lot 4).
9. Policies legacy non droppées lors d'un fix RLS (Lot 4).
10. `registerType: 'prompt'` sans `<UpdatePrompt />` monté (Lot 7).
11. `virtual:pwa-register/react` introuvable en dev (Lot 7).
12. **(Confirmé L1B.2)** Edge Function Deno ne résout pas `@engine/*` → duplication contrôlée dans `_shared/engine-port/`. Étendu L1B.3 avec hex/movement/zoc.
13. **(Anticipé)** Realtime double UPDATE sur combat → appliquer payload localement, pas refetch.
14. **(Anticipé)** `OrbitControls` capture `mousedown` pendant drag figurine → `enableControls: false`.
15. **(Anticipé)** LoS bloquée aussi par alliés.
16. **(Anticipé)** Ranged distance 1 = LoS forcément OK.
17. **(Confirmé L1A.2 + L1B.3)** ZdC : entrée OK, sortie +∞ — porté côté Deno.
18. **(Confirmé L1B.3)** UNIQUE position `(game_id, q, r)` race lors d'UPDATE → catch `23505` et retour `INVALID_MOVE` "case occupée". Pour Phase 3+ swap : DEFERRABLE.
19. **(Confirmé L1B.3)** `boardRadius` validé serveur : `cubeDistance(dest, origin) > boardRadius` → `OUT_OF_BOARD`.
20. **(Anticipé)** Lerp position via `useFrame` direct sur `meshRef.current`, pas `setState`.
21. **(Confirmé L1B.3)** Idempotence `client_action_id` : SELECT cached avant validation + catch `23505` sur INSERT (race) → retour cached.
22. **(Confirmé L1C.3)** Realtime DELETE filter rate sans `REPLICA IDENTITY FULL` sur la table : payload OLD = juste l'id, le filter par non-PK ne match pas. Migration 010.
23. **(Confirmé L1C.3)** RLS DELETE silencieux : 0 rows = pas d'erreur SQL = client croit avoir réussi mais data zombie. Migration 009 retire la contrainte status.
24. **(Confirmé L1C.3)** glb tint via `material.color = tint` éteint la texture sombre. Solution : color blanc, tint via `emissive` 0.55-0.85.
25. **(Confirmé L1C.3)** Ring sélection `depthTest=false` rend devant TOUT. Solution : `depthWrite=false` + `renderOrder` + Y séparés.
26. **(Confirmé L1C.3)** State `'selected'` sur tile + ring au-dessus = z-fight (rayures radiales). Fix : ring autour seul.
27. **(Confirmé L1C.3)** Halo + net rings transparents au même Y = z-fight coplanaire. Fix : Y séparés 4 mm + `depthWrite=false` + `renderOrder`.
28. **(Confirmé L1C.4)** R3F `onPointerOver/Out` sur figurine ne donne pas l'event souris. Pour tooltip ancré souris : tracker via `onMouseMove` sur le conteneur scène.
29. **(Confirmé Phase 1.5)** Realtime payload INSERT `game_actions` peut arriver avant le DELETE/UPDATE `units` → lookup `kind` côté client null. Mitigation : fallback générique "Unité ennemie". Futur : enrichir `AttackResult` côté EF avec `attacker_kind` + `defender_kind`.
30. **(Confirmé Phase 1.5)** Le `result` JSONB d'`AttackResult` doit être typé en **mirror** entre client et EF. Toute évolution → modifier 2 fichiers ensemble (`src/engine/combat/types.ts` + `supabase/functions/_shared/engine-port/combat/types.ts`).
31. **(Confirmé Phase 1.5 PR #14)** `SELECT` côté EF ne lisait pas `wounded` → cast incomplet, `wounded` réécrit à 0 à chaque combat (perte d'info). Fix : SELECT explicite de toutes les colonnes nécessaires, ne jamais compter sur SELECT * implicite.
32. **(Confirmé Phase 1.5 session 14)** Hook créé en sous-lot puis jamais câblé devient dette tech invisible. Vérifier en fin de phase qu'aucun hook n'a 0 dépendant. `useGameRealtime` orphelin 4 sessions avant câblage. Audit en fin de phase = `grep -r "from '@hooks/useXxx'" src/`.
33. **(Confirmé Phase 1.5 session 14)** Game.tsx tend à grossir > 600 lignes (CLAUDE.md règle 4 violée à 618 lignes). Mitigation : extraire les blocs JSX self-contained du header/sidebar dans des sous-composants UI dès qu'on dépasse 550.

---

## Backlog idées (résumé — détail dans `docs/BACKLOG.md`)

### Phase 1.5 enrichi
- Animation messager (cavalier traverse l'écran avec rouleau de pertes) → Phase 6.
- Rebalance ratio split par `UnitKind` (artillerie 0.7, cavalerie 0.65, infanterie 0.55-0.6, siège 0.85) → Phase 3+.
- Récupération naturelle wounded fin de tour (5 % si pas combattu et hors ZdC ennemie).
- Fusion toasts combat rapprochés (2+ actions / sec sur même unité).

### Phase 1 reports / dette tech
- Compresser `soldier.glb` (~5 Mo → < 500 Ko via Draco/KTX2).
- Vrais uniformes par période historique.
- Vitesse km/h réaliste par UnitKind (`SECONDS_PER_HEX = metersPerHex / kmh`).
- Mouvement organique (Bézier ou ease-in-out global).
- Bouger `handleTileClick` dans `useTacticalSelection` (Game.tsx 588 → ~450 lignes).
- ~~`useGameRealtime` jamais câblé~~ → résolu session 14 (PR #17).
- Transfert d'hôte au lieu de dissolution (in_progress).
- Inspection unité ennemie au clic (sans attaquer).

### Phases futures
- Mode "Battle normale" vs "Historique" → post-Phase 1.
- Aura général + propagation panique → Phase 3.
- Replay URL partageable `/replay/{game_id}` → Phase 11.
- RLS units : vue SQL filtrée pour fog of war → Phase 4.
- HexTile materials adaptatifs au terrain (heightmap, biome) → Phase 5.
- ScalingTransition tactique ↔ opérationnel → Phase 8.

---

**État courant** : Phase 0 ✅ — Phase 1 ✅ 13/13 — **Phase 1.5 ✅ complète** (16 sous-tâches livrées, 110/110 tests, Game.tsx 588 lignes, useGameRealtime câblé, fog of war LoS) — prochaine étape **Phase 2 IA solo** (audit + plan détaillé à produire en début de session 15).

À faire côté utilisateur avant tag `phase-1-complete` :
1. Tester manuellement une partie complète 2 navigateurs (lobby → bataille → combat → fin tour → victoire).
2. `npm run build` PWA + Lighthouse score ≥ 90.
3. Merger PR #17 sur main.
4. Pousser le tag git `phase-1-complete`.
