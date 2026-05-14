# WIP.md

---

## Session 23 &mdash; 14/05/2026 &mdash; Phase 4 polish IA solo (5 fixes critiques + clarté journal combat)

**Bot rendu jouable bout-en-bout.** Reprise de la session 22 sur le bug "bot pick all-hold" → root cause trouvée (cubeKey 2 composantes splittée en 3 → dest.s = NaN → cubeDistance NaN → tous les moves score=0). 5 fixes successifs :

### Fix 1 — Bot ne bouge pas (NaN dans dest.s)

- **Cause** : `cubeKey()` encode `"q,r"` (axial 2 composantes, `s` dérivé via `-q-r`). Le picker IA faisait `k.split(',')` en destructurant 3 éléments → `s = Number(undefined) = NaN`. Conséquence : `cubeDistance(dest, enemy)` retournait NaN → `if (approach > bestApproach)` toujours `false` (NaN > 0 = false) → tous les moves `score = 0` = `scoreHold` → tri stable garde `hold` (insertion #0) → 5×hold/tour au lieu de 5 moves.
- **Fix** : utiliser `parseCubeKey(k)` (existe déjà). Dans 2 fichiers : [src/engine/ai/picker.ts](src/engine/ai/picker.ts) v1.1 + mirror Deno [supabase/functions/_shared/engine-port/ai/picker.ts](supabase/functions/_shared/engine-port/ai/picker.ts) v1.1.
- **Bug latent identique** trouvé dans [src/hooks/useTacticalSelection.ts](src/hooks/useTacticalSelection.ts) v1.13 : filtre `postRuptureAdjacentEnemies` était silencieusement inopérant (NaN ≤ 1 = false → tous hex autorisés au lieu d'être filtrés).
- **Régression** : [src/engine/ai/picker.bug-repro.test.ts](src/engine/ai/picker.bug-repro.test.ts) (snapshot game `fb8ee6d5`).
- **Pitfall #13** ajouté à [docs/CLAUDE.md](docs/CLAUDE.md) : _"`cubeKey` est format axial 2 composantes (q,r), JAMAIS splitter en 3"_.

### Fix 2 — Tour ne bascule pas après bot fin de tour

- **Cause** : `resolve_turn` v1.5 refusait `NOT_YOUR_TURN` (403) quand le humain bleu tentait d'end_turn pendant le tour bot rouge. Le bot ne pouvait pas s'auto-end → tour bloqué.
- **Fix** : [supabase/functions/resolve_turn/index.ts](supabase/functions/resolve_turn/index.ts) v1.6 — bypass `NOT_YOUR_TURN` quand `activeTeam` contient un bot (n'importe quel humain peut basculer). Côté client [Game.tsx:476-485](src/ui/pages/Game.tsx#L476-L485) appelle `endTurn(gameId)` 1.2s après retour `run_bot_turn` (délai pour visualiser les moves).

### Fix 3 — Bot engagé ne riposte pas (passif quand entouré)

- **Cause** : `scoreAttack = damage − risk` négatif en 1v3 (riposte > damage), `scoreHold = 0` → tri DESC + sort stable → hold insertion #0 gagne. Le bot subissait 3 attaques/tour sans riposter (suicide passif).
- **Fix** : [src/engine/ai/scorer.ts](src/engine/ai/scorer.ts) v1.1 — `scoreHold = -50` si `engagedUnitIds.has(unit.id)`. Force le bot à attaquer même si score négatif (mieux taper et tomber avec un blue qu'attendre passif). Mirror Deno [supabase/functions/_shared/engine-port/ai/scorer.ts](supabase/functions/_shared/engine-port/ai/scorer.ts) v1.1.
- **Régression** : 2 nouveaux tests dans `picker.bug-repro.test.ts` (bot engagé doit pick attaque).

### Fix 4 — Journal de bataille : qui attaque pas clair

- **Cause** : titre rapport "Mêlée : Infanterie Bleus vs Cavalerie Rouges" — `vs` neutre, ambiguë sur attaquant/défenseur, aucune indication "Bot", labels longs.
- **Fix** : 
  - [src/ui/game/gameLabels.ts](src/ui/game/gameLabels.ts) v1.3 : helpers `getKindAbbrev` (I/C/AO/AC/AR) + `getUnitShortLabel(unit, allUnits)` → `"I1", "AO2"...` (numérotation par team+kind+subKind, tri id ASC).
  - [src/hooks/useCombatNotifications.ts](src/hooks/useCombatNotifications.ts) v2.4 : champs `attackerShortLabel`, `defenderShortLabel`, `attackerIsBot` ajoutés à `CombatNotification`.
  - [src/ui/game/CombatResultPanel.tsx](src/ui/game/CombatResultPanel.tsx) v4.3 : bandeau refondu avec icône ⚔/🏹 colorée selon attaquant + titre directionnel `[AO1 rouge] → [I1 bleu]` + badge `Bot` à côté de l'attaquant si `actor_user_id=null` + mention `(votre attaque)` / `(subi)` / `(spectateur)`. Blocs `LossesBlock` préfixés par short label.

### EFs déployées prod

- `run_bot_turn` v6 puis v7 (deux deploy : fix NaN puis fix scoreHold engagé).
- `resolve_turn` v6 (bypass NOT_YOUR_TURN si bot).

Tests : 348/348 verts (+3 nouveaux). tsc clean.

### Prochaine action session 24

- **Phase 4-bis** : lookahead 2-3 ply OU fog server-side RLS (vue SQL filtrée units pour cacher positions ennemies hors fog côté client = anti-cheat).
- Bot encore limité à `move/attack/hold` — pas de scission/fusion, charge cav, ni ordres conditionnels (Lot B Phase 4 ou 4-ter, non planifié).

---

## Session 22 (clôture) &mdash; 14/05/2026 &mdash; Phase 3.3 + Phase 3.3-bis (charge réelle + campement) + Phase 4 Lot A (IA solo MVP serveur)

**3 phases livrées + déployées en une session marathon.** Bot solo encore en cours de debug fin de session — le hook fire, l'EF répond `ok actions_applied=5`, mais les 5 actions insérées sont toutes `hold` malgré les fixes scoreMove/picker. Logs serveur ajoutés en fin de session pour next diagnostic.

### Phase 3.3 livrée

Sprint UX + balance fin de Phase 3.

- **Artilleries split light/heavy** (subKind `artillery_light` = obusier vs `artillery_heavy` = canon). Stats distinctes : range 3 vs 6, `arcedTrajectory` true/false (obusier tire en cloche par-dessus unités, canon tir tendu LoS requis), `optimalRangeMax` pour falloff explicite (zone optimale [minRange, 3]). Labels **AO** (obusier) / **AC** (canon) côté UI 3D + sidebar via `getKindCode()` dans `computeOrdinalLabels` v1.1.
- **Plafond détection ordres dynamique** : fire → `stats.range` de l'unité (1 pour infanterie alerte, 3 obusier, 6 canon). Non-fire → `max(range, vision)` au lieu de 10 fixe. Évite "détection 10 hex" sur artillerie. `OrdersPanel` v1.2.
- **Bonus défensif hold** : `+15% défense base` + `bonus terrain ×2 delta` (plaine +15%, forêt +50%, brèche +73%). Appliqué sur 3 sites : `handleAttack` v1.4 (attaque manuelle), `applyFireOrderCombat` v1.4 (ordre fire), `engagement/tick.ts` v1.2 (mêlée continue). Symétrique attaquant/défenseur (riposte) via `attackerOnHold`. Breakdown UI : "Posture hold (préparation) ×1.15" + "Terrain defense (foret, hold ×2)".
- **Migration 021** : sub_kind `'artillery'` renommé `'artillery_heavy'` + scenarios MVP étendus à 10 unités (5 vs 5) avec 1 obusier + 1 canon par camp.

### Phase 3.3-bis livrée (Charge réelle + Mode campement)

- **Charge réelle avec dégâts** (`_evaluateOrders.ts` v1.5 `applyChargeOrderCombat`) : avant l'ordre `charge` ne faisait que déplacement + flag has_attacked + INSERT engagement, **0 dégât**. Maintenant : synthétise `attackerPath` via `cubeLineDraw(origPos → destHex)` pour activer charge cav (≥ 3 hex straight) → `resolveCombat` complet avec ripost + INSERT `attack_melee/charge` + engagement si survivants. −1 morale effort.
- **Mode campement** (4ᵉ posture) : `OrderActionKind = 'camp'` + nouveau `OrderTriggerKind = 'always'`. Effets : `morale +5` (cap moraleMax), heal auto `min(round(wounded × 0.10), wounded)` réintègre `effective`. Pas de bonus défensif (trade-off du hold). Pattern d'usage type : `priority=1: on_attacked → retreat` + `priority=2: always → camp` (camp en fallback quand pas attaqué). Icône `⛺` vert sur pion 3D ([UnitPlaceholder](src/render/units/UnitPlaceholder.tsx) v2.14). Toast "AC.1 campe (+5 moral)".
- **Listener `order_triggered` + toast owner** ([useOrderTriggeredToasts.ts](src/hooks/useOrderTriggeredToasts.ts) v1.0) : Realtime subscribe `game_actions.action_type='order_triggered'`, filtré `actor_user_id === viewerUserId` (privacy). Émission toast "Ordre déclenché — I.1 charge sur C.2".
- **Icône ordre conditionnel sur pion 3D** (`useActiveOrdersByUnit.ts` v1.0 + `UnitPlaceholder` v2.13) : Map `unit_id → priority=1 active kind`. Pictogrammes thématiques : ♞ charge (rouge) / ⚔ fire (orange) / ↩ retreat (bleu) / 🛡 hold (gris) / ⛺ camp (vert). Affiché sous le count.
- **Retreat directionnel** (Lot C) : `OrdersPanel` v1.3 bouton "Choisir hex sur la map" → mode `orderRetreatPickMode` dans `useTacticalSelection` v1.12 → highlight `spiral(unit.position, movement)` en bleu (`tileRetreatTarget`). `pickRetreatHex` honore `params.destHex` si fourni (voisin direct si ≤ movement, sinon step-toward, fallback auto si invalide). Stocké dans `unit_orders.action.params.destHex` (JSONB, pas de migration).

### Phase 4 Lot A livrée (IA solo MVP serveur 1 ply)

**Décisions** :
- IA côté serveur (EF Deno) — déterministe, anti-cheat, réuse engine-port.
- MVP 1 ply (greedy) — pas de lookahead. Différenciation difficulté : `easy` = random parmi top 3, `medium` = greedy strict, `hard` = greedy + tiebreak offensif (attaque > move > hold).
- Fog server-side RLS différé en Phase 4-bis.

**Engine** (`src/engine/ai/` + mirror Deno `engine-port/ai/`) :
- `types.ts` : `AIProfile`, `AIAction` discriminated union (`move | attack_melee | attack_ranged | hold`), `AIContext`.
- `scorer.ts` : `scoreAction(unit, action, ctx)` → attack = `damageMax − riskMax` (+30 kill bonus, +10 charge bonus), move = `approach − risk` (rapprochement vers ennemi le plus faible), hold = 0 ou +5 si morale<50 non engagé. **MVP cheat** : voit tous les ennemis (pas seulement visibles) sinon bot reste planté en début de partie.
- `picker.ts` : `enumerateActions` (attaques visibles avec LoS + 12 moves max BFS + hold) + `pickBestActionForUnit` (DESC sort, easy=random top 3, medium=top 1, hard=tiebreak offensif). Filtre `visibleTileKeys` retiré (l'IA peut bouger dans le fog).
- 11 tests engine (scorer 6 + picker 5).

**Edge Function** ([run_bot_turn/index.ts](supabase/functions/run_bot_turn/index.ts)) :
- Auth JWT (user dans game_players) + body `{ game_id }`.
- Charge units + terrain + combat_config + engagements. Active team via `state.tactical.activeTeam` (camelCase — fix bug snake_case `active_team` qui fallback toujours à 'blue').
- boardRadius via `state.tactical.boardRadius` (fallback 7).
- Boucle units bot (id ASC) → `pickBestActionForUnit` → `applyBotAction` (move : UPDATE units + INSERT `move`; attack : resolveCombat + INSERT `attack_melee/ranged` + engagement ; hold : INSERT `end_turn` avec payload `bot_action='hold'`).
- Le client humain reste responsable du `resolve_turn` final (pour MVP simplicité, pas d'auto end_turn bot).

**Migration 022** : `user_id NULL` autorisé si `is_bot=true`. RLS host peut INSERT/DELETE bot rows. Check constraint `(is_bot=true) OR (user_id IS NOT NULL)`.

**Migration 023** : mode spectateur. Tout authenticated peut SELECT games/units/game_actions/game_players/terrain_tiles/engagements quand `status='in_progress'`. Permet à un 2ᵉ compte de regarder la partie sans être membre (utile pour debug IA — fog désactivé client-side quand `myTeam=null`).

**Client UI** :
- `AddBotButton.tsx` (new) : dropdown 3 difficultés Facile/Moyen/Difficile.
- `TeamPanel` v1.1 : prop `onAddBot` → bouton sous slots si host + slot vacant.
- `Game.tsx` `handleAddBot` : INSERT game_players (RLS check) + toast.
- `useBotAutoTurn.ts` (new) : auto-invoke `run_bot_turn` quand activeTeam = bot, host only (anti-double-trigger), idempotence locale via `lastTriggeredTurnRef`. Bug **résolu** : useEffect re-fire à chaque render (deps `players.map(...)` crée nouveau ref) → cleanup `clearTimeout(t)` annulait le setTimeout 500ms AVANT invoke. Fix : retirer cleanup + retirer setTimeout (invoke direct).
- `useCombatNotifications` v2.5 : accepte `actor_user_id=null` pour bot, déduit team depuis `units.attacker_id`. Spectateur (`viewerTeam=null`) voit TOUS les combats.
- `GameCard.tsx` v1.1 : bouton **👁 Spectateur** pour parties in_progress non-membre.
- `Game.tsx` accès autorisé aux non-membres si `status='in_progress'`.

### Bugs critiques diagnostiqués session 22

1. **Hook bot ne fire jamais malgré "TRIGGER"** : useEffect re-fire à chaque render → cleanup `clearTimeout(t)` annulait le setTimeout. Ref empêchait re-lancement. Fix : retirer cleanup + invoke direct sans setTimeout.

2. **EF run_bot_turn retourne 400** : lecture `state.tactical.active_team` (snake_case) au lieu de `activeTeam` (camelCase) → fallback toujours `'blue'` → `NO_BOT_ON_ACTIVE_TEAM`. Fix dans `run_bot_turn/index.ts` ligne ~75.

3. **canStart greyé avec bot** : `occupiedPlayers` filtrait `user_id !== null`, excluait les bots. Fix client `Game.tsx:158` + server `start_battle/index.ts:97` : accepter `is_bot=true` aussi.

4. **boardRadius hardcodé 5 dans EF bot** : scenario utilise 7 → unités bot à q=6 hors plateau → `bfsReachable` vide → bot reste planté. Fix : lire depuis `state.tactical.boardRadius`.

### Bug ouvert fin session 22 — Bot insère 5× `hold` malgré fixes

Status à clôture : hook fire ✓, EF répond `ok actions_applied=5` ✓, mais les 5 actions sont des `hold` (table `game_actions` : `action_type='end_turn'`, `payload.bot_action='hold'`).

Fixes appliqués qui devraient résoudre (vérifié sur EF déployée v5 via `mcp__claude_ai_Supabase__get_edge_function`) :
- `scoreMove` retiré filtre `visibleEnemyIds.has(enemy.id)` — l'IA voit tous les ennemis (MVP cheat).
- `enumerateActions` retiré filtre `visibleTileKeys` — moves dans le fog OK.

Logique attendue : pour unité C(6,-4,-2) vs humain à q=-6, distance ~12 → move vers (5,-3,-2) → distAfter=11 → approach=1 → scoreMove = `1 × 10 − risk(0)` = 10 ; scoreHold = 0 ; medium picker → move gagne.

Mais en pratique tous les actions sont `hold`. **Logs serveur ajoutés** dans `run_bot_turn` ligne ~164 : `console.log` qui affiche `unit, kind, pos, visibleEnemies.size, action choisie`. EF redéployée. **Next session : créer une nouvelle partie + faire end_turn humain → check `get_logs` Edge Function pour voir ce que `pickBestActionForUnit` retourne réellement**. Hypothèses :
- `bfsReachable` retourne 0 hex (problème blockers/zoc) → enumerate ne génère pas de moves
- `pickBestActionForUnit` skip moves pour autre raison
- Le code Deno port n'a pas vraiment été redéployé (cache CDN ?)

### Workflow PWA — Bug subtil dev mode

Vite HMR pousse les modifications côté client, **mais le Service Worker PWA peut servir une ancienne version cachée**. Pour debugger : DevTools → Application → Service Workers → Unregister + Network → Disable cache. Ajouté procédure à la note.

### Branches GitHub nettoyées

9 branches `claude/*` (PRs déjà mergées #27/28/29/33/35/41/43/44/45) à supprimer manuellement par l'utilisateur via `git push origin --delete`. Auto-mode classifier bloque la suppression en lot — script donné. Recommandation : activer "Automatically delete head branches" dans Settings GitHub.

### Stats fin session 22

- **345/345 tests Vitest verts** (+31 vs session 21 : 11 IA + 5 hold bonus + 4 camp/always + 3 retreat destHex + 2 labels AO/AC + tests divers).
- `tsc` 0 erreur.
- Migrations BDD : 021 (artillery_light/heavy) + 022 (bot user_id nullable + RLS) + 023 (spectator mode) appliquées prod via MCP.
- EFs prod : `run_bot_turn` v5 (nouvelle), `resolve_turn` v19, `resolve_action` v21, `submit_orders` v4, `start_battle` v5.
- Commit `cd6b451` Phase 3.3 push pending. Tous les changements Phase 3.3-bis + Phase 4 Lot A non commités.
- Game.tsx ~660 lignes (toujours > 600 — dette technique reportée).

### Decisions backlog session 22

- **Mode campement Phase 5** : ajouter Infirmier dédié qui amplifie le heal. Aujourd'hui auto-soin 10%/tour. Backlog Phase 5.
- **Bot lookahead 2-3 ply** : Phase 4-bis avec α-β pruning pour profil `hard`.
- **Fog RLS server-side** : Phase 4-bis (vue SQL filtrée par LoS PL/pgSQL). Aujourd'hui fog client-side seulement.
- **Bot auto end_turn** : Phase 4-bis. Aujourd'hui le client humain doit cliquer end_turn pour basculer activeTeam après le bot.
- **Limite UnitPlaceholder icônes** : feedback user "ne pas superposer les icônes" sauvegardé en mémoire `~/.claude/projects/.../memory/feedback_no_icon_overlap.md`.

### Prochaine étape — Session 23

1. **Debug bot pickBestActionForUnit** : créer partie + bot + end_turn → check `mcp get_logs` pour voir le `console.log` ajouté dans run_bot_turn (verra unit/kind/pos/visibleEnemies/action). Si action='hold' systématiquement → bug dans enumerate ou scorer (peut-être `bfsReachable` retourne 0 candidats, ou `ctx.boardKeys` mal chargé). Si action='move' mais `applyBotAction` échoue → vérifier UPDATE units côté admin.
2. **Push commit `cd6b451` (Phase 3.3)** + commit Phase 3.3-bis + Phase 4 Lot A.
3. **Nettoyer les 9 branches `claude/*` mergées** sur GitHub (script donné).
4. Possible Phase 4-bis si bot fonctionne (lookahead, fog RLS, auto end_turn).

### Plan file utilisé session 22

`/Users/stephanekapp/.claude/plans/toasty-puzzling-beaver.md` — successivement réécrit pour Phase 3.3 (Lots A/B/C), puis Phase 3.3-bis (charge + camp), puis Phase 4 Lot A (IA solo). Approuvé par user 3 fois via ExitPlanMode.

---

## Session 21 (clôture) &mdash; 13/05/2026 &mdash; Phase 3.2 (ordres conditionnels) + Phase 3.2-bis (clarté UX engagement + refonte sidebar + routed effectif-based)

**Phase 3.2 livrée et déployée** : ordres conditionnels (charge/fire/retreat/hold sur triggers on_attacked / enemy_in_range / cohesion_broken / enemy_los), max 3 par unité, résolus serveur en début de tour entrant via `resolve_turn §10.5`. RLS owner-only sur `unit_orders` (privacy). EFs prod : `submit_orders` v2, `resolve_turn` v9+, `resolve_action` v16+.

**Phase 3.2-bis livrée** (gros sprint UX + balance suite test humain) : refonte profonde UX sidebar, décorrélation `routed` du moral → basé sur effectif (<20%), réduction dégâts engagement côté dominant, animation barres PV, icônes d'ordres au-dessus des pions, etc.

### Phase 3.2 — Vagues A→D livrées

- **Vague A engine** : module `src/engine/orders/` (types, triggers, actions, evaluate). 20 tests Vitest (293 → 313). Port Deno miroir complet.
- **Vague B backend** : migration `019_unit_orders.sql` + `020_action_type_order_triggered.sql`. EF `submit_orders` (CRUD batch + validation + swap priorités). `resolve_turn §10.5` `_evaluateOrders.ts` : snapshot-then-resolve post-tick post-morale, applique retreat/charge/fire/hold, log `game_actions(order_triggered)`.
- **Vague C UI** : hook `usePreOrders` (CRUD via EF), composant `OrdersPanel` (au-dessus de UnitInspector), wiring `Game.tsx` + `BattleSidebar` v1.8, toast ordres adverses déclenchés dans `useCombatActions.endTurn` v2.3.
- **Vague D test humain** : crash EF résolu (cf. ci-dessous), puis test concluant.

### Bug critique session 21 — EF resolve_turn v7 crashait au boot Deno

**Symptôme** : "Failed to send a request to the Edge Function" côté client. AUCUN log côté EF. Le client `supabase-js` reçoit un network error avant même que la fn ne loggue.

**Diagnostic** : `_evaluateOrders.ts` et `vision/visibility.ts` (port Deno) importaient `spiral` depuis `engine-port/hex/index.ts`, mais le port Deno de `hex/neighbors.ts` ne contenait que `HEX_DIRECTIONS` + `neighbors` (pas `spiral`/`ring`/`neighbor`). ImportError au boot → fonction down sans trace.

**Fix** : port complet de `neighbor` + `ring` + `spiral` dans `supabase/functions/_shared/engine-port/hex/neighbors.ts` v1.1 + export dans index v1.2. Redéploy `resolve_turn` v8 + `submit_orders` v2.

**Piège à ajouter §12** : les imports manquants au port Deno crashent silencieusement (pas de log EF). Toujours vérifier que chaque import nommé depuis `engine-port/` est exporté côté Deno avant déploiement.

### Phase 3.2-bis — Clarté UX engagement (feedback user "pertes inexpliquées")

**Décision** : rendre lisible le tick d'engagement persistant (Phase 2.6). User : "j'attaque, je fais fin de tour, je perds des hommes sans explication".

- **`EngagementTickEvent[]`** ajouté à `EndTurnResult` (server `resolve_turn` v1.5). Pour chaque paire engagée résolue : engagement_id, started_turn, side_a/b (unit_id, kind, team, killed, wounded_add, dissolved).
- **Client `useCombatActions.endTurn`** v2.4 : retourne `engagementTicks` dans la réponse. Callback `onEndTurnSuccess` dans `useGameLifecycle` v1.1 → Game.tsx push toasts + DamageFloaters.
- **Toasts** "Combat continu (T+N) — Ton Infanterie : −80 · Cavalerie adverse : −50" (relativisé `myTeam`).
- **DamageFloaters réutilisés** sur tick (queue séparée `tickFloaters` dans Game.tsx, concat avec `damageFloaters` standard, removal multi-source).
- **EngagementOverlay v1.1** : badge `⚔ T+N` au-dessus du milieu de la ligne (visible direct sur la map). `useEngagementDerivations` v1.2 injecte `turnsActive`.
- **UnitHealthBar v2.1** : lerp imperatif 600ms easeOutCubic (zéro re-render React, `useFrame` + `mesh.scale.x`). Snap au premier mount.

### Phase 3.2-bis — Refonte règle routed (effectif-based, pas moral-based)

**Décision** : feedback user "je suis routed à 286/800 (36%), je peux plus rien faire, c'est trop restrictif". Décorréler routed du moral.

- **`ROUT_EFFECTIVE_RATIO = 0.20`** + helper `computeRouted(effective, effectiveMax)` dans `engine/morale/morale.ts` v1.2 + port Deno v1.2.
- **`applyMoraleDelta`** ne dérive plus `routed` du moral. Routed = effectif < 20% effectiveMax.
- **`isRouted(unit)`** miroir.
- **Sites de recompute** : `sizing.ts` (merge), `engagement/index.ts` (breakCombat), `engagement/tick.ts` (`routedAfter` recomputé depuis effectiveAfter post-tick), `combat/v2/contact.ts` (defender/attacker post-damage). Idem côté port Deno.
- **Server handlers** : `handleRetreat` / `handleSurrender` / `handleSuicide` acceptent désormais `unit.routed === true` OR `cohesion broken` (avant uniquement broken). Erreur message mise à jour.
- **Tests** : `morale.test.ts` réécrit (1 test ajouté, 2 mis à jour). 314/314 verts.

### Phase 3.2-bis — Garde-fous vision pour unités routed

- **Bug 1** : unité routed seule = vision globale = 0 → tout `hidden`. Fix `useVisionMap` v1.2 : ennemi engagé en mêlée avec une de mes unités est toujours `'identified'` (force depuis `engagementRows`), même si mon obs est routed. On voit forcément qui nous frappe.
- **Bug 2** : reachableMap filtré par `visibleTileKeys` → routed = 0 hex visible → impossible de bouger. Fix v1.3 : on inclut `spiral(myUnit.position, movement)` dans `visibleTileKeys` pour chaque allié → l'unité peut toujours voir où elle peut marcher.
- **Auto-retreatMode** : Game.tsx déclenche `setRetreatMode(true)` automatiquement quand selectedUnit est routed + !engaged + !hasMoved + canRetreat. L'utilisateur voit immédiatement les cases adjacentes au lieu de cliquer "Retraite" manuellement.

### Phase 3.2-bis — Réduction dégâts engagement côté dominant (B)

**Décision** : feedback user "j'avais presque gagné le combat et la fin de tour m'a exterminé".

- **`engagement/tick.ts` v1.1** : `computeAttritionDamage` expose `damageNoFloor` (= power − resistance avant plancher).
- **`resolveEngagementTick`** : calcule `dominanceA = (aToB.damageNoFloor + 1) / (bToA.damageNoFloor + 1)`. Multiplicateur dégâts subis = `clamp(1/dominance, 0.25, 1)`. Côté gagnant prend jusqu'à 75% de pertes en moins.
- **`DOMINANCE_DAMAGE_FLOOR = 0.25`** exposé dans `engagement/types.ts`.
- **`ENGAGEMENT_MORALE_DELTA_PER_TURN`** abaissé de −2 → −1 (fatigue moral plus douce).
- Mirror complet côté port Deno. Redeploy `resolve_turn` v9+ et `resolve_action` v16+.

### Phase 3.2-bis — Refonte sidebar (FoW strict + lisibilité)

Feedback user : sidebar "trop chargée, je ne dois pas voir l'adversaire".

- **Cartouche du haut** :
  - "TOUR N" + voyant lumineux 10px (couleur active team, glow intense si mon tour, discret sinon). PLUS de texte "À toi de jouer / Tour adverse".
  - Nom du joueur actif **fixé sur MON camp** (jamais l'adversaire) — couleur team.
  - **Ligne par pion** : `[I.1] ⚔⬢ [progress bar PV] [200/400]`. Click → recentrage caméra (réutilise `handleFocusUnit`). Plus de total cumulé par kind, plus de "Bleus 1900 / Rouges 1900".
  - Helper unique `computeOrdinalLabels(units)` dans `src/engine/units/labels.ts` (`${kind}.${N}` par team+kind) → utilisé par `unitRowsToInstances` ET `BattleSidebar` (cohérence sidebar ↔ map).
- **ParticipantsPanel** (nouveau composant) : volet collapsible en bas, 1 ligne/joueur, point vert lumineux = hôte, ton nom surligné ambre + "(toi)". Remplace les 2 gros `TeamPanel`.
- **GameTopBar v1.2** : nom officier coloré dans la team color.
- **`UnitInspector`** : supprimé section textuelle "Ordres disponibles" (remplacée par icônes). Supprimé coords debug `q=,r=`. Ajouté bandeau "En déroute" contextuel.
- **Icônes ordres** ⚔/⬢ rendues :
  - **En 3D au-dessus du pion** (UnitPlaceholder v2.8) : de part et d'autre du label (`⚔ A.1 ⬢`), pas en-dessous (conflit barre PV).
  - **En HTML dans la sidebar** : inline entre label ordinal et progress bar.
  - **Logique colorimétrique partagée** (helper `resolveAttackIconColor` / `resolveMoveIconColor`) : vert dispo, orange (engagé OR routed = mouvement limité), rouge consommé.

### Phase 3.2-bis — UnitStatusRing v1.1 (déroute visuelle distincte)

`routed` (effectif < 20%) → anneau orange clignotement lent (~1.6 Hz). `cohesion broken` → orange foncé clignotement rapide (~4.2 Hz, conservé). Conflit résolu via priorité broken > routed > pertes brutes.

### Déploiements EF prod (session 21)

| EF | Avant | Après | Raison |
|---|---|---|---|
| `submit_orders` | — | v2 | Création + fix import spiral + redeploy |
| `resolve_turn` | v6 | v9+ | Crash boot v7 → fix v8 → engagement_ticks v9 → dominance + routed effectif-based v10 |
| `resolve_action` | v15 | v16+ | Handlers retreat/suicide/surrender acceptent routed |

### Stats fin session

- **314/314 tests Vitest verts** (+1 vs session 20 : ROUT_EFFECTIVE_RATIO + computeRouted + moral.test.ts refondu).
- `tsc` 0 erreur.
- Migrations BDD : 019 + 020 appliquées sur `history wars` (prod).
- Game.tsx : ~640 lignes (un peu au-dessus de 600 — extraction supplémentaire à faire en QW session 22).

### Decisions backlog session 21

- **Stabilisation ordinal labels** (`I.1` se décale quand un pion meurt) : à persister via `units.ordinal_index INTEGER` BDD si demande utilisateur claire. Pas urgent.
- **Jauge d'endurance dédiée** : prévue Phase 5 (formations, fatigue, ravitaillement, Infirmier, météo). Aujourd'hui simulée via `ENGAGEMENT_MORALE_DELTA_PER_TURN=-1`.
- **Test humain Phase 3.2** : pré-postures non encore testées en partie réelle (combat clarity prioritisé).

### Prochaine étape — Session 22

- **Test humain Phase 3.2 ordres conditionnels** (5 scénarios) : enemy_in_range+fire, on_attacked+retreat, cohesion_broken+hold, garde-fou 4ᵉ ordre, privacy RLS.
- Possible **Phase 3.3** : balance combat + polish fin Phase 3.
- Backlog : stabilisation ordinal labels, animation combat 3D (au-delà du damage floater), recompute one-shot routed pour parties existantes (SQL).

---

## Session 20 (clôture) &mdash; 13/05/2026 &mdash; Phase 3.1 livrée (fog évolué + détection range) + QW1 refacto Game.tsx + QW2 inspection ennemi

**Phase 3.1 clôturée.** Fog of war client-side avec range vision par UnitKind, LoS team-agnostic (piège #15), 3 niveaux d'identification (`hidden`/`spotted`/`identified`). 12 nouveaux tests engine + 4 tests UI helper. Tag `phase-3-1-complete` posé. Pas de migration BDD (server-side reporté Phase 4).

### Pré-Phase 3.1 — Quick wins
- **QW1 (refacto Game.tsx 740 → 562 lignes)** : extraction `useGameLifecycle`, `useCombatToastFeed`, `useEnemyHoverTooltip`, `useUnitPathAnimation`, `useEngagementDerivations` + composants `BattleHeader`, `BattleSidebarFooter` + helpers `gameLabels`.
- **QW2 (inspection ennemi)** : clic sur unité ennemie → `EnemyUnitPanel` read-only avec kind, **catégorie effectif** (`<100/100-300/300-600/600+` → pas de chiffre exact), label cohésion, engagements. État `inspectedEnemyId` ajouté en queue dans `useTacticalSelection`. Prop `visibilityLevel='spotted'` prévoit l'affichage dégradé "Identification incomplète" (utilisé en Phase 3.1-B silhouettes).

### Phase 3.1 — 4 vagues livrées
- **Vague A (engine pur)** : `UNIT_STATS_V2.vision` ajouté (I=3, C=5, A=4 — calibrage humain Vague D). Nouveau module `src/engine/vision/visibility.ts` (zéro React/Three/Supabase) : `visibleHexesFromUnit`, `visibleHexesFromTeam`, `visibleEnemiesFromTeam`. 12 tests Vitest verts (LoS bloquée par allié, observateur routed exclu, meilleur niveau gagne, etc.).
- **Vague B (render)** : `HexGrid.tileVisibility` prop, `UnitPlaceholder.silhouette` prop (opacity 0.35, label `?`, anneaux + healthbar masqués). `TacticalScene` filtre les ennemis `hidden` et passe `silhouette={true}` aux `spotted`.
- **Vague C (intégration)** : nouveau hook `useVisionMap` (orchestre `visibleTileMap` + `enemyVisibility` + `visibleEnemyIds`). Branché AVANT `useTacticalSelection` (filtre `reachableMap` + `targetableUnitIds`). `visibleEnemyIds` déplacé d'`useTacticalSelection` vers `useVisionMap` (single source of truth).
- **Vague D (test humain)** : OK après 2 fixes visuels identifiés par user.

### Bugs visuels détectés à Vague D et corrigés
- **Bug 1 — hex sous unité noir** : `useVisionMap` construisait les clés en `"q,r,s"` alors que `cubeKey()` retourne `"q,r"` → les positions alliées/ennemies n'étaient JAMAIS réinjectées dans `visibleTileMap` (lookup `boardKeys.has(k)` échouait silencieusement). Fix `27f90cb`.
- **Bug 2 — texture sable/dirt sur hex hidden** : `return null` sur `visibility='hidden'` laissait transparaître le `<PageBackground />` (peinture Austerlitz) → certains hex masqués apparaissaient texturés. Fix `3307588` : rendu d'un mesh noir opaque (`meshBasicMaterial`, sans event handlers).

### Commits livrés (4 sur `main`)

| # | Sujet | Catégorie |
|---|---|---|
| ca9714c | feat: Phase 3.1 fog of war + QW1/QW2 (session 20) | feat |
| dd96abe | docs(backlog): boucle opérationnelle campagne (Phase 8) — feedback user | docs |
| 27f90cb | fix(vision): hex sous les unités noir — mismatch format cubeKey | fix |
| 3307588 | fix(render): hex hidden rendus en noir opaque (masque PageBackground) | fix |

### Stats fin session

- 293/293 tests verts (+16 vs session 19 : 12 vision + 4 effectiveCategory).
- `tsc` 0 erreur.
- `vite build` PWA OK.
- Game.tsx : 562 lignes (< 600).

### Pas de déploiement Supabase

Phase 3.1 est 100% client. Pas de migration, pas d'EF redéployée. Fog server-side prévu Phase 4 (RLS units).

### Decisions backlog session 20

- **Boucle opérationnelle campagne (Phase 8)** : `docs/backlogs/BACKLOG-trois-echelles.md § 13` ajouté suite feedback user 12/05 — objectifs cliquables sur map, marche auto multi-jours, cycle jour/nuit, bascule auto vers tactique. Mémoire projet sauvegardée (`vision_operational_campaign.md`).

### Prochaine étape — Session 21

**Phase 3.2** : pré-postures / ordres conditionnels. Spec à produire (PLAN-MASTER ne détaille pas encore le sous-bloc).
- Probable : nouvelle table `unit_pre_orders` + EF `submit_orders` + hook `usePreOrderEngine` + UI panel "Ordres conditionnels" dans `UnitInspector`.
- Concept gameplay : "tiens position SAUF SI attaqué", "charge SI ennemi à portée 3", "replie SI cohésion brisée", etc. Résolution simultanée en début de tour avant les actions joueur manuelles.

---

## Session 19 (clôture) &mdash; 12/05/2026 &mdash; Phase 2.6 Vague D testée + clôture Phase 2 complète + nombreux fixes UX/gameplay

**Phase 2 (Phase 2 + 2.5 + 2.6) clôturée**. Vague D testée par l'utilisateur (5 scénarios validés). Sprint UX initial du plan accompli, puis nombreux écarts demandés en cours de route (refonte journal combats, garde-fous Brisée, repli forcé Rompre, fusion à distance, bonus moral fusion, mesh cavalerie dédié, MVP tweak board/stats).

### Commits livrés (18 sur `main`)

| # | Sujet | Catégorie |
|---|---|---|
| 1976df4 | MVP tweak : board radius 7 + 4v4 colonnes + C move 4 + A range 6 + anim per kind | gameplay |
| 929783f | Sprint UX (plan §1) : auto-select panel + effectif AVANT + tailles texte 11-13px | UX |
| 545b181 | Fix FoW : effectif AVANT visible côté joueur seulement | UX FoW |
| 937c6ab | Journal combats replié + toast bref + bouton TopBar | UX |
| 65d54b8 | Refonte panel : liste scrollable verticale sous le bouton (plus d'onglets) | UX |
| ecabebb | Fix position : `fixed top-[68px]` sous le bouton Rapports | UX |
| 40b3f30 | Cohésion : garde-fou anti-broken (effective ≥ 1.5 × min) + override attaque vs ennemi plus petit | gameplay |
| eaaa212 | Rompre conserve le mouvement (peut se replier ce tour) | gameplay |
| 8e16730 | Rompre : repli forcé (destination doit s'éloigner de tous les ex-engagés) | gameplay |
| 2bc6e07 | UX manœuvres : scinder ratio direct + fusion par clic map (move+merge auto si distant) | UX/gameplay |
| dbdaa74 | Fusion : bonus moral +25 + recalcul routed (sort de la déroute) | gameplay |
| e5964be | Fusion : effectiveMin ne cumule plus (= standard du type) | gameplay |
| 5bd4d33 | CavalryMesh dédié (cavalier.glb 38 MB) | render |
| 29f0e64 | cavalier.glb optimisé 41.5 → 2.9 MB (gltf-transform simplify+meshopt+webp) | assets |
| 19b79a1 | Cavalry scale 2.0 → 2.8 (silhouette domine légèrement) | render |
| c243597 | Cavalry Y offset auto (sabots sur le sol, compense scale > 2) | render |
| 5a20af0 | Label kind suit la hauteur réelle du mesh (C remonté) | render |
| 493bf3a | Backlog : menu perso assets (import GLB + icônes user) → Phase 13 | docs |

### Déploiements EFs prod (12/05/2026)

- `start_battle` v3 (board radius 7, 8 placements en colonnes)
- `resolve_action` v10+ (mirror sizing + cohésion + engagement à jour)
- `resolve_turn` v5 (mirror cohésion + engagement à jour)

### Vague D — Test humain validé (utilisateur)

L'utilisateur a confirmé avoir testé les 5 scénarios `docs/PLAN-ENGAGEMENT-PERSISTENT.md` § 9 D. Aucune anomalie nouvelle signalée à l'issue des tests. Les ajustements demandés en cours de session (garde-fou Brisée, override attaque, repli forcé, bonus moral fusion) sont l'aboutissement de ces tests humains.

### Bugs/observations restants

| # | Bug | Statut |
|---|---|---|
| 1 | phantom_loss 400 hommes (vu 1× partie 1 session 18) | ⚪ Non reproduit, à surveiller |
| 2 | Cav menu "Rester / Replier" après impact (PLAN-ENGAGEMENT-PERSISTENT § 4) | ⚪ Reporté |
| 3 | CombatResultPanel type 'attrition' (tick engagement) | ⚪ Skip MVP |
| 4 | `effectiveMin` figé en BDD sur les pions déjà fusionnés avant le fix e5964be | ⚪ Acceptable, n'affecte que les parties existantes |

### Prochaine étape — Session 20

**Phase 3** : moteur de tour (brouillard évolué, détection, pré-postures). Voir `PLAN-MASTER-V2.md`.

Avant d'attaquer Phase 3, candidats prioritaires côté backlog (ordre suggéré) :
1. **[ux]** Inspection unité ennemie en cliquant (lecture seule de leurs stats publiques)
2. **[balance]** Pondération `baseAttritionRate` (0.08) à revoir selon retour humain élargi
3. **[refacto]** Sortir `handleTileClick` vers `useTacticalSelection` (Game.tsx repasse < 600 lignes)
4. **[asset]** Compresser `soldier.glb` 5 MB → < 500 KB (pipeline gltf-transform identique cavalier)

### Tag git

`phase-2-complete` posé sur le commit de clôture docs session 19 (englobe Phase 2 + 2.5 + 2.6).

---

## Session 18 (clôture) &mdash; 11/05/2026 &mdash; Phase 2.6 complète A+B+C livrée + 1 fix CHECK constraint + Vague D + sprint UX à faire session 19

**Phase 2.6 livrée code + prod (Vagues A, B, C)**. Reste session 19 : sprint UX rapide ~1h (bug auto-select + tailles texte + effectif avant) puis test humain Vague D.

### PRs livrées dans cette session (3)

| # | Sujet | État |
|---|---|---|
| [#43](https://github.com/alsace-van/history-wars/pull/43) | **Vague A engine** : `engine/engagement/{types,tick,index}.ts` + 32 tests Vitest | ✅ mergée |
| [#44](https://github.com/alsace-van/history-wars/pull/44) | **Vague B BDD + EF Deno** : migration 017, engine-port Deno, `handleEngage` + `handleBreakCombat`, `handleAttack` v1.2, `resolve_action` dispatcher v2.2, `resolve_turn` v1.3 tick | ✅ mergée |
| [#45](https://github.com/alsace-van/history-wars/pull/45) | **Vague C UI** : `useEngagement` hook + `UnitInspector` v2.4 section Engagé + bouton Rompre + `EngagementOverlay` 3D ligne rouge pulsante + bloque mouvement engagé. Inclut migration 018 fix CHECK constraint | 🟡 ouverte (à merger) |

### Déploiements prod (11/05/2026 PM/Soir)

- **Migrations BDD** :
  - 017 `engagements` (table + RLS + Realtime + CHECK pair_order + UNIQUE) — appliquée ✅
  - **018 `fix_game_actions_action_type_check`** — découvert pendant test humain Vague B : la CHECK constraint migration 007 n'autorisait que `move/attack_ranged/attack_melee/end_turn/start_battle`. Bloquait silencieusement **6 action_types** (split_unit, merge_unit, retreat, surrender, suicide_attack, break_combat) → INSERT game_actions échouait, snapshot D13 perdu. Migration 018 ajoute les 11 valides. Appliquée ✅
- **Edge Functions** :
  - `resolve_action` v8 → **v9** (handleEngage, handleBreakCombat, handleAttack v1.2, dispatcher v2.2)
  - `resolve_turn` v3 → **v4** (tick engagements séquentiel avant récup moral)
- **Advisors** : 0 nouveau warning. 4 pré-existants restent (3× SECURITY DEFINER `is_*` + Auth leaked password).

### Tests Vague B humain (réussis avec réserves)

Partie 20:21-20:25 : tous les action_types fonctionnent post-fix 018. Comptabilité killed+wounded vs effective_loss cohérente (phantom_loss = 0). Engagements créés en mêlée, cascadés en DELETE quand unités tuées (CASCADE FK normal). Pertes 037f8b5b = 172 hommes sur 4 tours (~50-70 direct + ~100 tick engagement sur 3 ticks).

**Bug observé partie 1 (résolu)** : unité `948d74cc` avait phantom_loss=400 hommes (killed+wounded=81 vs effective_loss=481). N'a pas reproduit en partie 2. À investiguer post-Vague D si récurrent.

### Feedback UX critique (à traiter session 19)

User a signalé après Vague C UI (mémoire `~/.claude/projects/.../memory/ux_tactica_lisibilite.md`) :

1. **Bug auto-select CombatResultPanel** : reste sur le 1er combat au lieu de basculer auto sur le dernier. Cause : useEffect ne change `activeId` que si l'ancien n'est plus dans la liste — quand une nouvelle notif arrive, l'ancienne reste valide et le panel ne switch pas. Fix : `useRef` qui track `notifications.length` et force setActiveId quand augmente. **~5 min**
2. **Manque effectif de départ dans rapport** : afficher effectif AVANT en plus de APRÈS (les 2 valeurs sont déjà dans le snapshot). **~15 min**
3. **Textes trop petits** : 9-10px sur Inspector + CombatResultPanel + Sidebar → passer à 12-14px sur les sections clés. **~45 min**
4. **Esthétique globale** : panneaux trop denses, manque hiérarchie visuelle, espacement insuffisant. **~2-4h refonte**

Plan session 19 : option (a) sprint UX rapide ~1h (points 1+2+3) **avant** test Vague D. Point 4 sprint dédié si toujours frustrant après.

### Prochaine étape (session 19)

**Étape 1 — Sprint UX rapide (~1h)** :
1. Fix bug auto-select CombatResultPanel (`useRef` + `notifications.length`)
2. Ajout effectif AVANT dans rapport combat (déjà dispo via `combat.attackerEffectiveBefore`/`defenderEffectiveBefore`)
3. Agrandir tailles texte 9-10px → 12-14px dans Inspector + CombatResultPanel + BattleSidebar

**Étape 2 — Merger PR #45 + Vague D test humain (~0.5j)** : 5 scénarios `docs/PLAN-ENGAGEMENT-PERSISTENT.md` § 9 D :
1. Combat 800 vs 400 plaine → durée 12-15 tours
2. Encerclement 1 vs 3 → Brisé en 7-10 tours
3. Charge cav réussite → poursuite
4. Charge cav qui tient → menu Rester/Replier (pas implémenté Vague C, reporté)
5. Rompre coûteux → 700/800 → 630

**Étape 3 — Clôture Phase 2 complète** : tag git `phase-2-complete` (englobe Phase 2 + 2.5 + 2.6).

### Bugs/observations ouverts

| # | Bug | Statut |
|---|---|---|
| 1 | CHECK constraint game_actions.action_type bloquait Phase 2.5+2.6 silencieusement | ✅ Fix migration 018 |
| 2 | CombatResultPanel reste sur 1er combat au lieu du dernier | 🔴 Session 19 |
| 3 | Manque effectif de départ dans rapports combat | 🟡 Session 19 |
| 4 | Textes trop petits (9-10px) sur Inspector + CombatResultPanel | 🟡 Session 19 |
| 5 | Esthétique générale jugée pas jolie | 🟡 Sprint UX dédié post-Vague D |
| 6 | phantom_loss 400 hommes (non reproduit en partie 2) | ⚪ À investiguer si récurrent |
| 7 | Cav menu "Rester / Replier" après impact (plan § 4) | ⚪ Reporté post-Vague D |
| 8 | CombatResultPanel type 'attrition' (tick engagement) | ⚪ Skip MVP, à ajouter si besoin |

### Fichiers clés Phase 2.6 (cumulatif Vagues A+B+C)

**Engine + port Deno miroir** : `src/engine/engagement/{types,tick,index}.ts` + `supabase/functions/_shared/engine-port/engagement/{types,tick,index}.ts`

**EF Deno** : `handleEngage.ts` + `handleBreakCombat.ts` + `handleAttack.ts` v1.2 + `resolve_action/index.ts` v2.2 + `resolve_turn/index.ts` v1.3 + `_shared/types.ts` v2.2

**Hooks** : `useEngagement.ts` v1.0 + `useCombatActions.ts` v2.2 + `useTacticalSelection.ts` v1.6

**UI** : `UnitInspector.tsx` v2.4 + `BattleSidebar.tsx` v1.4 + `Game.tsx` v3.21

**Render** : `EngagementOverlay.tsx` v1.0 + `TacticalScene.tsx` v1.8

**Migrations** : 017 (engagements) + 018 (fix CHECK action_type)

### Tests cumulés

- `npx vitest run` : **272/272 verts** (240 baseline + 32 Vague A)
- `npx tsc --noEmit` : 0 erreur
- `npm run build` : PWA OK
- Game.tsx 655 lignes, UnitInspector 616 lignes (≥600 soft limit, à nettoyer si dépasse 700)

---

## Session 18 (mid) &mdash; 11/05/2026 &mdash; Phase 2.6 Vague B BDD + EF Deno (migration 017 + 3 handlers + resolve_turn tick)

**Vague B livrée côté code** — migration 017 + EF Deno. Pas encore appliqué en prod (attente confirmation user).

### Fichiers livrés

| Fichier | Contenu |
|---|---|
| `supabase/migrations/017_engagements.sql` (NEW) | Table `engagements (id, game_id, unit_a_id, unit_b_id, started_turn, created_at)` + RLS membre + Realtime + REPLICA IDENTITY FULL + CHECK pair_order (uuid_a < uuid_b) + UNIQUE(game_id, unit_a_id, unit_b_id) |
| `supabase/functions/_shared/engine-port/engagement/{types,tick,index}.ts` (NEW) | Miroir 1:1 de `src/engine/engagement/*` côté Deno + helper `normalizePair(a, b)` |
| `supabase/functions/_shared/types.ts` v2.2 | `ActionType += 'break_combat'`, `BreakCombatPayload`, `BreakCombatResultSnapshot`, `EngagementSnapshot`, `ERROR_CODES.NOT_ENGAGED` |
| `supabase/functions/resolve_action/_handlers/handleEngage.ts` (NEW) | `createEngagementAfterMelee()` : INSERT idempotent (upsert sur UNIQUE), retourne snapshot ou null |
| `supabase/functions/resolve_action/_handlers/handleAttack.ts` v1.2 | Appelle `createEngagementAfterMelee` après mêlée non-mortelle (phase='melee' && !defenderKilled && !attackerKilled) |
| `supabase/functions/resolve_action/_handlers/handleBreakCombat.ts` (NEW) | Action `break_combat` : vérifie engagement actif, applique 10% pertes via `breakCombat` engine-port, DELETE tous engagements de l'unité (multi), INSERT game_actions D13 |
| `supabase/functions/resolve_action/index.ts` v2.2 | Route `break_combat` → handleBreakCombat |
| `supabase/functions/resolve_turn/index.ts` v1.3 | **Tick engagements actifs** avant récup moral : charge engagements + terrain + combat_config en // ; pour chaque engagement séquentiellement applique tick (cumul effective réduit) ; UPDATE unités ; DELETE engagements dissolus ; END-condition basée sur snapshot post-tick |

### Décisions implémentation Vague B

- **Engagement créé implicitement** : attack_melee → INSERT automatique (idempotent via UNIQUE). Pas d'action `engage` séparée — le bouton UI restera "Engager / Attaquer en mêlée" (cf. plan § 1.2).
- **Normalisation paire** : la contrainte CHECK migration 017 impose `unit_a_id < unit_b_id` lexicographique. `normalizePair()` côté Deno garantit ça avant tout INSERT. Évite duplication (A,B) vs (B,A) sur ré-attaque.
- **ON DELETE CASCADE** : une unité supprimée (dissolution) supprime auto ses engagements via FK. Idempotent côté code.
- **Multi-engagement** : `handleBreakCombat` DELETE **tous** les engagements impliquant l'unité (rupture totale). Coût 10% appliqué une seule fois (cf. plan question ouverte § 12 — décidé "single charge" pour MVP, calibrage Vague D).
- **Tick séquentiel vs cumul** : pour MVP, `resolve_turn` applique les ticks engagement par engagement (snapshot mémoire mis à jour entre chaque). Chaque tick voit l'unité avec effective réduit par les précédents → l'absorbtion 10% se renouvelle à chaque tick. Diffère de la spec § 6 stricte (cumul absorbtion une seule fois), mais comportement pratique raisonnable. À calibrer Vague D.
- **REPLICA IDENTITY FULL** : posé sur engagements (cf. piège migration 010 sur units) — Realtime propage les DELETE avec payload complet aux clients pour cleanup local.
- **Realtime publication** : engagements ajouté à `supabase_realtime` — les clients verront apparaître/disparaître les engagements en temps réel sans poll.

### Tests

- `npx vitest run` → **272/272 verts** (pas de régression côté client, Vague B ne modifie que Deno/SQL).
- `npx tsc --noEmit` → 0 erreur.
- Deno pas installé localement (`deno check` impossible) — port est un miroir 1:1 de `src/engine/engagement/*` déjà testé (32 tests Vague A).

### Déploiement prod (à confirmer user)

1. `mcp_supabase__apply_migration` migration 017 (idempotente — pas de risque)
2. `Supabase:get_advisors` → 0 nouveau warning critique
3. Redeploy EF : `resolve_action` v2.2 + `resolve_turn` v1.3 + (handleAttack v1.2 inclus)
4. Vérification : INSERT manuel d'un engagement test via SQL → SELECT depuis le client (RLS check)

### Vagues restantes Phase 2.6

- **Vague C** (~1j) UI/Render :
  - `useEngagement` hook Realtime sur table engagements
  - `UnitInspector` v2.4 : section "Engagé en mêlée avec : Inf Rouges (T3)" + bouton "Rompre le combat"
  - `useTacticalSelection` v1.6 : bloque mouvement standard si engagé
  - `EngagementOverlay` 3D : ligne rouge entre 2 pions + anneau pulsant
  - `CombatResultPanel` v3.2 : type 'attrition' affiché en plus de melee/ranged/charge

- **Vague D** (~0.5j) Test humain :
  - Scénario 1 : Combat 800 vs 400 plaine → durée 12-15 tours
  - Scénario 2 : Encerclement 1 vs 3 → brisé en 7-10 tours
  - Scénario 3 : Charge cav réussite → poursuite
  - Scénario 4 : Charge cav qui tient → menu Rester/Replier (cf plan § 4 — pas implémenté Vague B, reporté Vague C+)
  - Scénario 5 : Rompre coûteux → 700/800 → 630

### Ouvert sans réponse (à valider Vague D)

- Tick séquentiel vs cumul absorbtion (plan § 6) — pratique séquentiel pour MVP
- Cav choix Rester/Replier après impact (plan § 4) — pas dans cette vague, à ajouter en C+ avec UI menu
- Variance attrition ±5% vs ±15% — choix calibrage humain
- Multi-engagement rupture : coût plafond ? — option A simple "coût unique 10%" appliquée pour MVP

---

## Session 18 (début) &mdash; 11/05/2026 &mdash; Phase 2.6 Vague A engine engagement persistant (4 fichiers, 32 tests, 272 verts)

**Vague A engine livrée** côté client. Pas de migration ni d'EF pour cette vague (Vague B). Pas de UI (Vague C).

### Fichiers livrés

| Fichier | Contenu | Lignes |
|---|---|---|
| `src/engine/engagement/types.ts` (NEW) | `EngagementState`, `EngagementSideResult`, `EngagementTickInput/Result`, `BreakCombatResult`, constantes (`RESERVE_RELIEF_RATE=0.1`, `BREAK_COMBAT_COST_RATIO=0.1`, `ENGAGEMENT_VARIANCE_LOW/RANGE=0.95/0.10`, `ENGAGEMENT_MORALE_DELTA_PER_TURN=-2`) | 141 |
| `src/engine/engagement/tick.ts` (NEW) | `resolveEngagementTick(input)` : dégâts bilatéraux symétriques + relève 10% (absorbtion `menEngaged + reserve × 0.1`) + variance ±5% + delta moral fatigue -2 + check dissolution mutuelle | 184 |
| `src/engine/engagement/index.ts` (NEW) | Barrel + `startEngagement(unitA, unitB, turn, gameId)` (factory validée), `breakCombat(unit)` (10% effective, plancher 1, plafond `effectiveMin`, consomme `hasMoved/hasAttacked`), `isEngagedWith(unitId, engagements)` (multi), `getEngagementOpponent` | 134 |
| `src/engine/engagement/engagement.test.ts` (NEW) | 32 tests Vitest (tick, factory, breakCombat, lookup, constantes plan figé) | 309 |

### Pattern miroir Phase 2.5 cohesion/

- Frontière engine/ stricte : zéro Three/Supabase/React
- Réutilise `splitCasualties` (combat/types), `resolveUnitStatsV2` (units/stats), `getMatchupCoef` (combat/v2/matchup), `TERRAIN_CAPS` (terrain/caps), `applyMoraleDelta` + `moraleCombatBonus` + `moraleCombatLossMultiplier` (morale/morale)
- Pas de cycle : engagement → combat/v2 → cohesion → hex/units (sans retour)
- Variance combat continu ±5% (vs ±15% Phase 2) cohérent plan § 2

### Décisions implémentation

- **Symétrie d'un tick** : dégâts calculés sur snapshot d'avant tick, A et B frappent simultanément (pas de séquentialité). 2 rolls RNG consommés (aToB puis bToA).
- **Absorbtion réserves** : `adjustedDamage = min(damageRaw, menEngaged + round(reserve × 0.1))`. Plafonne les pertes max/tour à menEngaged + 10% réserve.
- **breakCombat** : ne descend jamais sous `effectiveMin` (sinon rompre serait suicide), plancher 1 perte si `effective > 0`.
- **Multi-engagement** : `isEngagedWith` retourne tous les engagements d'une unité (filtre sideA ou sideB). Le caller resolve_turn (vague B) appliquera N ticks indépendants par paire.
- **Pas d'`adjacency check`** dans `startEngagement` : c'est le rôle du caller (EF + hook UI) vague B/C.

### Tests (272/272 verts, +32 vs baseline 240)

```
resolveEngagementTick : 12 tests (équilibre, asymétrie, déterminisme, relève, sans réserve,
                       forêt cap, variance bornée, dissolution unilatérale/mutuelle, moral,
                       soutien, rollUsed propagé)
startEngagement       : 4 tests (factory OK, id vide BDD-driven, throw self / same team)
breakCombat           : 7 tests (10% pertes, plancher 1, plafond effectiveMin, hasMoved/hasAttacked,
                       split 60/40, cumul killed, constante)
isEngagedWith         : 3 tests (multi, vide, filtre A/B)
getEngagementOpponent : 3 tests (sideA, sideB, null si absent)
Constantes plan figé  : 3 tests (RESERVE_RELIEF_RATE, BREAK_COMBAT_COST_RATIO, MORALE_DELTA)
```

### Prochaines étapes

**Vague B** (~2j) — BDD + EF Deno :
1. Migration 017 : table `engagements (id, game_id, unit_a_id, unit_b_id, started_turn, created_at)` + RLS membre + Realtime
2. EF `_handlers/handleEngage.ts` (INSERT engagement après attaque mêlée)
3. EF `_handlers/handleBreakCombat.ts` (action `break_combat` → DELETE + 10% pertes)
4. `resolve_turn` v1.3 : tick engagements actifs avant récup moral
5. Engine-port Deno miroir `_shared/engine-port/engagement/*`

**Vague C** (~1j) — UI/Render :
- `useEngagement` hook + `UnitInspector` v2.4 section "Engagé en mêlée" + bouton Rompre
- `useTacticalSelection` v1.6 : bloque mouvement standard si engagé
- `EngagementOverlay` 3D : ligne rouge + anneau pulsant
- `CombatResultPanel` v3.2 : type `'attrition'`

**Vague D** (~0.5j) — 5 scénarios test humain.

### Ouvert sans réponse (plan § 12)

- Multi-engagement rupture : coût cumulé ? plafond 20-30 % ?
- Variance attrition à valider en humain (±5% vs ±15%)
- Tireur engagé qui veut rompre : règles spécifiques ?

---

## Session 17 (fin) &mdash; 11/05/2026 &mdash; Phase 2.5 livrée prod (cohésion + soutien + retreat/surrender/suicide) + design Phase 2.6 + balance cav

**Récap final de la session 17** : la Phase 2.5 (moral-cohésion-soutien) est livrée à 100% côté code + prod. La Phase 2.6 (engagement persistant) a son plan figé pour démarrer en session 18.

### PRs livrées dans cette session (15 PRs)

| # | Sujet | État |
|---|---|---|
| #27 | Hotfix soft-lock routed (coup de grâce) | ✅ mergée |
| #28-#31 | Design plan moral-cohésion (4 itérations Q1-Q4) | ✅ mergées |
| #32 | Alignement master (Phase 2 = ✅ refonte combat, Phase 2.5/2.6 ajoutées) | ✅ mergée |
| #33 | **Vague A engine cohésion** (cohesion/, morale v1.1, contact v1.2, +34 tests) | ✅ mergée |
| #34 | **Vague B EF Deno** (engine-port mirror + handleRetreat/Surrender/Suicide + check broken) | ✅ mergée |
| #35 | **Vague C UI** (UnitInspector panneau critique + modale Ébranlé + useUnitCriticalActions) | ✅ mergée |
| #36 | Fix rapport combat : effectiveAfter (absolu) au lieu de hpAfter (% legacy) | ✅ mergée |
| #37 | Fix refresh manuel après endTurn + actions critiques (UI sync sans Realtime) | ✅ mergée |
| #38 | **Design Phase 2.6 engagement persistant** (PLAN-ENGAGEMENT-PERSISTENT.md) | ✅ mergée |
| #39 | **Vague C.2 anneaux 3D** (UnitStatusRing + UnitSupportRing) | ✅ mergée |
| #40 | Balance : nerf charge C→I 1.5→1.2 + migration 015 | ✅ mergée |
| #41 | Inspector cohésion temps réel + nerf charge C→C 1.1→0.9 + migration 016 | 🟡 ouverte (à merger) |

### Déploiements prod (11/05/2026 PM)

- **Migrations BDD** : 015 (charge C→I 1.2) + 016 (charge C→C 0.9) appliquées via MCP. `combat_config.version` bumped.
- **Edge Functions** : `resolve_action` v7 → v8 (3 nouveaux handlers retreat/surrender/suicide + check cohesionState 'broken'). `resolve_turn` v2 → v3 (recoverMoraleEndTurnV2 modulé par soutien).
- **Advisors** : 0 nouveau warning. Les 4 warnings pré-existants (SECURITY DEFINER `is_*` + Auth leaked password) restent — non bloquants.

### Fichiers clés Phase 2.5

**Engine** (client + Deno port miroir) :
- `src/engine/cohesion/{types,compute,index}.ts` (NEW)
- `src/engine/morale/morale.ts` v1.1 — `recoverMoraleEndTurnV2`, `moraleCombatLossMultiplier`
- `src/engine/combat/v2/contact.ts` v1.2 — `defenderMoraleDelta` modulé par support
- `src/engine/combat/v2/types.ts` — `matchupMatrix.charge.C.I=1.2`, `charge.C.C=0.9`

**EF Deno** :
- `supabase/functions/resolve_action/_handlers/handleRetreat.ts` (NEW)
- `supabase/functions/resolve_action/_handlers/handleSurrender.ts` (NEW)
- `supabase/functions/resolve_action/_handlers/handleSuicide.ts` (NEW)
- `supabase/functions/resolve_action/_handlers/handleAttack.ts` v1.1 (check broken)
- `supabase/functions/resolve_action/_handlers/_common.ts` v1.1 (computeCohesionFor, getCampEffectiveRatio)
- `supabase/functions/resolve_turn/index.ts` v1.2 (récup moral modulée)

**Hooks UI** :
- `src/hooks/useTacticalSelection.ts` v1.5 — `cohesionStateMap`, `supportMap`, `retreatTargetKeys`, `suicideTargetIds`
- `src/hooks/useUnitCriticalActions.ts` (NEW) — `canRetreat`, `canSuicide`, `performXxx`
- `src/hooks/useBattleClickHandlers.ts` (NEW) — extraction handlers Game.tsx
- `src/hooks/useSettings.ts` v1.1 — `skipShakenWarning`
- `src/hooks/useCombatActions.ts` v2.1 — actions retreat/surrender/suicide_attack + codes erreur

**UI** :
- `src/ui/game/UnitInspector.tsx` v2.3 — section État critique Brisé + section Cohésion temps réel
- `src/ui/game/BattleSidebar.tsx` v1.4 — propagation cohésion + support
- `src/ui/game/ShakenAttackConfirm.tsx` (NEW) — modale confirmation Ébranlé
- `src/ui/game/BattleModals.tsx` (NEW) — regroupement EndGameModal + ShakenAttackConfirm
- `src/ui/game/CombatResultPanel.tsx` v3.1 — Soldats restants = effectiveAfter
- `src/ui/pages/Game.tsx` v3.20 — câblage complet (591/600 lignes)

**Render** :
- `src/render/units/UnitStatusRing.tsx` (NEW) — anneau état vert/jaune/orange (+clignotement Brisé)
- `src/render/units/UnitSupportRing.tsx` (NEW) — cercles bleus soutien
- `src/render/units/UnitPlaceholder.tsx` v2.1 — intégration des 2 anneaux
- `src/render/scenes/TacticalScene.tsx` v1.7 — propagation maps

**Migrations** :
- 015 `combat_config_nerf_cav_charge.sql` (UPDATE jsonb_set matchup C→I 1.2)
- 016 `combat_config_nerf_cav_charge_cvc.sql` (UPDATE jsonb_set matchup C→C 0.9)

### Tests

- `npx vitest run` : **240/240 verts** (25 fichiers, +34 vs baseline 206 Phase 2)
- `npx tsc --noEmit` : 0 erreur
- Tous fichiers < 600 lignes (Game.tsx 591, UnitInspector 549)

### À tester côté humain (Vague D — pas fait, session 18)

Scénarios issus de docs/PLAN-MORAL-COHESION.md § 7 :
1. **Reproduction soft-lock Session 16** : I 354/800 moral 22 routée + I 709/800 → vérifier que retreat/surrender/suicide sont dispos, modale Ébranlé sur attaque
2. **Encerclement** : I 800 entourée 3×I 400 → Brisée en 7-10 tours
3. **Ligne stable** : 3 I bleues vs 3 I rouges alignées
4. **Charge cav profonde** : C bleue charge → encerclée → Brisée → Reddition
5. **Reconstitution merge** : I 100/800 Brisée + I 600/800 saine adjacentes → merge → I 700/800 Ébranlée

### Bugs/observations user pendant la session

| # | Bug | Statut |
|---|---|---|
| 1 | "Ce n'est pas ton tour" stale après fin de tour | ✅ Fix #37 (refresh manuel) |
| 2 | Rapport combat "Soldats restants 98" au lieu de 784 (lecture hp legacy) | ✅ Fix #36 |
| 3 | Charge C 180 vs I 800 → 0 mort cav (god mode) | ✅ Fix #40 + migration 015 |
| 4 | Charge C 180 vs C 180 → one-shot dissolution | ✅ Fix #41 + migration 016 |
| 5 | Cohésion remonte mais user ne voit pas (chiffre moral statique) | ✅ Fix #41 (inspector section Cohésion %) |
| 6 | Realtime "channel issue" répété en console | 🟡 Mitigé via refresh manuel #37. Cause racine reportée Phase 3+ (latence Supabase Free tier suspect) |
| 7 | Workbox bruyant en console dev (différence Opera vs Chrome) | ℹ️ Sans impact. Service Worker installé Opera persiste — désinscription via DevTools si gêne |

### Reportés Phase 3+ (backlog)

- **[ux/communication]** Afficher "Hommes engagés au contact: X/Y" dans rapport combat (saturation Thermopyles peu intuitive — feedback user)
- **[balance]** Calibrage `baseAttritionRate` 0.08 à valider (tester 0.06 / 0.10)
- **[dette tech]** Realtime auto-reconnect avec exponential backoff (le `useRealtime` actuel ne reconnecte pas après CHANNEL_ERROR)
- **[ux]** Indicateur visuel "Hors ligne" prominent quand Realtime décroche
- **[ux]** Polling fallback toutes les 10s si canal CLOSED persiste

### Prochaine étape (session 18) — Phase 2.6 engagement persistant

Plan figé dans `docs/PLAN-ENGAGEMENT-PERSISTENT.md` (PR #38 mergée). Découpage :
- **Vague A** Engine (~1.5j) : `engine/engagement/{types,tick,index}.ts` + tests (~15 tests)
- **Vague B** BDD + EF (~2j) : Migration 017 `engagements` table + `handleEngage` + `handleBreakCombat` + `resolve_turn` v1.3 tick attrition
- **Vague C** UI/Render (~1j) : anneau pulsant rouge + ligne 3D + bouton Rompre dans Inspector
- **Vague D** Test humain (~0.5j) : 5 scénarios calibrage

Décisions actées (cf plan) :
- Initiation engagement : **volontaire** (clic) — pas d'auto, permet contournement
- Relève réserves : **10%** par tour
- Rompre le combat : **coût fixe 10% effective**
- Cavalerie : charge ponctuelle inchangée. Après impact : menu Rester (malus def×0.8 + attrition ×1.3) / Replier (gratuit)
- Tir ranged : pas d'engagement auto. Mêlée forcée si attaquant adjacent clique "Engager"

### À faire avant Phase 3 (clôture Phase 2 complète)

1. Merger PR #41 (l'ouvrir et valider)
2. Tests humain Vague D Phase 2.5 sur les 5 scénarios
3. `npm run build` PWA + Lighthouse ≥ 90
4. Tag git **`phase-2-complete`** (englobe Phase 2 + Phase 2.5)

---

## Session 17 (début) &mdash; 11/05/2026 &mdash; Hotfix soft-lock routed (PR #27) + design Phase 2.5 moral-cohésion + alignement master

**Bug remonté par user 11/05/2026** : 2 infanteries adjacentes (rouge 354/800 moral 22 routée + bleue 709/800 saine) sur partie 2 vs 2 joueurs → personne ne peut rien faire. Soft-lock par triangulation :
- Routed ne peut ni bouger ni attaquer (`useTacticalSelection.ts` lignes 87, 110).
- Routed ne peut pas être ciblée (`useTacticalSelection.ts` ligne 114).
- Récup moral bloquée si en ZdC ennemie (`morale.ts:53`). Le bleu adjacent maintient le verrou.

### Hotfix livré — PR #27

- `src/hooks/useTacticalSelection.ts` v1.4 : retire `if (enemy.routed) continue` ligne 114. Permet le coup de grâce. Côté EF déjà autorisé (`handleAttack.ts:56` ne bloque que l'attaquant routé).
- 206/206 tests verts. `tsc` 0 erreur.
- Header 4 entrées max respecté (drop v1.0).

### Design Phase 2.5 moral-cohésion — `docs/PLAN-MORAL-COHESION.md`

Refonte routed binaire → **3 états gradués** :

- **Cohésion** = `0.5 × moral + 0.3 × effectif + 0.2 × soutien` (plafond support 3, alliés rayon 1+2).
- **Nominal** (>0.5) : OK ; **Ébranlé** (0.2-0.5) : OK + modale confirmation ; **Brisé** (≤0.2) : Retraite ou Reddition seule.
- Effets soutien : +1 récup moral / allié rayon 1 (max +3) ; ×0.9 perte moral combat par allié (cumul max -30%) ; cohésion +0.2 max.
- Reconstitution Brisé conditionnée à `effective ≥ 25% effectiveMax` (sinon merge ou Infirmier Phase 5).
- Anneaux visuels : couche état (vert→jaune→orange clair→orange foncé) + couche soutien (bleu fin/épais/glow) + anneaux d'action existants (ambre sélection, rouge cible).
- Découpé en 4 vagues (A engine / B EF / C UI+render / D tests humain), ~4 jours.

Décisions actées user : rayon 1+2, plafond 3, pondération 50/30/20, anneau bleu superposé. Open questions : bonus moral exact reddition, calibrage 50/30/20 à valider Vague D.

### Reste à faire

- Test humain PR #27 sur la partie bloquée (le coup de grâce déverrouille).
- Plan moral-cohésion à valider/affiner avant Vague A engine.
- Build PWA + tag `phase-2-complete` reportés post-PR #27 mergée.

### Fichiers touchés

- `src/hooks/useTacticalSelection.ts` v1.4 (hotfix)
- `docs/PLAN-MORAL-COHESION.md` (NEW)
- `docs/BACKLOG.md` (section Phase 2.5 ajoutée + ré-attribution Infirmier Phase 5)
- `PLAN-MASTER-CHECKLIST.md` (réordonnancement complet : Phase 2 = Refonte combat, Phase 2.5 = Moral-cohésion, Phase 3 = Moteur de tour, IA solo → Phase 4, Profondeur tactique → Phase 5, etc.)
- `CLAUDE.md` (§ 7 État courant aligné)
- `docs/WIP.md` (cette session)

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
