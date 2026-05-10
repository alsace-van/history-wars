# BACKLOG — Effectif critique et débandade

**Phase d'intégration cible** : Phase 4 (mécaniques avancées combat) + Phase 5 (logistique post-bataille).

Session brainstorm du 10/05/2026 — comportement d'un régiment quand il fond, mécanismes de panique, fuite, effet domino, récupération post-bataille.

---

## 1. Seuils d'effectif critique

Le comportement d'un régiment change automatiquement à mesure qu'il fond — pas juste ses stats, son **comportement**.

| Effectif restant | État | Comportement |
|---|---|---|
| 100% → 50% | Normal | Discipline tient, comportement standard |
| 50% → 30% | **Ébranlé** | Moral baisse, cadence de tir réduite, refus de charger, tient la ligne |
| 30% → 15% | **Décimé** | Désertions ponctuelles (1-3 hommes/tour), refus d'avancer sous le feu |
| < 15% | **Débandade** | Événement de bascule (voir §2) |

### Modulateurs de seuil

| Facteur | Effet |
|---|---|
| Officier charismatique présent | Seuils décalés vers le bas (tient mieux) |
| Régiment de Garde / Élite | Panique à 5% au lieu de 15% |
| Conscrits frais (1813, levée tardive) | Panique dès 30% |
| Bataille défensive (terrain familier) | +10% résistance |
| Encerclé / pas de ligne de retraite | Soit panique totale, soit "carré désespéré" qui tient |
| Drapeau régimentaire perdu | -20% moral immédiat |

---

## 2. Événement de débandade (< 15% effectif)

Quand un régiment passe sous le seuil critique, un **événement de bascule** se déclenche avec trois issues automatiques (ou jet de dé selon goût RNG) :

- **40% des survivants désertent** → disparaissent de la carte, perdus pour toujours
- **40% refluent vers campement/hôpital** → récupérables, rejoignent le pool de réserve
- **20% se battent jusqu'au bout** → petit noyau dur, souvent les vétérans, qui meurt sur place

---

## 3. Direction de la fuite

Les fuyards ne courent pas n'importe où. Priorité de reflux :

1. **Campement / hôpital** s'il existe et est accessible
2. **Unité amie la plus proche** (risque de **contagion de panique**, voir §4)
3. **Bord de carte** s'ils sont coupés du campement → **désertion pure**

→ **L'emplacement du campement détermine combien de fuyards on récupère.**

---

## 4. Effet domino (propagation de panique)

Une unité qui panique près d'autres **propage la peur**. Test de moral pour toutes les unités amies dans un rayon de **50-100m**.

Mécanisme :
- Unité voisine vivante → jet de moral
- Test échoué → l'unité passe au seuil **inférieur** (Normal → Ébranlé, Ébranlé → Décimé, etc.)
- Test échoué critique → panique immédiate (saut de 2 niveaux)

C'est exactement comme ça que des batailles entières basculaient — pas par destruction totale, mais par **effondrement en chaîne** d'un flanc. **Iéna 1806, Waterloo 1815, Sedan 1870** : toutes décidées par cet effet.

### Modulateurs de l'effet domino

| Facteur | Effet sur la propagation |
|---|---|
| Unité voisine de la Garde | Très résistante au domino |
| Unité voisine déjà ébranlée | Bascule probable |
| Présence d'un général de division dans la zone | Bonus de résistance (-30% probabilité bascule) |
| Drapeau de l'unité voisine encore haut | Bonus moral résiduel |
| Plusieurs unités en panique à proximité | Effet cumulatif (chaque panique voisine ajoute une chance) |

---

## 5. Récupération post-bataille des fuyards

24h après la fin de la bataille, mini-phase logistique :

- **Cavalerie légère** envoyée sur le terrain pour récupérer les fuyards dispersés
- Selon **terrain, temps écoulé, présence ennemie** → récupération de **20-60%** des fuyards
- Les autres = **désertion réelle**, perdus définitivement

### Variables qui modulent la récupération

| Variable | Effet |
|---|---|
| Terrain ouvert (plaine) | Récupération facile (+15%) |
| Terrain accidenté (forêt, montagne) | Récupération difficile (-20%) |
| Délai depuis fin de bataille | Plus le temps passe, plus les fuyards désertent vraiment |
| Cavalerie ennemie active dans la zone | Risque d'interception (perte de la patrouille) |
| Hôpital proche du champ de bataille | Bonus (les fuyards ont déjà reflué naturellement) |
| Climat (pluie, froid extrême) | -25% (les fuyards meurent ou désertent plus vite) |

→ Les vainqueurs ramassent, les vaincus essaient de reformer ce qui peut l'être.

---

## 6. Marqueurs visuels d'état du régiment

Lecture immédiate par le joueur, **sans menu, sans tooltip**.

| Indicateur | Lecture |
|---|---|
| **Drapeau régimentaire haut, dressé** | Régiment normal ou ébranlé léger |
| **Drapeau penché** | Régiment décimé, encadrement vacillant |
| **Drapeau au sol / absent** | Encadrement détruit, panique imminente |
| **Pions qui s'éparpillent visuellement** | Débandade en cours |
| **Pions qui marchent en formation vers l'arrière** | Retraite ordonnée (≠ panique) |
| **Halo rouge sur le pion** | Sous le seuil critique 15% |

Le joueur lit l'état d'un coup d'œil. L'adversaire qui voit un drapeau penché sait que c'est le moment de **pousser sur ce flanc**.

---

## Lien avec les autres fiches

- **BACKLOG-encadrement-officiers** : l'algorithme **fusion vs panique vs retraite** est défini là-bas (dépend de la cohésion de commandement)
- **BACKLOG-blesses-systeme** : les fuyards qui refluent vers l'hôpital alimentent le pool de convalescents
- **BACKLOG-regiments-cohesion** (session précédente) : la fusion/reformatio est cohérente avec ces seuils

---

## Implications BDD

- `regiment_status` : enum (Normal / Ébranlé / Décimé / Débandade / Fusion / Retraite)
- `panic_propagation_log` : tracking des bascules en chaîne pour debugging et stats
- `post_battle_recovery` : table des fuyards et leur récupération

---

## Points encore à trancher

- Valeurs exactes des seuils par type d'unité (recrues vs élite vs Garde)
- Effet exact des modulateurs (% précis)
- Rayon exact de propagation de panique (50m ? 100m ? variable selon terrain ?)
- Probabilité du test de moral dans le domino (fixe ou modulée par cohésion ?)
- Mécanique précise de récupération (auto, ou action joueur explicite ?)
- Risque de la cavalerie de récupération (peut-elle être interceptée ?)
- Visuel exact "drapeau penché" (animation 3D, modèle alternatif, etc.)
