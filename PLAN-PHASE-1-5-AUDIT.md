# PLAN PHASE 1.5 — AUDIT + TASKs

> Mise à jour : 10/05/2026 (session 13).
> Objectif : enrichissement combat (wounded data model + retour visuel asymétrique).
> Scope : pas une nouvelle phase, juste un lot de polish entre Phase 1 et Phase 2.

---

## 1. Contexte

L'utilisateur a validé Phase 1 mais signalé deux trous UX :
1. Aucun retour visuel des combats sans cliquer sur les unités.
2. Pas de notion de "soldats blessés" — juste hp qui chute. Empêche l'introduction future d'une unité Infirmier (Phase 3).

Décision : intégrer `wounded` côté BDD/engine + retours visuels **asymétriques** (fog-of-war partiel sur les unités ennemies).

---

## 2. Audit code existant

### 2.1 BDD (migrations 007-010)
- `units(id, game_id, team, kind, q, r, hp, hp_max, morale, morale_max, routed, has_moved, has_attacked, created_at, updated_at)`
- Pas de colonne `wounded`. RLS active (`units_select_member`). Realtime publié + REPLICA IDENTITY FULL.
- → **Migration 011** nécessaire : ajouter `wounded int not null default 0 check (wounded >= 0)`.

### 2.2 Engine `src/engine/combat/`
- `melee.ts` v1.0 : `damage = max(0, atkEff − defEff + roll)`, `defenderHpAfter`, retourne `CombatResult`.
- `ranged.ts` v1.0 : pareil sans flanc, rollRange 30.
- `preview.ts` v1.0 : `damageMin`/`damageMax`/`killProbability`.
- `types.ts` : `CombatResult` actuel = 10 champs (damageDealt, hpAfter, deltas morale, killed, routed, rollUsed).
- 14 tests existants dans `melee.test.ts` (6) + `ranged.test.ts` (5) + `preview.test.ts` (3) — tous PASS sur `damageDealt`.

