# BACKLOG — Régiments et cohésion

**Phase d'intégration cible** : Phase 1 (structure de base) + Phase 4 (mécaniques avancées).

## 1. Hiérarchie verrouillée à 4 niveaux

| Niveau | Définition | Visibilité jeu |
|---|---|---|
| **Homme** | 1 soldat individuel | Invisible, juste un compteur d'effectif |
| **Pion** | 1 hexagone sur la carte = 5 hommes | Visible, déplaçable |
| **Régiment** | N pions liés, type unique (infanterie OU cavalerie OU archers) | Identifié visuellement (couleur de bordure, étendard, numéro) |
| **Armée** | Ensemble des régiments d'un camp | Vue d'ensemble macro |

## 2. Règles structurelles du régiment

- **Type unique** : un régiment ne mélange jamais infanterie + cavalerie + archers. Chaque régiment est mono-type.
- **Commandant attitré** : chaque régiment est rattaché à un commandant (Phase 4). Le commandant cavalerie ne contrôle que les régiments de cavalerie de sa zone.
- **Moral et fatigue partagés** : les pions d'un même régiment partagent leur état moral et leur fatigue. Si 2 pions sur 6 tombent, les 4 restants subissent un malus moral collectif.
- **Lien visuel** : tous les pions d'un régiment portent une marque commune (couleur de bordure, numéro, étendard) → lisibilité immédiate.

## 3. Détachement (régiment sain → régiment sain)

Mécanique de **renfort tactique** ordonné par le commandant ou le général.

- **Quoi** : détacher 1-2 pions d'un régiment vers un régiment voisin (même équipe, même type compatible)
- **Délai** : X tours pour que le pion détaché rejoigne sa nouvelle unité
- **Coût** : pendant la transition, le pion détaché est en "cohésion réduite" (malus moral)
- **Type compatible obligatoire** : un pion d'archers ne peut pas renforcer une infanterie au corps-à-corps (métiers différents, pas le même équipement)
- **Limite** : un régiment ne peut pas descendre sous 50% de ses pions d'origine par détachement (cohésion régimentaire préservée)

## 4. Fusion / Reformatio (régiment décimé → régiment affaibli)

Mécanique de **survie** historiquement attestée (les Romains pratiquaient ça systématiquement).

- **Déclenchement** : un régiment sous un seuil critique (à définir, ~30% effectifs ou moins) peut fusionner avec un régiment ami
- **Conditions** :
  - Régiment hôte du **même type**
  - Hex adjacent ou à proximité immédiate
  - Régiment hôte également affaibli (sinon ça devient un détachement déguisé)
- **Effet** :
  - Les pions survivants fusionnent dans le régiment hôte
  - Le régiment décimé **disparaît** officiellement
  - Le régiment hôte garde son nom, son commandant, son étendard
  - **Pas de malus moral** pour les survivants — au contraire, petit bonus "frères d'armes" (ils retrouvent une structure)
- **Effet annexe sur les étendards** :
  - Si l'étendard du régiment décimé est **récupéré et porté avec** lors de la fusion → bonus moral camp entier
  - Si l'étendard est **perdu** (laissé sur le champ ou capturé par l'ennemi) → malus moral camp entier
  - Étendard capturé par l'ennemi → bonus moral énorme pour eux + matière narrative

## 5. Implications BDD

Tables à prévoir (Phase 1 pour la structure, enrichi en Phase 4) :

```sql
regiments
  id, game_id, owner_team, owner_commander_id,
  type ('infantry_light' | 'infantry_heavy' | 'infantry_elite' | 'cavalry' | 'archers' | ...),
  name, banner_id, morale, fatigue, cohesion,
  initial_pawn_count, current_pawn_count, status

pawns
  id, regiment_id, position_q, position_r, position_z,
  state ('active' | 'detached' | 'merging' | 'destroyed'),
  detach_target_regiment_id, detach_remaining_turns
```

## 6. Points à trancher plus tard

- Seuil exact de déclenchement de la reformatio : 30% ? 25% ? Variable selon type d'unité ?
- Coût en moral du détachement : combien exactement, et sur combien de tours ?
- Récupération d'un étendard ennemi : comment ça se déclenche mécaniquement ? (Pion adjacent à un étendard ennemi tombé pendant 1 tour ?)

## 7. Ce que ça apporte au jeu

- **Identité narrative** : "le 7e régiment a absorbé les survivants du 12e décimé à la colline" → matière forte pour les AAR (Phase 10).
- **Décisions de commandant** : laisser un régiment décimé combattre seul jusqu'au bout (héroïque mais inefficace) ou ordonner la retraite-fusion (pragmatique). Les deux ont du sens.
- **Système d'étendards** comme couche annexe : objet à protéger, à reprendre, à brandir. Très antique, très évocateur.
