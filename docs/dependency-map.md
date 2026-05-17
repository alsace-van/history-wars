# dependency-map.md — TACTICA

> Mise à jour : **17/05/2026 (session 25)**
> Source : analyse statique `src/` (159 fichiers TS/TSX) + `supabase/functions/` (5 EFs).
> But : permettre d'identifier rapidement **où aller pour modifier X** et **quels fichiers casser quand on touche Y**.

---

## 0. TL;DR — Si tu cherches…

| Tu veux modifier… | Va voir | Tests | EF concernée |
|---|---|---|---|
| Combat (dégâts, charge, ripost) | `src/engine/combat/v2/` | `*.test.ts` à côté | `resolve_action/_handlers/handleAttack.ts` |
| Mouvement (BFS, A*, ZoC) | `src/engine/movement/` + `src/engine/zoc/` | idem | `resolve_action/_handlers/handleMove.ts` |
| Cohésion / soutien | `src/engine/cohesion/` | idem | EF lit via `engine-port` mirror |
| Ordres conditionnels | `src/engine/orders/` | idem | `submit_orders/`, `resolve_turn/_evaluateOrders.ts` |
| IA bot | `src/engine/ai/` | idem | `run_bot_turn/` |
| Fog of war / vision | `src/engine/vision/` + `src/engine/los/` | idem | RLS Postgres `is_unit_visible` (migration 024) |
| Stats unités (HP, attack, range) | `src/engine/units/stats.ts` (`UNIT_STATS_V2`) | — | mirror engine-port |
| Hex (coord, voisins, ligne) | `src/engine/hex/` | idem | mirror engine-port + fonctions PL/pgSQL |
| Click handlers en jeu | `src/hooks/useBattleClickHandlers.ts` | — | — |
| Sélection / hint / targetables | `src/hooks/useTacticalSelection.ts` | — | — |
| Preview charge cav | `src/hooks/useChargePreview.ts` | — | `handleAttack.ts` (charge_intent) |
| Anim mouvement pion | `src/render/units/UnitPlaceholder.tsx` | — | — |
| Map hexagonale 3D | `src/render/hex/`, `src/render/scenes/TacticalScene.tsx` | — | — |
| Page de jeu (assemblage tout) | `src/ui/pages/Game.tsx` (~666 lignes ⚠️) | — | — |
| Mesh 3D (cheval, soldat, canon) | `src/render/units/<Kind>Mesh.tsx` + `public/models/*.glb` | — | — |
| Realtime Supabase | `src/hooks/useRealtime.ts` (générique), `useBattleUnits.ts`, `useGameRealtime.ts` | — | — |

---

## 1. Architecture en couches

```
┌─────────────────────────────────────────────────────────────────┐
│ ui/pages/*.tsx           ← assemblage final (Game.tsx hub)      │
│ ui/game/*.tsx            ← composants jeu (HUD, sidebar, modals)│
│ ui/auth/*, ui/lobby/*    ← écrans hors-jeu                      │
└─────────────────────────────────────────────────────────────────┘
            ↓ consomme                  ↓ consomme
┌──────────────────────────┐  ┌──────────────────────────────────┐
│ hooks/use*.ts            │  │ render/                          │
│  ├ tactique : selection, │  │  ├ scenes/TacticalScene.tsx (R3F)│
│  │   click, preview...   │  │  ├ hex/HexGrid + HexTile         │
│  ├ data : units, games,  │  │  ├ units/UnitPlaceholder + Mesh* │
│  │   realtime, auth      │  │  ├ effects/ (DamageFloater, etc.)│
│  ├ anim : path, sizing   │  │  ├ camera/, lighting/            │
│  └ derive : engagement,  │  │  └ _data/ (adapter, MVP layout)  │
│     vision, cohesion...  │  └──────────────────────────────────┘
└──────────────────────────┘            ↑ utilise
            ↓ utilise                    │
┌─────────────────────────────────────────────────────────────────┐
│ engine/  (pure TS, zéro React, zéro Three, zéro Supabase)       │
│  ├ hex/ (coords, distance, neighbors, line, key)                │
│  ├ units/ (stats, types, sizing, labels)                        │
│  ├ movement/ (BFS range, A* path), zoc/                         │
│  ├ los/, vision/, terrain/                                      │
│  ├ combat/v2/ (resolveCombat, charge, contact, findAttackPosition)│
│  ├ cohesion/, morale/                                           │
│  ├ engagement/ (tick persistant)                                │
│  ├ orders/ (triggers, actions, evaluate)                        │
│  ├ ai/ (scorer, picker, types)                                  │
│  └ scales/                                                      │
└─────────────────────────────────────────────────────────────────┘
            ↑ mirror                    ↑ mirror
            │                            │
┌─────────────────────────────────────────────────────────────────┐
│ supabase/functions/_shared/engine-port/  ← mirror Deno engine/  │
│ supabase/functions/                                              │
│  ├ resolve_action/_handlers/ (handleAttack, Move, Split, ...)   │
│  ├ resolve_turn/_evaluateOrders.ts (orders + engagement tick)   │
│  ├ run_bot_turn/ (IA serveur)                                   │
│  ├ submit_orders/, start_battle/                                │
└─────────────────────────────────────────────────────────────────┘
```

