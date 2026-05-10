# PLAN MASTER CHECKLIST — TACTICA

Mise à jour : 10/05/2026 (session 12, clôture Phase 1).
Phase 0 ✅ — Phase 1 ✅ 13/13 (toutes sous-tâches livrées et validées).

---

## Vue d'ensemble — toutes les phases

| # | Phase | Résumé features | État |
|---|---|---|---|
| 0 | **Foundations** | Vite/TS strict, Tailwind, Auth Supabase, Lobby CRUD, hex flat-top cubique, `SCALE_CONFIG` 3 échelles, R3F + drei, caméra orbitale contrainte, placeholders unités, Realtime sync, PWA installable, skill `tactica`. | ✅ 13/13 |
| 1 | **Combat MVP tactique** | Engine pur (units/movement/zoc/los/combat/morale + Mulberry32). Migrations 007-010. 3 EF Deno. UI selection + reachable + targetable + dangerous (ZoC), preview combat tooltip, lerp + path step animation, GameHUD bandeau bas, EndGameModal stats, idempotence, snapshot result. | ✅ 13/13 |
| 2 | **IA solo** | IA tactique heuristique, profils difficulté, simulation Web Worker, bots ajoutables au lobby. | ⬜ |
| 3 | **Profondeur tactique** | Terrain typé, formations, fatigue, ravitaillement, aura général, propagation panique. | ⬜ |
| 4 | **Rôles asymétriques** | Rôles commandant/scout/artilleur, ordres limités par rôle, brouillard de guerre, points d'ordre. | ⬜ |
| 5 | **Relief 3D** | Heightmap par scenario, normales calculées, post-processing, eau et végétation low-poly, cycle jour/nuit. | ⬜ |
| 6 | **Polish esthétique** | Animations unités, particules combat, bannières flottantes, sons, ambiance période. | ⬜ |
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
| 1.13 | Tests Vitest engine ≥ 80 verts | 1A | ✅ (107/107) |

**Sous-lots de livraison Phase 1** :
- **1A — Engine pur** ✅ : `engine/units/`, `movement/`, `zoc/`, `los/`, `combat/`, `morale/` + 107 tests Vitest.
- **1B — BDD + Edge Functions** ✅ : Migrations 007 (units + game_actions + state JSONB), 008 (fix search_path), 009 (RLS DELETE host any status), 010 (REPLICA IDENTITY FULL pour Realtime DELETE filter). EF `start_battle`, `resolve_action` (move + attack_ranged + attack_melee), `resolve_turn(scale)`.
- **1C — UI tactique** ✅ : `useTacticalSelection` (selection + reachable + targetable + dangerousZocKeys + tileStates), `BattleSidebar`, `GameHUD`, `EndGameModal`, `CombatPreviewTooltip`, `UnitInspector`, animation path step, glow naturel sélection. Game.tsx v3.7 (560 lignes).

---

## Phases 2-13 — Plans détaillés à produire en début de chaque phase

Convention : à chaque démarrage de phase N, on produit en bloc :
1. `AUDIT-PHASE-N.md` (lecture réelle du code livré, synergies + pièges anticipés).
2. `PLAN-PHASE-N.md` (sous-lots, sous-tâches, livrables, ordre de livraison).
3. Mise à jour de **ce fichier**.

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
- **Lot 11** ⬜ Phase 2 — IA solo (audit + plan à produire en début de Phase 2)

---

## Critères de fin de Phase 1

Recopiés dans `AUDIT-PHASE-1.md` § 5. À cocher avant bascule Phase 2 :

- [x] Migration 007-010 appliquées, RLS active sur `units` + `game_actions`, advisors clean
- [x] Bouton "Engager la bataille" fonctionnel : transition lobby → in_progress + spawn unités (GameHUD)
- [x] Sélection click + UnitInspector ; drag&drop reporté Phase 6 polish (cf BACKLOG)
- [x] Highlights `reachable` (cyan) + `targetable` (rouge) + `dangerous` (orange ZoC)
- [x] Preview combat affichée en hover ennemi targetable (CombatPreviewTooltip)
- [x] Animation move case par case (path step 1s/case)
- [x] Mouvement résolu côté serveur uniquement (EF `resolve_action` cas move)
- [x] Combat distance + mêlée serveur, seed stockée
- [x] Idempotence : double-click `Attaquer` n'inflige les dégâts qu'une fois (D12) — étendu à toutes actions via `client_action_id` UUID
- [x] Moral baisse aux pertes, déclenche `routed` sous seuil
- [x] LoS filtre les cibles tirables (alliés bloquent aussi)
- [x] `resolve_turn` incrémente `turn_number`, bascule `activeTeam`
- [x] GameHUD bandeau bas (Engager / Fin de tour / Quitter), BattleSidebar (TurnIndicator inline + UnitInspector), EndGameModal sur `finished`
- [x] Realtime sync 2 navigateurs sans refetch parasite (D14) — `REPLICA IDENTITY FULL` migration 010
- [x] ≥ 80 tests Vitest verts (107/107)
- [x] `npm run tsc` 0 erreur
- [ ] `npm run build` PWA OK (à valider en preview avant tag `phase-1-complete`)
- [x] `WIP.md`, `dependency-map.md`, `BACKLOG.md` mis à jour (skill tactica MAJ à la prochaine session)

---

## Cadre transverse — règles non négociables

1. Architecture 3 niveaux : zéro hardcode, tout via `SCALE_CONFIG` ou tables.
2. Frontière `engine/` ↔ `render/` ↔ `ui/` étanche.
3. Z = hauteur (Fusion 360), conversion Y↔Z encapsulée dans `render/`.
4. Hex flat-top cubique, voisins `0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE`.
5. TS strict, pas de `any` sans commentaire justifiant.
6. Fichiers max 500-600 lignes.
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
24. **(Confirmé L1C.3)** glb tint via `material.color = tint` éteint la texture sombre (uniforme militaire). Solution : color blanc, tint via `emissive` intensité 0.55-0.85.
25. **(Confirmé L1C.3)** Ring sélection `depthTest=false` rend devant TOUT (y compris le mesh devant). Solution : `depthWrite=false` + `renderOrder` + Y séparés.
26. **(Confirmé L1C.3)** State `'selected'` sur tile + ring au-dessus = z-fight (rayures radiales). Fix : ring autour seul (`tileStates` ne marque pas la tile sélectionnée).
27. **(Confirmé L1C.3)** Halo + net rings transparents au même Y = z-fight coplanaire. Fix : Y séparés 4 mm + `depthWrite=false` + `renderOrder`.
28. **(Confirmé L1C.4)** R3F `onPointerOver/Out` sur figurine ne donne pas l'event (juste l'unit). Pour tooltip ancré souris : tracker via `onMouseMove` sur le conteneur scène.

---

## Backlog idées

- Mode "Battle normale" vs "Historique" → post-Phase 1.
- Aura général + propagation panique → Phase 3.
- Replay URL partageable `/replay/{game_id}` → Phase 11.
- RLS units : vue SQL filtrée pour fog of war → Phase 4.

---

**État courant** : Phase 0 ✅ — **Phase 1 ✅ 13/13** — **Phase 1.5 ✅ polish wounded + visuels asymétriques** (migration 011 appliquée, ratio 60/40 killed/wounded, barre PV own-only, toasts combat asymétriques) — prochaine étape **Phase 2 IA solo** (audit + plan à produire en début de phase).
