# CLAUDE.md — TACTICA

> Point d'entrée Claude Code. Lis ce fichier en premier à chaque session.
> Tout le reste est référencé depuis ici.

---

## 1. Projet

TACTICA = wargame hex tactique multi-joueur sur les batailles de France (Moyen Âge → 1ère GM).
Stack : Vite + React 18 + TS strict + Three.js (R3F + drei) + Tailwind + Radix + Supabase + Vitest + PWA.

Architecture 3 niveaux (`tactical | operational | strategic`) — en MVP seul `tactical` est implémenté.

## 2. Fichiers à charger selon la tâche

| Tâche | Fichiers à lire AVANT de coder |
|---|---|
| Toute tâche TACTICA | `docs/CLAUDE.md` (conventions strictes) |
| **Avant TOUTE modif code** | `docs/dependency-map.md` § 0 TL;DR + § 12 "modifier X, vérifier Y" |
| Vue d'ensemble phases | `PLAN-MASTER-CHECKLIST.md` |
| Reprise de session | `docs/WIP.md` (dernière session en tête) |
| Bug suspect d'être déjà vu | `docs/dependency-map.md` § 10 pièges connus + `docs/CLAUDE.md` § 11 |
| Hot-path code (combat, click, etc.) | `docs/dependency-map.md` § 11 |
| Travail Phase 1 (legacy) | `PLAN-PHASE-1-FIN-CLAUDE-CODE.md` |
| Backlog post-phase | `docs/BACKLOG.md` |

## 3. Règles critiques (non-négociables)

1. **Frontière modules** : `engine/` zéro Three/Supabase/React. `render/` zéro Supabase/hooks. `hooks/` zéro Three direct. Aucun cycle.
2. **Header versioning** : 4 entrées max, format `// vX.Ya (DD/MM/YYYY) — résumé ≤10 mots`. Le TAG `console.log('[Component vX.Y]', ...)` DOIT matcher la version courante.
3. **Hooks React** : ne jamais déplacer un hook existant. Tout nouveau hook s'ajoute EN QUEUE avant le return.
4. **Max 600 lignes par fichier**. Si on dépasse, extraire en hooks/composants séparés.
5. **TS strict** : pas de `any` sans commentaire justificatif.
6. **Try/catch + toast sonner** sur tout appel Supabase ou EF.
7. **RLS obligatoire** sur toute nouvelle table. `service_role` jamais côté client.
8. **Aucun hardcode** de valeurs de jeu : `SCALE_CONFIG`, table `units`, ou JSONB `state`.
9. **3D** : Z = hauteur (Fusion 360). Conversion Y↔Z UNIQUEMENT à la frontière `render/`. Pas dans l'API publique.
10. **Hex** : flat-top, coordonnées cubiques `{q,r,s | q+r+s=0}`. Voisins ordre fixe E,NE,NW,W,SW,SE.

## 4. Workflow multi-agent

Le travail Phase 1 fin est découpé en **TASKs atomiques** dans `PLAN-PHASE-1-FIN-CLAUDE-CODE.md`. Règles :

- Une TASK ne lit QUE ce qui est dans son `Fichiers IN`. Si manque → ajouter à IN ou créer dépendance.
- Une TASK livre EXACTEMENT les fichiers dans `Fichiers OUT`. Pas de fichiers bonus.
- Tasks parallélisables = aucune intersection sur OUT. Vérifier mécaniquement.
- Tasks dépendantes = orchestrer en série, A doit valider avant B.
- 3 vagues d'exécution prévues — voir § 0 du plan Phase 1.

### Pré-flight checklist avant edit

Avant chaque `str_replace` ou `create_file` :

1. ✅ Le fichier est-il dans le `OUT` de ma TASK courante ?
2. ✅ Ai-je lu ses dépendants dans `docs/dependency-map.md` § 3 ?
3. ✅ Le TAG `console.log` matche-t-il le header bumper ?
4. ✅ Aucun hook réordonné dans un .tsx existant ?
5. ✅ Max 600 lignes respecté ?

### Post-edit checklist

1. ✅ `npm run tsc` 0 erreur
2. ✅ `npm run test` vert (≥ 107 actuels)
3. ✅ `npm run build` PWA OK si la TASK touche le build
4. ✅ `console.log` debug retirés (garder uniquement TAG versionné)
5. ✅ Commentaires inline ≤ 1 ligne, format `// voir piège #N`

## 5. Format livraison à l'utilisateur

```
1. Diagnostic     : 1-2 lignes en français simple
2. Tu dois tester : 1 ligne par comportement concret visible à l'écran
3. Livrables      : zip via present_files, arborescence src/... correcte
4. Rien d'autre.
```

Pas de récap, pas de "leçons apprises", pas de bullet 10 points.

Exception : confiance < 95 % AVANT de coder → plan détaillé + questions autorisés.

## 6. Sources de vérité du code (par priorité)

1. Dernière version livrée dans la session courante (si modif déjà faite, prime sur tout).
2. Code dans le repo local côté utilisateur (pull GitHub à jour).
3. `/mnt/project/` (fallback).