### 2.3 EF `resolve_action` v1.1
- 595 lignes. Implémente `move`, `attack_melee` (+ riposte mêlée auto), `attack_ranged`.
- Engine-port Deno dans `supabase/functions/_shared/engine-port/` (duplication contrôlée, piège #12).
- Snapshot `game_actions.result` typé `AttackResult` : `{ attacker_id, defender_id, kind, combat, riposte, defender_killed, attacker_killed, attacker_after, defender_after, seed }`.
- UPDATE atomic défenseur puis attaquant (piège #22 : non transactionnel, MVP acceptable).

### 2.4 Render
- `UnitInstance` (`src/render/types.ts`) : `{ id, position, team, kind, count? }` — **pas de hp**.
- `unitRowToInstance` (`src/render/_data/unitAdapter.ts`) : map les 4 champs. À étendre.
- `UnitPlaceholder.tsx` v1.6 : reçoit unit, hexSize, selected/targetable/exhausted. **Pas de scale par hp ratio, pas de barre PV au-dessus**.

### 2.5 Realtime
- `useGame.ts` : subscribe sur `games` UPDATE/DELETE + `game_players` * + ne touche pas `game_actions`.
- `useBattleUnits.ts` : refetch + subscribe sur `units`.
- **Aucun listener client sur `game_actions`** → impossible aujourd'hui de réagir à un combat reçu côté défenseur.

### 2.6 Toast actuel
- Game.tsx `handleUnitClick` composite : appel `submitAction`, si `res.ok` → `toast.success('Tir effectué' / 'Charge engagée')`.
- Visible **uniquement côté attaquant**.

---

## 3. Décisions de design

### 3.1 Modèle wounded
- `hp` = soldats **actifs** au combat (s'engagent, reçoivent les coups, projettent ZoC).
- `wounded` = soldats **blessés** (ne combattent plus, soignables Phase 3 par Infirmier).
- `hp_max - hp - wounded` = morts cumulés (calculé, pas stocké).
- Invariant : `hp + wounded ≤ hp_max`. **Géré côté EF, pas en check SQL** (pour ne pas bloquer un UPDATE atomique sur edge case race).

### 3.2 Règle de split — par défaut
- À chaque hit `D` PV infligés :
  - `killed = round(D × 0.6)` → décrément définitif `hp`
  - `wounded_add = D − killed` → décrément `hp` ET incrément `wounded`
- Net : `hp -= D`, `wounded += wounded_add`.
- Ratio 0.6 ajustable par `UnitKind` plus tard (artillerie : 0.7-0.8 plus létal, mêlée : 0.55-0.6).

### 3.3 Wounded ≠ ZoC ni LoS
- Cohérent avec `routed` : un wounded ne projette plus de ZoC, ne bloque plus la LoS.
- **Décision MVP** : non, on ne change pas `computeEnemyZoc` ni `hasLineOfSight` pour ce lot. Une unité a toujours UN état (ses wounded sont présents physiquement). On ne dégrade pas ses capacités tant qu'elle a `hp > 0`. Sinon ça complexifie le modèle pour rien (Phase 3 Infirmier : on retravaillera).
- Le **scale visuel** prend `(hp + wounded) / hpMax` car les blessés sont physiquement encore là.

### 3.4 Visuel asymétrique
- **Mes unités** : mini barre PV Billboard multi-segment au-dessus du soldat.
  - 🟢 vert = `hp / hpMax`
  - 🟠 orange = `wounded / hpMax`
  - ⬛ noir/vide = morts cumulés
- **Unités ennemies** : pas de barre, juste `scale = lerp(0.65, 1.0, (hp + wounded) / hpMax)`.
- **Mes unités** ont aussi le scale (cohérence visuelle, on voit aussi sa propre force décroître).

### 3.5 Toast asymétrique via Realtime
- Listener INSERT sur `game_actions` filter `game_id`.
- Parser `action.payload.unit_id` + `action.result.attacker_id`/`defender_id` + lookup unit.team via `useBattleUnits`.
- Toast distinct selon perspective :
  - **Attaquant (mon team)** : `Cavalerie : tir réussi — 12 ennemis abattus` (ou raté). Pas d'info wounded/restant côté ennemi.
  - **Défenseur (mon team)** : `Cavalerie sous attaque — 8 morts, 6 blessés, 32 restants`.
  - **Défaite ma cible** : `Cavalerie défaite — 32 morts au combat`.
  - Si riposte (mêlée) : 2 toasts ou 1 fusionné selon clarté UX.

---

## 4. TASKs atomiques

### Vague 1 — engine + BDD (parallélisable, sans dépendance)

| ID | Type | Fichiers IN | Fichiers OUT | Effort |
|---|---|---|---|---|
| **P1.5-MIG-01** | sql | — | `supabase/migrations/011_units_wounded_column.sql` (NEW) | 10 min |
| **P1.5-ENG-01** | code | `src/engine/units/types.ts`, `src/engine/combat/types.ts`, `melee.ts`, `ranged.ts`, `preview.ts`, tests | mêmes + tests étendus | 45 min |

### Vague 2 — EF + adapter (dépend ENG-01)

| ID | Type | Fichiers IN | Fichiers OUT | Effort |
|---|---|---|---|---|
| **P1.5-EF-01** | edge_function | `supabase/functions/_shared/engine-port/units.ts`, `combat/*`, `resolve_action/index.ts`, `_shared/types.ts` | mêmes étendus avec wounded + split | 1h15 |
| **P1.5-ADAPT-01** | code | `src/render/_data/unitAdapter.ts`, `src/render/types.ts` | UnitInstance étendu + map wounded | 20 min |

### Vague 3 — render visuel (dépend ADAPT-01)

| ID | Type | Fichiers IN | Fichiers OUT | Effort |
|---|---|---|---|---|
| **P1.5-REND-01** | code | `UnitPlaceholder.tsx`, `TacticalScene.tsx`, `Game.tsx` | scale par effectiveRatio + viewerTeam prop drilling | 45 min |
| **P1.5-REND-02** | code | `UnitPlaceholder.tsx` | NEW component `UnitHealthBar` Billboard 3-segments, conditionnel team | 1h |

### Vague 4 — UI feedback (dépend EF-01 + ADAPT-01)

| ID | Type | Fichiers IN | Fichiers OUT | Effort |
|---|---|---|---|---|
| **P1.5-NOTIF-01** | code | new `useCombatNotifications.ts`, `Game.tsx` | hook Realtime INSERT game_actions + dispatch toasts asymétriques | 1h15 |
| **P1.5-PREV-01** | code | `CombatPreviewTooltip.tsx`, `engine/combat/preview.ts` | preview retourne split tués/blessés + tooltip affiche les 2 | 30 min |
| **P1.5-INSP-01** | code | `UnitInspector.tsx` | barre HP étendue avec segment wounded orange | 20 min |

### Vague 5 — clôture

| ID | Type | Effort |
|---|---|---|
| **P1.5-DOCS-01** | docs | 20 min |

**Total estimé** : ~6h, étalé sur 4 vagues séquencées.

---

## 5. Ordre d'exécution proposé

```
Vague 1 (parallèle):
  ┌─ P1.5-MIG-01 ─┐
  │               │
  └─ P1.5-ENG-01 ─┤
                  │
Vague 2 (séquence après ENG-01):
  ├─ P1.5-EF-01 ─┐
  └─ P1.5-ADAPT-01 ─┐
                    │
Vague 3 (séquence après ADAPT-01):
  ├─ P1.5-REND-01 ─┐
  └─ P1.5-REND-02 ─┤
                   │
Vague 4 (parallèle après EF-01 + ADAPT-01):
  ├─ P1.5-NOTIF-01 ┐
  ├─ P1.5-PREV-01 ─┤
  └─ P1.5-INSP-01 ─┤
                   │
Vague 5:
  └─ P1.5-DOCS-01
```

**Découpage en PRs** :
1. PR Phase 1.5-A : MIG-01 + ENG-01 + EF-01 + ADAPT-01 (data model wounded + engine + EF, sans visuel)
2. PR Phase 1.5-B : REND-01 + REND-02 (scale + barre PV)
3. PR Phase 1.5-C : NOTIF-01 + PREV-01 + INSP-01 + DOCS-01 (toasts + previews + docs)

Chaque PR est testable individuellement.

---

## 6. Critères d'acceptation Phase 1.5

- [ ] Migration 011 appliquée, `units.wounded` présent, RLS clean (advisors)
- [ ] `npm run tsc` 0 erreur
- [ ] `npm run test` ≥ 107 (idéalement +3 tests pour le split)
- [ ] Engine `melee.ts` + `ranged.ts` retournent `killed` + `wounded_add` en plus de `damageDealt`
- [ ] EF `resolve_action` met à jour `units.wounded` correctement
- [ ] Mes unités ont une mini barre PV 3-segments visible
- [ ] Mes unités et adverses scalent selon `(hp + wounded) / hpMax`
- [ ] Toast asymétrique reçu en Realtime côté défenseur ET attaquant
- [ ] CombatPreviewTooltip affiche split tués/blessés
- [ ] UnitInspector affiche segment wounded orange
- [ ] WIP, BACKLOG, dependency-map à jour

---

## 7. Risques + mitigations

| Risque | Mitigation |
|---|---|
| Tests engine cassent (CombatResult shape change) | Étendre `CombatResult` avec champs optionnels `killed?`/`woundedAdd?` ou update les 14 tests dans le même commit |
| EF deno engine-port désynchro avec src engine | Modifier les 2 dans la même PR, copier-coller manuel + tests Deno (à exécuter localement) |
| Migration sur Supabase prod | Migration purement additive (NOT NULL DEFAULT 0), pas de breaking. Run `supabase db push` puis `Supabase:get_advisors` |
| `hp + wounded > hp_max` en cas de bug | Pas de check SQL (pour ne pas bloquer race). Géré côté EF via `Math.min(hp_max - hp, wounded_add)` |
| Riposte mêlée écrase wounded de l'attacker | Splitter aussi le `damageDealt` de la riposte sur l'attacker, append wounded à attacker.wounded |
| `useCombatNotifications` reçoit l'INSERT trop vite, avant que `useBattleUnits` ait refetch | Lookup unit.team via `action.payload`+state du moment (les unités existent encore avant le DELETE potentiel) |

---

## 8. Hors scope Phase 1.5

- Particules combat (Phase 6)
- Sons (Phase 6)
- Unité Infirmier qui soigne `wounded` (Phase 3)
- Rebalance ratios par UnitKind (Phase 3+)
- Wounded affecte ZoC ou LoS (réservé Phase 3)
- Combat log historique persistant en sidebar (BACKLOG)
