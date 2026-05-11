# PLAN-ENGAGEMENT-PERSISTENT.md

> **Phase 2.6** — Combat continu : l'engagement entre 2 unités est un **état persistant** qui s'étale dans la durée, alimenté par les réserves arrière.
>
> Refonte du modèle Phase 2 ("combat = action ponctuelle") vers Phase 2.6 ("combat = état persistant").
>
> Origine : feedback user 11/05/2026 — "une fois qu'un combat est entamé ça va jusqu'au bout, et ça s'étale dans la durée". Permet de modéliser le réalisme des batailles napoléoniennes (lignes qui tournent, réserves derrière, désengagements coûteux).

---

## 1. Mécanique centrale

### État `engaged`

Une paire d'unités ennemies adjacentes peut être dans l'état **engaged**. Stocké en BDD via table dédiée `engagements`.

### Création — **volontaire uniquement**

- Clic "Engager / Attaquer en mêlée" → l'attaquant initie l'engagement avec un ennemi adjacent.
- **Pas d'engagement automatique** quand 2 unités deviennent adjacentes via mouvement. Permet le contournement tactique (passer à côté d'une unité sans la combattre).
- Charge cavalerie → exception ponctuelle (cf § 4).

### Sortie

L'engagement est supprimé quand :
- Une des 2 unités tombe sous `effectiveMin` (dissolution).
- Une des 2 unités est Brisée et se replie (Retraite Phase 2.5).
- Un joueur clique **"Rompre le combat"** sur son unité engagée (cf § 3).
- Distance entre les 2 > 1 (rupture forcée — impossible sauf via retraite ou suppression).

## 2. Résolution par tour (attrition continue)

À chaque fin de tour (`resolve_turn`), **pour chaque engagement actif** :

```
1. Calculer dégâts auto bilatéraux (similaire resolveContact)
   - Variance réduite à ±5 % (au lieu de ±15 %) — combat continu plus déterministe
   - Pas de bonus charge (charge = ponctuelle Phase 2)
   - Bonus matchup terrain moral cohésion soutien : appliqués normalement

2. Appliquer la RELÈVE depuis les réserves arrière :
   reserveCap = effective - menEngaged  // hommes hors contact
   pertesAjustees = min(damage_subi, reserveCap × 0.1 + menEngaged_pertes)
   // 10 % des réserves peuvent monter au contact par tour pour combler

   effective_apres = effective - damage_subi  // pertes totales pion
   menEngaged reste = min(effective_apres, contactCap)

3. Vérifier conditions de sortie (effective < min, broken via cohesion, etc.)
```

### Effet ressenti