**Règle d'or** : `engine/` ne dépend de **rien** (ni React, ni Three, ni Supabase). Tout calcul gameplay y vit. Hooks/render/ui consomment engine. EF Supabase utilise un **mirror** de engine via `engine-port`.

---

## 2. Hot-spots (modules les plus dépendants/consommés)

### Top 5 modules consommés (`from '@…'` count)
| Module | Imports | Pourquoi |
|---|---|---|
| `@engine/units` (28×) | Stats + types `UnitState`, `UnitKind`, `Team` | utilisé partout |
| `@engine/hex` (27×) | `Cube`, `cubeKey`, `cubeDistance`, `cubeToWorld`, `spiral`, `neighbors` | omniprésent |
| `@engine/cohesion` (9×) | `computeCohesion`, `computeSupport` | combat + UI ring |
| `@hooks/useCombatActions` (7×) | `submitAction`, `endTurn` | toutes actions |
| `@engine/combat/v2` (4×) | `resolveCombat`, `AttackPositionResult` | combat + hint UI |

### Top fichiers "hub" (beaucoup d'imports sortants)
| Fichier | Rôle | ⚠️ Précaution |
|---|---|---|
| `src/ui/pages/Game.tsx` | **Hub central** : assemble ~25 hooks + scène 3D + UI | 666 lignes, > 600 limite (dette tech) |
| `src/hooks/useTacticalSelection.ts` | Calcule `attackTargets`, `reachableMap`, `tileStates`, hint coloré | 500+ lignes, sensible aux dépendances mémo |
| `src/hooks/useBattleClickHandlers.ts` | Dispatcher click unit / tile / shaken (modes : split/retreat/suicide/merge/charge preview) | tester chaque mode après modif |
| `src/render/units/UnitPlaceholder.tsx` | Pion 3D : anim path, lerp, facing, halos, label, healthbar | 500+ lignes, anim refs + useFrame |
| `supabase/functions/resolve_action/_handlers/handleAttack.ts` | Attaque atomique (pré-move + combat + post-charge retreat/stay/engagement) | v1.9 — bloc charge ligne 433-490 |

---

## 3. Modules engine (cœur gameplay)

