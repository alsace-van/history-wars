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
| Vue d'ensemble phases | `PLAN-MASTER-V2.md` |
| Travail Phase 1 | `PLAN-PHASE-1-FIN-CLAUDE-CODE.md` (TASKs détaillées) |
| Modif d'un fichier existant | `docs/dependency-map.md` § 3 (impact dépendants) |
| Bug suspect d'être déjà vu | `docs/CLAUDE.md` § 11 (pièges connus) |
| Reprise de session | `docs/WIP.md` (dernière session en tête) |
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

## 7. État courant (14/05/2026 — session 23 clôturée)

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
- Phase 4-bis ⬜ lookahead 2-3 ply + fog server-side RLS (vue SQL filtrée units). Auto end_turn ✅ session 23.
- Phase 5 ⬜ profondeur tactique (formations, fatigue/endurance dédiée, ravitaillement, Infirmier, météo, mode campement Phase 5 = Infirmier amplifie heal).
- Phases 6-15 ⬜

Prochaine action session 24 :
1. **Phase 4-bis Lot 1** : fog server-side RLS (vue SQL filtrée `units` par viewer team via `visibleHexesFromTeam`) — anti-cheat client.
2. **Phase 4-bis Lot 2** : lookahead 2-3 ply (minimax léger sur top-N actions, profondeur 2-3, bornage temps EF < 5s).
3. Possible Lot B Phase 4 : étendre `AIAction` (charge cav, split/merge, pose d'ordres conditionnels).

EFs prod : `run_bot_turn` v7, `resolve_turn` v6, `resolve_action` v21, `submit_orders` v4, `start_battle` v5. Migrations 021/022/023 appliquées.

Tests : 345/345 verts. Game.tsx ~660 lignes (toujours > 600 limite — dette technique).

Plan file actif : `~/.claude/plans/toasty-puzzling-beaver.md` (Phase 4 Lot A).

Mémoires user : `~/.claude/projects/.../memory/`
- `ux_tactica_lisibilite.md` — FoW strict, ratios, économie visuelle
- `vision_operational_campaign.md` — vision long-terme campagne
- `feedback_no_icon_overlap.md` — règle marge icônes (session 22)