| Force | Réserve | Cap terrain | Durée typique combat |
|---|---|---|---|
| I 800 vs I 400, plaine | 600 vs 200 | 200 | ~15-25 tours (bleus tiennent par réserve, rouges s'épuisent en ~12-15 tours) |
| I 800 vs I 800, plaine | 600 vs 600 | 200 | ~25-40 tours, moral devient décisif |
| I 200 vs I 200, plaine | 0 vs 0 | 200 (saturation) | ~12-15 tours, contact direct sans relève |
| I 100 vs I 100, forêt | 0 vs 0 | 100 (forêt) | ~8-12 tours |

## 3. Rompre le combat (action volontaire)

| Aspect | Valeur |
|---|---|
| Type d'action | Consomme `has_moved = true` ET `has_attacked = true` |
| Coût | **10 % effective** perdus automatiquement (modélise hommes laissés au front) |
| Effet | Engagement supprimé. Unité libre de bouger le tour suivant |
| Cohésion requise | Aucune (toute unité engagée peut tenter) |
| Risque d'échec | Aucun (Phase 2.6 — option A coût fixe acté 11/05) |

## 4. Cavalerie — exception charge

La charge reste une **attaque ponctuelle** (mécanique Phase 2 conservée).

### Après impact

**Si défenseur tombe / rompt** → cav libre :
- Peut re-charger sur un autre ennemi accessible
- Peut poursuivre les routed (mouvement libre)

**Si défenseur tient** → **menu de choix** dans UnitInspector :

| Option | Mécanique |
|---|---|
| **Rester en mêlée** | Engagement créé (comme infanterie). Malus cumulatifs : <br>• `defense × 0.8` (cavalier piégé) <br>• `baseAttritionRate × 1.3` (10 % au lieu de 8 % par tour) |
| **Se replier** | Recul 1 hex gratuit (action non consommée). Modélise le repli ordonné post-impact napoléonien. Si tous voisins arrière occupés → choix forcé "Rester". |

Cohérence historique : les chevaliers piégés dans une mêlée prolongée perdaient vite (Crécy 1346, Azincourt 1415). Une cav qui réussit sa charge **doit** soit poursuivre soit se replier — rester sur place est suicidaire.

## 5. Tir ranged

Un tireur (range > 1) **ne s'engage pas** en tirant à distance.

| Cas | Effet |
|---|---|
| Tireur seul, ennemi à 2-7 hex | Tire normalement (Phase 2 ranged). Pas d'engagement. |
| Ennemi devient adjacent (distance 1) | Le tireur ne peut **plus tirer** sur lui (`minRange` artillerie = 2 ; archer range=4 mais à distance 1 c'est "à bout portant", pas le rôle du tireur). <br>Peut tirer sur un autre ennemi à distance ≥ 2 (LoS dépendant). |
| Ennemi adjacent clique **"Engager mêlée"** sur tireur | **Engagement de mêlée forcé.** Tireur subit avec sa défense faible (A: defense=0.3 → désastre). Devrait fuir avant. |
| Tireur veut fuir | Action "Mouvement" classique. La ZdC ennemie bloque la sortie (cf piège #41 : entrée OK, sortie = +∞ MP). Donc fuite proactive **avant** que l'ennemi arrive. |

Stratégiquement : protéger les tireurs derrière une ligne d'infanterie devient critique.

## 6. Multi-engagement (encerclement)

Une unité au milieu de plusieurs ennemis adjacents peut être engagée sur **chaque paire séparément** :

```
Exemple : I bleue 800 entourée de 3 I rouges 400 chacune

Engagement #1 : bleue ↔ rouge_NW
Engagement #2 : bleue ↔ rouge_E
Engagement #3 : bleue ↔ rouge_SW
```

À chaque fin de tour, **la bleue subit 3 attritions** (1 par engagement). Elle bénéficie de la relève 10 % UNE FOIS (sa propre réserve), mais doit absorber 3 fois plus de dégâts.

Durée typique encerclement 800 vs 3×400 :
- Tour 1-3 : bleue ~16 pertes × 3 = 48 / tour, soit 144 pertes en 3 tours → 656 restants
- Tour 4 : moral chute (3 ZdC ennemies, pas de récup possible)
- Tour 5-7 : Ébranlé → Brisé en 7-10 tours
- Cohérent avec encerclement historique mortel (Cannes, Sedan).

## 7. Synergie avec Phase 2.5 (moral-cohésion)

L'engagement actif influence le moral :

- **Chaque tour engagé** : −2 moral additionnel (fatigue / stress combat continu)
- Renforce l'érosion vers Ébranlé puis Brisé
- Quand Brisé, les choix Retraite / Reddition / Suicide s'appliquent normalement
- **Compatibilité** : si une unité Brisée est en engagement, elle ne peut pas attaquer (déjà géré), mais l'attrition continue de la frapper passivement. Sa seule sortie : Retraite (action volontaire, coûte 10 % en plus du coût engagement) ou Reddition.

Une unité **Nominal en engagement long** (10+ tours) descend en Ébranlé : `−2 × 10 = −20 moral`, ce qui combiné aux pertes effective baisse cohesion sous 0.5.

## 8. UI

### Indicateur visuel pion engagé

- **Anneau pulsant rouge** sur les 2 pions engagés (différent du anneau `targetable` qui est statique)
- **Ligne fine rouge** connectant les 2 pions au sol (modélise la "ligne de mêlée")
- **Badge "Engagé T3"** dans UnitInspector (T3 = depuis le tour 3)
- Si multi-engagement : 3 lignes rouges visibles

### Bouton "Rompre le combat"

Dans `UnitInspector` (section après "Ordres") si `selectedUnit.engagedWith.length > 0` :

```
[ ⚔  Engagé en mêlée avec : Infanterie Rouges (T2) ]

[ ⚠  Rompre le combat ]
   Coût : 10 % de l'effectif (laissés au front).
   Action consommée pour ce tour.
```

Si multi-engagement : 1 ligne par paire, 1 bouton "Rompre tout" (rompt simultanément les N engagements, coût cumule 10 % × N ? Ou plafonné ? — à trancher).

### Logs combat continu

`CombatResultPanel` reçoit des notifications "ATTRITION T3" en plus des "MÊLÉE T1 / RIPOSTE T1" classiques :

```
ATTRITION T3 · INFANTERIE BLEUS engagée avec INFANTERIE ROUGES
  Morts au combat : 14
  Blessés : 8
  Soldats restants : 778
  Tour 3 d'engagement
```

## 9. Découpage TASKs

### Vague A — Engine (1.5 jour)

| TASK | Fichiers OUT |
|---|---|
| A.1 Types | `engine/engagement/types.ts` (EngagementState, EngagementResolveResult) |
| A.2 Tick | `engine/engagement/tick.ts` (resolveTick : dégâts bilatéraux + relève 10 %) |
| A.3 Helpers | `engine/engagement/index.ts` (start, breakCombat, isEngagedWith) |
| A.4 Tests | `cohesion.test.ts` ~15 tests (relève, encerclement, fin) |

### Vague B — BDD + EF (2 jours)

| TASK | Fichiers OUT |
|---|---|
| B.1 Migration 015 | Table `engagements (id, game_id, unit_a_id, unit_b_id, started_turn, created_at)` + RLS membre + Realtime |
| B.2 EF handleEngage | `_handlers/handleEngage.ts` : INSERT engagement après attaque mêlée. Modifie handleAttack v1.2. |
| B.3 EF handleBreakCombat | `_handlers/handleBreakCombat.ts` : action `break_combat` → DELETE engagement + 10 % pertes. |
| B.4 resolve_turn v1.3 | Tick engagements actifs avant récup moral. Update units / DELETE engagement si dissolution. |
| B.5 Engine-port miroir | `_shared/engine-port/engagement/*` |

### Vague C — UI + Render (1 jour)

| TASK | Fichiers OUT |
|---|---|
| C.1 useEngagement | Hook qui expose `engagedPairs`, `breakCombat(unitId)` |
| C.2 UnitInspector v2.3 | Section "Engagé en mêlée" + bouton Rompre |
| C.3 useTacticalSelection v1.6 | Bloque "mouvement standard" si engagé. Force action Rompre/Retraite. |
| C.4 EngagementOverlay 3D | `render/effects/EngagementOverlay.tsx` : ligne rouge entre 2 pions + anneau pulsant |
| C.5 CombatResultPanel v3.2 | Type 'attrition' affiché en plus de 'melee'/'ranged'/'charge' |

### Vague D — Tests humain (0.5 jour)

5 scénarios :
1. **Combat 800 vs 400** : engagement initié bleu vers rouge. Durée 12-15 tours. Rouges s'épuisent.
2. **Encerclement** : I bleue 800 entourée 3 I rouges 400. Brisée en 7-10 tours.
3. **Cav réussite** : C bleue charge inf rouge → la brise → cav libre poursuit.
4. **Cav choix après impact** : C bleue charge inf rouge → tient → menu Rester vs Replier (tester les 2).
5. **Rupture coûteuse** : I 700/800 engagée → Rompre → −70 hommes → 630 restants, libre.

## 10. Estimation totale

**~5 jours** (Vague A 1.5 + B 2 + C 1 + D 0.5).

Pas de migration BDD blocante (la table `engagements` ne dépend pas des Phases précédentes). Compatible Phase 2.5 moral-cohésion (synergique).

## 11. Décisions actées (11/05/2026)

1. **Initiation engagement** : volontaire (clic) — pas d'auto, permet contournement
2. **Relève réserves** : **10 %** des hommes hors contact remontent par tour
3. **Rompre le combat** : **coût fixe 10 % effective** (option A — simple, prévisible)
4. **Cavalerie** : charge ponctuelle inchangée. Après impact : menu Rester (mêlée avec malus def×0.8 + attrition ×1.3) vs Replier (gratuit, 1 hex arrière)
5. **Tir ranged** : pas d'engagement auto. Pas de tir à distance 1. Engagement forcé seulement si attaquant adjacent clique "Engager mêlée"

## 12. Open questions

- [ ] **Multi-engagement rupture** : un pion encerclé qui clique "Rompre tout" → coût = 10 % × N engagements (max 30 % ?) ou plafond 20 % ?
- [ ] **Variance attrition** : ±5 % (déterministe) ou conserver ±15 % comme Phase 2 (plus dramatique) ?
- [ ] **Engagement vs ZdC** : un engagement consomme-t-il automatiquement la ZdC (déjà active) ou s'ajoute-t-il ?
- [ ] **Tireur engagé qui veut rompre** : peut-il fuir arrière comme une mêlée, ou est-il "scellé" jusqu'à dissolution ? (probablement comme mêlée, à confirmer)
- [ ] **Bot IA** (Phase 4) : comment gérer les engagements ? Heuristique d'évaluation à concevoir Phase 4 quand on aborde l'IA.

## 13. Liens

- `docs/PLAN-MORAL-COHESION.md` (Phase 2.5 — synergie moral × engagement)
- `docs/COMBAT-V2.md` (référence règles Phase 2 — engagement étend ces règles)
- `engine/combat/v2/` (base réutilisée pour calcul dégâts par tick)
- `PLAN-MASTER-CHECKLIST.md` (à MAJ avec Phase 2.6)
