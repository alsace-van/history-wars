# PLAN-MORAL-COHESION.md

> Refonte Phase 3 — moral, cohésion, soutien, états gradués (Nominal / Ébranlé / Brisé).
> Origine : soft-lock Session 16 (PR #27) — routed binaire trop brutal, pas de mécanique de soutien.

---

## 1. Score de cohésion

```
support     = count(alliés_non_brisés_rayon_1) + 0.5 × count(alliés_non_brisés_rayon_2)
supportNorm = min(1, support / 3)    // plafond 3

cohesion = 0.5 × (morale / moraleMax)
         + 0.3 × (effective / effectiveMax)
         + 0.2 × supportNorm
```

| État | Cohésion | Move | Attack | Récup moral |
|---|---|---|---|---|
| **Nominal** | > 0.5 | OK | OK | +5/tour standard |
| **Ébranlé** | 0.2 < c ≤ 0.5 | OK | OK + **modale confirmation** | +3/tour |
| **Brisé** | ≤ 0.2 | Retraite seule | **Reddition** seule | 0 si ZdC, +2 sinon |

## 2. Mécanique de soutien — effets

| Source | Effet |
|---|---|
| 1 allié rayon 1 | +1 récup moral fin tour, ×0.9 perte moral combat |
| 2 alliés rayon 1 | +2 récup, ×0.81 perte moral |
| 3+ alliés rayon 1 | +3 récup, ×0.7 perte moral (cumul max) |
| Allié rayon 2 (chacun) | +0.5 récup (max +1), ×0.95 perte moral (max ×0.85) |
| Cohésion | déjà inclus dans formule (`0.2 × supportNorm`) |

Une unité **isolée** (0 allié rayon 2) perd d'office 20% de cohésion → équivaut à 40% moral perdu.

## 3. Reconstitution (sortie de Brisé)

Sortie automatique de Brisé possible **uniquement si** :
- `effective ≥ effectiveReformThreshold[kind]`
- support ≥ 2
- hors ZdC ennemie
- cohesion remontée > 0.2 fin de tour

Sinon → reste Brisé jusqu'à action explicite :
- **Merge** avec autre unité (Phase 2 sizing existant) — recombine effectifs
- **Soin Infirmier** (Phase 3 à concevoir) — restaure effective wounded → effective
- **Retrait volontaire** (retreat hors-board) ou Reddition

```
effectiveReformThreshold = {
  I: 200,   // 25% de 800
  C: 45,    // 25% de 180
  A: 30,    // 25% de 120
}
```

## 4. Comportements UI

### État Ébranlé — modale confirmation attaque

Sur click "Attaquer (mêlée/distance)" :
```
⚠️ Sous-effectif détecté
Votre unité a perdu X% de ses hommes. Une attaque conjointe
(cavalerie + infanterie, ou flanking) augmenterait vos chances.
Confirmer l'attaque ?

[Annuler]  [Attaquer quand même]

☐ Ne plus afficher cet avertissement
```

Préférence persistée dans `useSettings` (localStorage `skipShakenWarning`).

### État Brisé — panneau action critique

UnitInspector remplace "Ordres disponibles" par **"État critique"** :

```
🏳️ UNITÉ BRISÉE — discipline rompue

• Battre en retraite  → choisir direction (1 hex parmi voisins libres)
                        Désertion = round(effective × tauxPertes × 0.2) hommes
                        Si après désertion effective < effectiveMin → unité dissoute
                        Si tous voisins libres pointent vers l'intérieur → choix au joueur
                        Si tous voisins occupés ennemis → reddition forcée

• Se rendre           → unité éliminée
                        +10 moral sur toutes les unités du camp adverse
                        -10 moral sur toutes les autres unités du camp qui se rend
                        (effet "chaîne de redditions" historique — Sedan 1870, Stalingrad)
```

#### Calcul désertion retraite (v2 — seuil pertes 50%)

Distinction **repli stratégique** (pertes < 50% → pas de désertion, c'est un mouvement tactique propre dans un plan de bataille) vs **repli panique** (pertes ≥ 50% → désertion progressive).

```
tauxPertes  = (effectiveMax - effective) / effectiveMax
seuilPanique = 0.5

si tauxPertes < seuilPanique → desertion = 0
sinon                        → desertion = round(effective × (tauxPertes - seuilPanique))

nouvelEffectif = effective - desertion
si nouvelEffectif < effectiveMin → unité dissoute (les déserteurs emportent l'unité)
```

Exemples (kind I, effectiveMin=100) :

| Effectif | Pertes | Type repli | Désertion | Restant |
|---|---|---|---|---|
| 700/800 | 12% | stratégique | 0 | 700 |
| 500/800 | 37% | stratégique | 0 | 500 |
| 400/800 | 50% | limite (juste sous seuil) | 0 | 400 |
| 354/800 | 56% | panique légère | 21 (6%) | 333 |
| 200/800 | 75% | panique sévère | 50 (25%) | 150 |
| 150/800 | 81% | panique sévère | 47 (31%) | 103 (frôle min) |
| 100/800 | 87% | panique totale | 37 (37%) | 63 < 100 → **unité dissoute** |

## 5. Système visuel (anneaux multi-couches)

Trois couches concentriques au sol sous l'unité :

### Couche 1 — Anneau d'état (permanent)

Pertes basées sur `effective / effectiveMax` :

| Couleur | Condition |
|---|---|
| **Vert** | pertes < 25% ET cohésion > 0.5 |
| **Jaune** | pertes 25-50% OU cohésion 0.4-0.5 |
| **Orange clair** | pertes 50-75% OU cohésion 0.25-0.4 |
| **Orange foncé** | pertes > 75% OU cohésion < 0.25 — clignotement subtil |

Opacité 0.4 (idle) → 0.8 (sélection ou hover).

### Couche 2 — Anneau de soutien (conditionnel)

| Style | Condition |
|---|---|
| Cercle **bleu fin** | support ≥ 1 |
| Cercle **bleu épais** | support ≥ 2 |
| Cercle **bleu brillant** (glow) | support = 3 |

Anneau au-dessus du sol (Y +0.05), subtil.

### Couche 3 — Anneau d'action (existant, hover/selection)

- **Ambre** : unité sélectionnée (existant)
- **Rouge** : ennemi targetable au hover (existant)

## 6. Effets stratégiques attendus

- **Lignes solidaires** : 3-4 unités alignées → cohésion stable, perte de moral lente
- **Encerclement** mortel : 0 allié + ZdC ennemies multiples → effondrement 2-3 tours
- **Charge cavalerie isolée** : risque haut (perte de soutien après pénétration)
- **Réserve groupée** : peut absorber les unités brisées par merge
- **Casquage** : briser une unité au milieu d'une ligne propage l'effondrement (perte support pour voisins)

## 7. Découpage TASKs

### Vague A — Engine pur (parallélisable)

| TASK | Fichiers OUT | Tests |
|---|---|---|
| A.1 Cohésion | `engine/cohesion/{types,index,compute}.ts` | 15 |
| A.2 Moral update | `engine/morale/morale.ts` (v1.1) | +5 régression |
| A.3 Combat update | `engine/combat/v2/contact.ts` (v1.2) — supportMult perte moral | +4 |

### Vague B — EF Deno (dépend de A)

| TASK | Fichiers OUT | Notes |
|---|---|---|
| B.1 Engine-port miroir | `_shared/engine-port/cohesion/*` + moral/contact MAJ | mirror exact |
| B.2 _common helpers | `_handlers/_common.ts` (computeSupportMap, getCohesionState) | utilitaires |
| B.3 handleAttack | reject si attacker.state === 'broken' (sauf retreat/surrender) | 1 nouveau code erreur |
| B.4 handleRetreat | `_handlers/handleRetreat.ts` (NEW) | move 1 hex vers bord |
| B.5 handleSurrender | `_handlers/handleSurrender.ts` (NEW) | DELETE unit + moral adversaire |
| B.6 resolve_turn | récup moral end-turn modulée support | |

### Vague C — UI / Render (dépend de A + B)

| TASK | Fichiers OUT | Notes |
|---|---|---|
| C.1 useTacticalSelection | revert hotfix v1.4 → check `cohesionState !== 'broken'` | |
| C.2 Game.tsx modale Ébranlé | dialog confirmation + skip-pref | useSettings update |
| C.3 UnitInspector | section État + actions Retraite/Reddition si Brisé | |
| C.4 UnitStatusRing | `render/effects/UnitStatusRing.tsx` (NEW) | couche 1 |
| C.5 UnitSupportRing | `render/effects/UnitSupportRing.tsx` (NEW) | couche 2 |
| C.6 TacticalScene wire | intégration 2 nouveaux anneaux | |

### Vague D — Tests humain / calibrage

5 scénarios :
1. **Reproduction soft-lock** Session 16 (354/800 moral 22 isolé) → Ébranlé, action possible
2. **Encerclement** I 800 vs 4 × I 400 autour → effondrement 3 tours
3. **Ligne stable** 3 I bleues alignées vs 3 I rouges → équilibre, érosion lente
4. **Charge cav profonde** C bleue charge → encerclée → Brisée → Reddition
5. **Reconstitution merge** I 100/800 Brisée + I 600/800 saine adjacentes → merge → I 700/800 Ébranlée

## 8. Migrations BDD

**Aucune migration obligatoire** — cohésion 100% dérivée de colonnes existantes (`morale`, `effective`, `effectiveMax`, positions).

Optionnel : colonne calculée `cohesion_state text` pour debug/admin, mais pas nécessaire MVP.

## 9. Estimation effort

- Vague A : 1 jour (engine + tests)
- Vague B : 1 jour (EF + miroir)
- Vague C : 1.5 jour (UI + render anneaux)
- Vague D : 0.5 jour (calibrage + ajustements)

**Total : ~4 jours** (1 phase Phase 3 sous-lot, après audit Phase 3 global).

## 10. Décisions actées

### 10/05/2026 — premier tour de questions
1. Rayon soutien : **1 + 2**
2. Plafond bonus : **3 alliés**
3. Pondération cohésion : **50/30/20** (moral/effectif/soutien)
4. Sortie Brisé : **conditionnée à l'effectif** (seuil reformThreshold 25%)
5. Anneau état : **vert/jaune/orange clair/orange foncé** + cercle bleu soutien superposé

### 11/05/2026 — second tour de questions
6. Reddition : **+10 moral camp adverse (toutes unités) ET −10 moral camp qui se rend** (toutes autres unités). Effet "chaîne d'effondrement" dramatique et historique.
7. Retraite : **direction choisie par le joueur** (1 hex parmi voisins libres). Pénalité désertion appliquée seulement si **pertes ≥ 50%** (repli panique). Sinon pas de désertion (repli stratégique).
8. Recalcul cohésion : **temps réel** (à chaque action), pas en fin de tour. Permet le sauvetage tactique : un renfort déplacé à côté d'une unité Ébranlée la rend immédiatement Nominal et utilisable dans le même tour. Côté code : cohésion dérivée via `useMemo`/recompute serveur, jamais stockée.

### 11/05/2026 — troisième tour (raffinement désertion)
9. **Désertion à la retraite** : seuil 50% pertes déclenche la désertion. Formule linéaire `effective × max(0, tauxPertes - 0.5)`. Sous 50% pertes = repli stratégique propre (aucune désertion). Au-dessus = panique progressive. Si désertion fait passer sous `effectiveMin` → unité dissoute pendant la retraite.

## 11. Open questions restantes

- [ ] **Calibrage final 50/30/20** vs alternatives — à valider Vague D tests humain. Mécaniques futures qui devront s'aligner : météo, fatigue, ravitaillement.
- [ ] **Reddition forcée** (tous voisins ennemis) : auto, ou modale "Capituler / Combat suicide" ? Le combat suicide serait une dernière attaque sans riposte possible (effet Thermopyle — peut quand même infliger des pertes).
- [ ] **Calibrage seuil 50%** : tester d'autres seuils (40% plus dur ? 60% plus tolérant ?) Vague D.