### `engine/hex/` — Géométrie hex flat-top
- `coordinates.ts` — `cubeToWorld`, `worldToCube`. **Convention** : `x_world = 1.5 * hexSize * q`, `y_world = sqrt(3) * hexSize * (r + q/2)`. Mappé en 3D `[x, 0, y_world]` → **z_world = +y_world**.
- `distance.ts`, `neighbors.ts`, `line.ts` (cubeLineDraw avec epsilon shift — piège #13), `key.ts` (`cubeKey = "q,r"` axial 2-comp, **PAS** 3-comp — voir parseCubeKey).
- `index.ts` re-export.

### `engine/units/`
- `types.ts` — `UnitState`, `UnitKind` ∈ {I, C, A}, `UnitSubKind` ∈ {artillery_light, artillery_heavy, …}.
- `stats.ts` — `UNIT_STATS_V2` : I (effective 800, mv 4, range 1, atk 1.0), C (eff 180, mv 8, range 1, atk 1.1, vision 5), A (eff 120, mv 3, vision 4). `resolveUnitStatsV2(kind, subKind)`.
- `sizing.ts` (split/merge ratios), `labels.ts` (I.1, C.2, AO.1, AC.1).

### `engine/movement/`
- `range.ts` — `bfsReachable({start, movementPoints, blockers, enemyZocCubes})` → `Map<cubeKey, cost>`.
- `path.ts` — `aStar({start, goal, blockers, enemyZocCubes})` → `Cube[]` ou `null`.
- ZoC fait stopper l'unité quand elle entre.

### `engine/zoc/`
- `computeEnemyZoc(allUnits, ownTeam) → Set<cubeKey>`.

### `engine/combat/v2/` — Combat refonte Phase 2
- `index.ts` (`resolveCombat`), `contact.ts` (engagement + ripost), `matchup.ts` (matrice melee/ranged), `charge.ts` (`isPathStraight`, `chargedDistance`, `chargeMultiplier`, `isChargeApplicable`), `findAttackPosition.ts` (**Phase 2.6** — dispatcher unique attaque pour cav/inf/art avec hint).
- `canCharge.ts` ⚠️ **legacy non utilisé** (à supprimer session 26).
- `types.ts` — `CombatConfig`, `AttackPhase` ∈ {'melee', 'ranged', 'charge'}.

### `engine/cohesion/` (Phase 2.5)
- `computeSupport(unit, allUnits)` (alliés non-brisés rayon 1+2), `computeCohesion` → state `'nominal' | 'shaken' | 'broken'`.

### `engine/morale/`
- `computeMoraleDelta`, `computeRouted` (effectif-based, Phase 3.2-bis).

### `engine/engagement/` (Phase 2.6)
- `tick.ts` — applique tick par tour à chaque engagement (réduction cumul effective, dissolution si seuil).
- `types.ts` — `EngagementState`, `EngagementTickEvent`.

### `engine/orders/` (Phase 3.2)
- `types.ts` — `OrderTriggerKind` ∈ {'on_attacked', 'enemy_in_range', 'cohesion_broken', 'enemy_los', 'always'}, `OrderActionKind` ∈ {'charge', 'fire', 'retreat', 'hold', 'camp'}.
- `evaluate.ts` (consommé par `resolve_turn/_evaluateOrders.ts` côté EF).

### `engine/vision/` + `engine/los/` (Phase 3.1)
- `visibility.ts` — `visibleEnemiesFromTeam(allies, enemies, terrain)` avec range par kind + LoS Bresenham.
- `los.ts` — `hasLineOfSight(from, to, blockers)`.

### `engine/ai/` (Phase 4)
- `scorer.ts` — `scoreAction(unit, action, ctx)`. `picker.ts` — top-N actions.
- `types.ts` — `AIAction` discriminated union (move/attack_melee/attack_ranged/hold).

---

## 4. Hooks — couche tactique principale

### Pipeline tactique principal (Game.tsx → hooks)
```
Game.tsx
  ├─ useAuth, useRequireAuth, useGame(gameId)
  ├─ useBattleUnits(gameId, showBattle)  → { units: UnitRow[], refresh: refreshUnits }
  ├─ useVisionMap(unitStates, myTeam)    → { visibleTileKeys, enemyVisibility }
  ├─ useEngagement(gameId), useEngagementDerivations(...)
  ├─ usePreOrders, useActiveOrdersByUnit
  ├─ useTacticalSelection({ ...lots })  ⚠️ HUB SELECTION
  │    → { attackTargets, targetableUnitIds, tileStates,
  │        reachableMap, splitTargetKeys, retreatTargetKeys,
  │        suicideTargetIds, orderRetreatPickKeys, ... }
  ├─ useChargePreview({...}) ← Phase 2.6 preview retreat cav
  │    → { preview, openPreview, commitStay, commitRetreat, cancel,
  │        blockEndTurn }
  ├─ useUnitPathAnimation()  → { unitPaths, setUnitPaths, onUnitPathDone }
  ├─ useBattleClickHandlers({...beaucoup})  ⚠️ HUB CLICK
  │    → { handleUnitClick, handleTileClick, handleShakenConfirm }
  └─ useCombatActions  → { submitAction, endTurn, startBattle }
```

### Hooks par catégorie

**Auth & navigation** : `useAuth`, `useRequireAuth`, `useOnlineStatus`, `useSettings`.

**Données serveur** :
- `useGame(gameId, userId)` — game row + players, Realtime via `useGameRealtime`.
- `useBattleUnits(gameId, enabled)` — units + Realtime INSERT/UPDATE/DELETE.
- `useGames()` — lobby list.
- `useRealtime(channel, postgresChanges)` — wrapper générique Supabase Realtime.

**Sélection tactique** :
- `useTacticalSelection` — calcule tout ce que l'UI a besoin pour rendre la scène (cibles, hex highlight, hints). Lourd, beaucoup de useMemo.
- `useBattleClickHandlers` — décide quoi faire au click selon mode (split/retreat/suicide/merge/chargePreview/standard).
- `useChargePreview` — gère le state preview pré-commit charge cav (Phase 2.6).

**Anim & UI** :
- `useUnitPathAnimation` — Map `<unitId, path[]>` pour lerp UnitPlaceholder.
- `useUnitSizing` — scale par effective ratio.
- `useEnemyHoverTooltip` — hover scene → tooltip ennemi.
- `useCameraFocus` — bouton "Centrer" → caméra anim.
- `useCombatAnimator`, `useCombatHighlight`, `useCombatNotifications`, `useCombatToastFeed`, `useEngagementTickFloaters` — feedbacks combat.

**Orders / engagement / IA** :
- `usePreOrders` (drafts client), `useActiveOrdersByUnit` (icône pion 3D).
- `useEngagement` (Realtime engagements), `useEngagementDerivations` (engagedUnitIds, supportMap).
- `useOrderTriggeredToasts` (Realtime `order_triggered` → toast owner).
- `useBotAutoTurn` — host trigger end_turn auto après bot.

**Combat actions** :
- `useCombatActions` — `submitAction(gameId, action)` invoke EF `resolve_action`, `endTurn(gameId, scale)` invoke `resolve_turn`, `startBattle`.
- `useUnitCriticalActions` — critical buttons (rompre, suicide, surrender, …).

**Vision** :
- `useVisionMap(unitStates, myTeam)` — calcule `visibleTileKeys` + `enemyVisibility` (Set<unitId, 'hidden'|'spotted'|'identified'>).

⚠️ **Legacy à nettoyer** : `usePostChargeChoice.ts` (remplacé par `useChargePreview`).

---

## 5. Render (Three.js / R3F)

```
ui/pages/Game.tsx
  └─ <TacticalScene>
       ├─ <SceneShell> (Canvas R3F)
       │    ├─ <SceneLighting>
       │    ├─ <CameraController>  (orbit + focus, depuis useCameraFocus)
       │    ├─ <HexGrid>           (terrain tiles array)
       │    │    └─ <HexTile> ×N   (état coloré depuis tileStates)
       │    ├─ <UnitPlaceholder> ×N  (chaque unit visible)
       │    │    ├─ groupRef         (position monde, anim path)
       │    │    ├─ meshGroupRef     (rotation Y dynamique — v2.19)
       │    │    │    └─ <CavalryMesh | SoldierMesh | CannonMesh | HowitzerMesh>
       │    │    ├─ <UnitStatusRing>   (anneau cohésion vert/jaune/orange)
       │    │    ├─ <UnitSupportRing>  (cercles soutien bleus)
       │    │    └─ <UnitHealthBar>    (segments effective/wounded/killed)
       │    ├─ <DamageFloater> ×N   (chiffres montants combat)
       │    └─ <EngagementOverlay>
       └─ overlay HTML (BattleHeader, BattleSidebar, etc.)
```

**`render/_data/`** :
- `unitAdapter.ts` — adapte `UnitRow` (BDD) → `UnitState` (engine) + `UnitInstance` (render).
- `mvpUnitPlacement.ts` — boardKeys + placements MVP.

**`render/colors.ts`** — palette : `teamRed`, `teamBlue`, `unitSelectedRing`, `cohesionNominal/Shaken/Broken`, `attackHintColors` (charge orange, march jaune, march-fire violet, melee rouge).

**Pièges connus** :
- `RING_LIFT` / `RING_NET_LIFT` (piège #47 z-fighting).
- Conversion axes Blender → glTF → Three.js : `FACING_OFFSET_BY_KIND` à calibrer par mesh (session 25).
- `useGLTF` cache GLB — preload via `useGLTF.preload(URL)`.

---

## 6. UI components

### `ui/pages/`
- `Auth.tsx` — login/signup, fond animé `AuthBackground`.
- `Lobby.tsx` — liste games + `CreateGameDialog`.
- `Home.tsx`, `RenderTest.tsx`.
- **`Game.tsx`** — hub central, assemble tout (cf. § 4).

### `ui/game/` — composants in-game
- **`BattleHeader.tsx`**, **`BattleSidebar.tsx`** + footer — UI principale.
- **`BattleModals.tsx`** — modals (charge popup legacy, shaken warning, endgame).
- **`GameHUD.tsx`** — bandeau bas (tour, fin de tour).
- **`GameTopBar.tsx`** — top bar (retour lobby, end_turn).
- **`OrdersPanel.tsx`** — édition pré-ordres conditionnels.
- **`CombatPreviewTooltip.tsx`**, **`CombatResultPanel.tsx`** — feedback combat.
- **`UnitInspector.tsx`**, **`EnemyUnitPanel.tsx`** — détails unité.
- **`ShakenAttackConfirm.tsx`** — modal avertissement Brisée.
- **`TeamPanel.tsx`**, **`AddBotButton.tsx`**, **`ParticipantsPanel.tsx`** — gestion équipes/bots.
- **`EndGameModal.tsx`** — stats fin partie.
- `gameLabels.ts`, `orderLabels.ts` — i18n statique.

### `ui/auth/`
- `AuthBackground.tsx` + 4 `scenes/Scene*.tsx` (formation, charge, marche, topo) — fond animé R3F.

### `ui/components/`
- Primitives : Button, Input, Label, PasswordInput, Typewriter, UpdatePrompt.

### `ui/layout/`
- `PageBackground.tsx` — fond global pages auth/lobby.

---

## 7. Supabase Edge Functions

```
supabase/functions/
├─ _shared/
│   ├─ cors.ts (jsonResponse, errorResponse, ERROR_CODES)
│   ├─ types.ts (payloads, snapshots)
│   ├─ supabase.ts (admin client service_role)
│   └─ engine-port/  ← MIRROR de src/engine/ pour Deno
│       ├─ hex/, units/, movement/, zoc/, combat/v2/, cohesion/,
│       ├─ morale/, engagement/, orders/, los/, vision/, terrain/
│       └─ ⚠️ doit rester en phase avec src/engine/
├─ resolve_action/
│   ├─ index.ts (dispatcher type → handler)
│   └─ _handlers/
│       ├─ _common.ts (UnitRow, buildUnitState, terrainMap, …)
│       ├─ handleAttack.ts ← v1.9, gère melee/ranged/charge/charge_intent
│       ├─ handleMove.ts
│       ├─ handleSplit.ts, handleMerge.ts
│       ├─ handleRetreat.ts, handleSurrender.ts, handleSuicide.ts
│       ├─ handleEngage.ts, handleBreakCombat.ts
│       └─ handleChargeStay.ts, handleChargeRetreat.ts ⚠️ legacy non utilisés
├─ resolve_turn/
│   ├─ index.ts (compute morale, refresh has_moved/has_attacked, switch team)
│   └─ _evaluateOrders.ts (snapshot-then-resolve ordres conditionnels)
├─ run_bot_turn/ (IA serveur, scorer/picker, apply move|attack|hold)
├─ submit_orders/ (CRUD batch ordres + validation + swap priorités)
└─ start_battle/ (init scénario, units, terrain)
```

**Pièges EF** :
- Toujours utiliser `admin` (service_role) côté EF — bypass RLS pour writes.
- Réutiliser `client_action_id` pour idempotence (UNIQUE constraint sur `game_actions`).
- Le mirror `engine-port` doit être synchronisé manuellement quand on modifie `src/engine/`.
- `boardRadius` doit venir de la game, **pas hardcodé** (fixé session 22).

**Versions EF prod (17/05/2026)** : `run_bot_turn` v7, `resolve_turn` v6, `resolve_action` v22, `submit_orders` v4, `start_battle` v5.

---

## 8. Database (Supabase Postgres)

### Tables clés
- `games` — game row (turn_number, status, active_team, scenario, board_radius, …).
- `game_players` — slots équipes (team, user_id, is_bot, profile_id).
- `units` — pions en jeu (id, game_id, team, kind, sub_kind, q, r, hp, wounded, effective, killed, morale, routed, has_moved, has_attacked, last_move_path, pending_post_charge_target_id, …).
- `game_actions` — log toutes les actions (action_type, payload, result, seed, client_action_id UNIQUE).
- `engagements` — engagements persistants (attacker_id, defender_id, turn_started, from_charge).
- `unit_orders` — ordres conditionnels (unit_id, priority, trigger, action, params).
- `terrain_tiles` — terrain par game (q, r, terrain_type).
- `combat_config` — config tunable (matchupMatrix, chargeMultipliers, baseAttritionRate).
- `scenarios` — templates de batailles MVP.

### RLS
- `units_select_member` (PERMISSIVE) + `units_select_spectator` (PERMISSIVE) + **`units_select_fog`** (RESTRICTIVE, migration 024) → vision basée sur `is_unit_visible(unit_id, viewer_uid)`.
- `unit_orders` : owner-only (privacy Phase 3.2).

### Migrations critiques
- 012-014 : combat v2 + scenarios + combat_config.
- 015-016 : balance cav.
- 017 : engagements (Phase 2.6 Vague B).
- 018 : fix CHECK constraint action_type (11 valeurs).
- 019-020 : unit_orders + action_type 'order_triggered'.
- 021 : sub_kind enum + scénarios étendus.
- 022 : bots (`user_id NULL` si `is_bot=true`).
- 023 : mode spectateur.
- 024 : RLS fog server-side + helpers SQL hex.
- 025 : `units.pending_post_charge_target_id` + `engagements.from_charge` (nécessaires pour handleAttack v1.9). ✅ prod, ⚠️ untracked git.
- 026 : action_types `charge_stay/retreat` (legacy non utilisés par le client moderne). ✅ prod, ⚠️ untracked git.
- 027 : nerf chargeMultipliers v3 (1.3/1.4/1.5) → v4 (1.15/1.20/1.25). ✅ prod, ⚠️ untracked git.
- 028 : `is_unit_visible()` — alliés ne bloquent plus LoS (anti-fog cav en première ligne). ✅ prod, ⚠️ untracked git.
- **À faire** : `git add supabase/migrations/025-028.sql` pour tracker localement.

---

## 9. Tests

- `npx vitest` (config `vite.config.ts`) — 345/345 verts (session 24).
- Tests engine côte à côte (`*.test.ts` dans chaque module).
- Pas de tests E2E Playwright actifs.
- Pas de tests hooks (à envisager pour `useChargePreview`, `useTacticalSelection`).

---

## 10. Pièges connus (sessions récentes)

| # | Piège | Session | Documenté |
|---|---|---|---|
| 13 | `parseCubeKey` : `cubeKey` axial 2-comp (`"q,r"`), pas 3-comp → `dest.s = NaN` → `cubeDistance` NaN → bug silencieux | 23 | `WIP.md` § Session 23 |
| 47 | Z-fighting halos plats : utiliser `RING_LIFT` + `RING_NET_LIFT` (4mm écart) | early | `UnitPlaceholder.tsx` comments |
| — | Realtime Supabase peut **coalescer 3 UPDATEs successifs** sur même row → events perdus. Solution : `refresh()` explicite après EF return ok | 25 | `WIP.md` § Session 25 fix 3 |
| — | `UnitPlaceholder` lerp `useEffect targetPos` skip pendant anim path → position absente après anim. Fix : re-check à fin d'anim | 25 | `WIP.md` § Session 25 fix 5 |
| — | Convention axes **Blender Z-up → glTF Y-up** : exporter peut introduire offset rotation. Calibrer via `FACING_OFFSET_BY_KIND` | 25 | `WIP.md` § Session 25 fix 8 |
| — | EF doit lire `active_team` snake_case (BDD) pas `activeTeam` camelCase | 22 | `WIP.md` § Session 22 |
| — | `boardRadius` hardcodé ≠ source de bug → toujours lire game.board_radius | 22 | idem |
| — | useEffect cleanup peut annuler `setTimeout` du hook bot → invoke direct sans setTimeout dans hook | 22 | idem |
| — | `submitAction` charge_intent **doit aller dans `payload`** (pas action root) | 25 | `useChargePreview.ts` v1.2 |
| — | `chargePreview.preview` stale après refus serveur → toujours reset preview après submit, peu importe `res.ok` | 25 | `useChargePreview.ts` v1.1 |

---

## 11. Hot-path code (à connaître par cœur)

### Click sur ennemi avec cav sélectionnée
```
TacticalScene <UnitPlaceholder onClick>
  → useBattleClickHandlers.handleUnitClick(unit)
     ├─ chargePreviewTargetId ? → commitStay() ou cancel
     ├─ mergeMode ? → performMerge(unit.id)
     ├─ suicideMode ? → performSuicide(unit.id)
     ├─ targetableUnitIds.has(unit.id) ? → bloc attaque
     │   ├─ cohesion='shaken' & !skipShaken → setPendingShakenAttack
     │   ├─ meta = attackTargets.get(unit.id)
     │   ├─ meta.hint === 'charge' → openChargePreview(unit, meta) [stop]
     │   ├─ sinon → setUnitPaths + submitAction('attack_melee/ranged', payload)
     │       → handleAttack EF v1.9
     │            ├─ pré-move (UPDATE units)
     │            ├─ resolveCombat (engine)
     │            ├─ UPDATE units (combat result, has_attacked)
     │            ├─ INSERT game_actions
     │            ├─ createEngagementAfterMelee (si melee + survie)
     │            └─ bloc charge (si phase=charge & !attackerKilled)
     │                ├─ stay → createEngagementAfterMelee
     │                ├─ retreat → UPDATE units (q, r retreat_dest)
     │                └─ ni stay ni retreat → set pending_post_charge_target_id
     └─ sinon → hookHandleUnitClick (select / clear)
```

### Click sur case retreat preview
```
TacticalScene <HexTile onClick>
  → useBattleClickHandlers.handleTileClick(cube)
     ├─ chargePreviewTargetId + retreatKeys.has(key) → commitChargeRetreat(cube)
     │     → submitAction('attack_melee', { ..., charge_intent: {post_charge:'retreat', retreat_dest}})
     ├─ orderRetreatPickMode + key OK → commitOrderRetreatPick
     ├─ retreatMode + key OK → performRetreat
     ├─ splitMode + key OK → submitAction('split_unit', ...)
     └─ sinon → move standard (aStar + submitAction('move', ...))
```

---

## 12. Quand modifier X, vérifier Y

| Modif sur… | Check aussi… |
|---|---|
| `engine/combat/v2/*` | `supabase/functions/_shared/engine-port/combat/v2/*` (mirror), `handleAttack.ts`, tests `*.test.ts` |
| `engine/hex/*` | mirror + fonctions PL/pgSQL migration 024 (`cube_distance`, `cube_round`, `has_line_of_sight`) |
| `engine/orders/*` | `resolve_turn/_evaluateOrders.ts`, `submit_orders/index.ts`, `usePreOrders`, `OrdersPanel.tsx` |
| `engine/units/stats.ts` (UNIT_STATS_V2) | mirror, équilibrage tests combat, OrdersPanel display |
| Schéma `units` (colonne ajoutée) | RLS `units_select_fog`, `useBattleUnits.UnitRow`, `unitAdapter.ts`, types EF `_common.ts` |
| `useTacticalSelection` (memo deps) | re-test sélection après chaque mode (split/retreat/merge/preview) |
| `useBattleClickHandlers` | tester chaque mode (mode A ne casse pas mode B) |
| `UnitPlaceholder.tsx` anim/facing | tester avec **chaque kind** (I/C/A) — orientations GLB différentes (FACING_OFFSET_BY_KIND) |
| Action type (nouveau) | migration CHECK constraint `game_actions.action_type` (cf. migration 018) + handler EF + `useCombatActions.GameAction` union |
| EF prod | redéployer (`npx supabase functions deploy <name> --project-ref abhbkdyoknrsdavimbpr`) ; bump CLAUDE.md § EFs prod |

---

## 13. Conventions code

- **Headers de version** en haut des fichiers `// vX.Y (DD/MM/YYYY) — description`. Bump à chaque modif sémantique.
- **`engine/` jamais d'import depuis hooks/react/three/supabase**.
- **Mirror `engine-port`** doit être identique fonctionnellement à `engine/`.
- **`cubeKey`** = format axial `"q,r"` (2 comps), pas `"q,r,s"`. Toujours utiliser `parseCubeKey` pour reconstruire `Cube` avec `s = -q - r`.
- **`client_action_id`** UUID v4 généré client, passé à chaque EF write pour idempotence.
- **Pas de TodoWrite** dans la doc d'archi — gérer via cette dep-map + WIP.md.

---

**Dernière régénération** : 17/05/2026 session 25 (TACTICA).
**Mainteneur** : à ré-auditer si > 5 sessions sans MAJ ou si réorganisation majeure de l'architecture.