Ne jamais demander un re-upload si le fichier est accessible via une de ces sources.

## 7. État courant (17/05/2026 — session 26 clôturée)

- Phase 0 → 2.6 ✅ (cf. WIP.md sessions 1-19)
- Phase 3.1 ✅ fog of war évolué client-side (session 20). Tag `phase-3-1-complete`.
- Phase 3.2 ✅ ordres conditionnels (session 21). Tag `phase-2-complete`.
- Phase 3.2-bis ✅ sprint UX engagement clarity + routed effectif-based + sidebar refondue + icônes ordres (session 21).
- **Phase 3.3 ✅** (session 22) — polish/balance fin Phase 3 :
  - **Artilleries split** : `artillery_light` (obusier, range 3, arcedTrajectory true, tir en cloche) vs `artillery_heavy` (canon, range 6, LoS requis, falloff). Labels AO/AC.
  - **Plafond détection ordres dynamique** : fire = `stats.range`, non-fire = `max(range, vision)` (au lieu de 10 fixe).
  - **Bonus défensif hold** : +15% défense base + bonus terrain ×2 delta. Appliqué attaque manuelle + fire order + engagement tick. Symétrique riposte.
  - **Migration 021** : sub_kind enum + scenarios MVP étendus 10 unités (1 obusier + 1 canon par camp).
- **Phase 3.3-bis ✅** (session 22) — charge réelle + campement :
  - **Charge cav avec dégâts** : `applyChargeOrderCombat` dans `_evaluateOrders.ts` v1.5 (avant : flag-only, 0 dégât). Synthétise `attackerPath` via `cubeLineDraw` → resolveCombat complet + ripost + engagement.
  - **Mode campement** : `OrderActionKind='camp'` + `OrderTriggerKind='always'`. Effets : +5 morale, heal 10% wounded/tour. Pas de bonus défensif (trade-off hold). Pattern : `priority=1: on_attacked → retreat` + `priority=2: always → camp`.
  - **Listener `order_triggered` + toast owner** (`useOrderTriggeredToasts.ts`).
  - **Icône ordre sur pion 3D** (`useActiveOrdersByUnit.ts`) : ♞ charge / ⚔ fire / ↩ retreat / 🛡 hold / ⛺ camp, couleurs sémantiques.
  - **Retreat directionnel** : bouton "Choisir hex" dans OrdersPanel → mode `orderRetreatPickMode` highlight bleu spiral(movement). `pickRetreatHex` honore `params.destHex` (avec fallback step-toward si > movement).
- **Phase 4 Lot A ✅** (session 22) — IA solo MVP serveur 1 ply :
  - Engine `src/engine/ai/` (scorer, picker, types) + mirror Deno port. `scoreAction = damageMax − risk` heuristique. Profils easy/medium/hard via tiebreak (easy = random top 3, hard = offensive priority).
  - EF `run_bot_turn` : auth JWT + iterate bot units (id ASC) + applyBotAction (move/attack via resolveCombat/hold). Le client humain end_turn reste responsable de la bascule.
  - Migration 022 : `user_id NULL` autorisé si `is_bot=true` + RLS host peut INSERT/DELETE bot rows.
  - Migration 023 : **mode spectateur** (RLS additif SELECT pour `status='in_progress'`).
  - UI : `AddBotButton` (dropdown difficulté) + `TeamPanel` v1.1 + `useBotAutoTurn` hook (host only, anti-double-trigger). `useCombatNotifications` v2.5 accepte `actor_user_id=null` pour bot.
  - **Bug critique fixés en cours session** : (1) hook bot ne fire pas → cleanup useEffect annulait setTimeout (fix : invoke direct). (2) EF 400 → lecture `active_team` snake_case au lieu de `activeTeam` camelCase. (3) `canStart` excluait bots → fix client + start_battle. (4) boardRadius hardcodé 5 dans EF.
  - **Bug ouvert fin session 22** : bot insère 5× `hold` (FIXÉ session 23 — root cause `cubeKey` axial 2-comp splittée en 3 → `dest.s = NaN` → `cubeDistance` NaN → tous moves score=0).
- **Phase 4 polish ✅** (session 23) — bot rendu jouable bout-en-bout, 5 fixes critiques :
  - **Fix 1** : bot bouge enfin (parseCubeKey au lieu de split). Bug latent identique fixé dans `useTacticalSelection.ts`. Pitfall #13 ajouté.
  - **Fix 2** : tour bascule auto après bot (`resolve_turn` v6 bypass `NOT_YOUR_TURN` si activeTeam contient bot + Game.tsx auto-endTurn 1.2s post-bot).
  - **Fix 3** : bot engagé attaque au lieu de subir (`scoreHold = -50` si engagé, force riposte même si attack score < 0).
  - **Fix 4** : journal combat clarifié — short labels colorés `[AO1 rouge] → [I1 bleu]`, icône ⚔/🏹 couleur attaquant, badge `Bot` si IA, mention `(votre attaque)/(subi)/(spectateur)`.
  - Tests : 348/348 verts (+3 régressions). EFs déployées : `run_bot_turn` v7, `resolve_turn` v6.
- **Phase 4-bis Lot 1 ✅** (session 24) — fog of war server-side via RLS units :
  - Migration 024 : helpers SQL hex (`cube_distance`, `cube_round`, `has_line_of_sight` Bresenham PL/pgSQL avec epsilon shift) + `is_unit_visible(unit_id, viewer_uid)` security definer.
  - Policy RESTRICTIVE `units_select_fog` (AND avec PERMISSIVE existantes). Spectateurs bypass fog. Membres : check vision + LoS.
  - Anti units fantômes : `useEffect refresh units` sur `turn_number` change dans Game.tsx (units ennemies sortant du fog ne reçoivent plus d'UPDATE Realtime).
  - Validé prod : SET LOCAL ROLE authenticated, 5→4 units retournées, red A correctement filtré (LoS bloquée par red I).
  - EFs server-side non affectées (service_role bypass RLS).
- **Phase 4-bis Lot 2 ✅** (session 26) — lookahead minimax 2→3 ply avec α-β + iterative deepening :
  - Nouveau module `src/engine/sim/` (5 fichiers : types, clone, applyAction PUR, evalState, search) + mirror Deno `engine-port/sim/`.
  - `applyAction` reproduit `applyBotAction` EF sans toucher la DB → simulation in-memory possible.
  - `pickBestActionForUnit` (picker v1.2) délègue à `searchBestAction` si `ctx.lookaheadDepth >= 2` et `profile !== 'easy'`. Fallback 1-ply garanti.
  - Profils : easy=1 ply (random top 3, inchangé) / medium=2 ply beam N=3 / hard=3 ply beam N=5.
  - Iterative deepening avec deadline 3.5s par action (EF). Toujours retourne min. l'action 1-ply fallback.
  - Test winrate dormant (`describe.skip`) : 50 parties hard vs medium, assert hard ≥ 64%.
  - 381/381 tests verts (+36).
  - **EF v8 déployée prod** ✅ (session 26, dashboard `abhbkdyoknrsdavimbpr/functions/run_bot_turn`).
- Phase 5 ⬜ profondeur tactique (formations, fatigue/endurance dédiée, ravitaillement, Infirmier, météo, mode campement Phase 5 = Infirmier amplifie heal).
- Phases 6-15 ⬜
- **Session 25 (17/05/2026) ✅** — stabilisation UX charge cav Phase 2.6 + polish anim générique. Bugfix only, pas de nouvelle phase. Détails : `docs/WIP.md` Session 25.
  - Bug stale preview cav corrigé (`useChargePreview` v1.2 : reset défensif).
  - Hit-and-run cav fonctionne même si défenseur tué (`handleAttack` v1.9, EF redéployée).
  - Anim charge + pause impact 700ms + lerp retreat à vitesse kind (`UnitPlaceholder` v2.16).
  - Facing dynamique vers direction du mouvement avec offset calibré par kind (`UnitPlaceholder` v2.19, `FACING_OFFSET_BY_KIND` ligne ~88).
  - **À retenir** : tout nouveau GLB ajouté → vérifier visuellement l'orientation, ajuster `FACING_OFFSET_BY_KIND` (valeurs typiques `0`, `π/2`, `π`, `-π/2`).

Prochaine action session 27 — à choisir avec user :
1. **Phase 5 Relief de terrain** (heightmap, biomes, impact charge/LoS/movement) — candidat naturel.
2. **Lot B Phase 4** étendre `AIAction` (charge cav, split/merge, ordres conditionnels) — exploiter les nouvelles mécaniques Phase 3.3-bis avec le minimax.
3. **Nettoyage code legacy** : supprimer `canCharge.ts`, `usePostChargeChoice.ts`, `handleChargeStay/Retreat.ts`, migrations 025-028 non appliquées.
4. **Tuning IA Lot 2** : lancer le winrate test, ajuster `evalState` ou beam widths si hard < 64%.
5. **Validation visuelle bot hard** : créer partie solo via AddBotButton profil hard, vérifier décisions non-suicidaires + tour < 5s.

EFs prod (17/05/2026) : `run_bot_turn` **v8** (déployée session 26), `resolve_turn` v6, **`resolve_action` v22** (handleAttack v1.9), `submit_orders` v4, `start_battle` v5. **Migrations 001-028 toutes appliquées prod** (025-028 ajoutées 16/05/2026 mais untracked git → `git add` en début de session 27).

Tests : 381/381 verts (+36 vs session 25). Game.tsx ~666 lignes (dette technique inchangée).

Plan file actif : `~/.claude/plans/cached-nibbling-wadler.md` (Phase 4-bis Lot 2 — minimax).

Mémoires user : `~/.claude/projects/.../memory/`
- `ux_tactica_lisibilite.md` — FoW strict, ratios, économie visuelle
- `vision_operational_campaign.md` — vision long-terme campagne
- `feedback_no_icon_overlap.md` — règle marge icônes (session 22)
