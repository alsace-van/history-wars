# BACKLOG — Encadrement et officiers

**Phase d'intégration cible** : Phase 4 (mécaniques avancées combat) + Phase 5 (commandement zonal).

Session brainstorm du 10/05/2026 — architecture de l'encadrement militaire à 3 niveaux, état-major divisionnaire, unités spécialisées anti-encadrement, algorithme fusion/panique/retraite.

---

## 1. Architecture à 3 niveaux d'encadrement

```
RÉGIMENT (pion unique sur la carte)
├── Soldats : effectif visible
├── Sous-officiers (caporaux, sergents) : jauge "cohésion"
│       → Ciblable par tirailleurs (capacité spéciale)
└── Officiers subalternes (lieutenants, capitaines, colonel) : jauge "encadrement"
        → Ciblable par tirailleurs (capacité spéciale)

UNITÉS SPÉCIALISÉES (régiments dédiés anti-encadrement)
├── Voltigeurs (français, créés 1804)
├── Tirailleurs
├── Rifles (britanniques, 95th Foot, Baker rifle)
└── Jäger (prussiens, autrichiens)
        → Capacité : "tir de précision sur encadrement"
        → Mortalité officier 3x supérieure documentée à Waterloo

ÉTAT-MAJOR (pion séparé sur la carte)
├── Niveau A : EM divisionnaire (visible, ciblable)
└── Niveau B : Commandement d'armée (le joueur, hors carte)
```

---

## 2. Détail des fonctions d'encadrement intégrées au régiment

| Rôle | Grades | Fonction tactique |
|---|---|---|
| **Sous-officiers** | Caporal, sergent, sergent-major | **Cohésion immédiate** : tenir la ligne, donner les cadences de tir, gueuler "serrez les rangs !", remplacer un officier tombé |
| **Officiers subalternes** | Lieutenant, capitaine, chef de bataillon, colonel | **Tactique locale** : décider quand charger, quand former le carré, ajuster la position face à la menace |

Les **sergents** étaient le **squelette du régiment**. Sans eux, la troupe se disperse en 30 secondes. *"Les officiers gagnent les batailles, les sergents gagnent les guerres."*

---

## 3. Unités spécialisées anti-encadrement

### Validation historique

- **Voltigeurs français** (créés 1804 par Napoléon) : compagnie légère par bataillon, mission explicite de **harceler les officiers ennemis** depuis le couvert
- **Rifles britanniques** (95th Foot, 60th Foot, fusil Baker) : précision à 200m vs 80m pour le mousquet standard. À Vitoria et Waterloo, **mortalité officier française 3x supérieure** face aux Rifles
- **Jäger prussiens et autrichiens** : équivalent germanique, recrutés parmi les chasseurs et garde-chasses civils, déjà excellents tireurs

### Mécanique en jeu

- **Capacité spéciale** : *"Tir de précision sur encadrement"*
- Disponible uniquement pour ces unités spécialisées (pas l'infanterie de ligne)
- Portée réduite, précision aléatoire, long cooldown
- Effet en cas de réussite :
  - -30% cohésion immédiate du régiment cible
  - -10% moral
  - Risque de désertions ponctuelles
- Effet en cas d'échec : tir normal, dégâts standards

### Choix de doctrine pour le joueur

→ Envoyer les voltigeurs **tuer** un officier (KIA simple, gain modéré) ou tenter une **charge de cavalerie pour le capturer** vivant (gain maximal mais opération risquée). Cf. BACKLOG-prisonniers-echanges.

---

## 4. État-major divisionnaire (Niveau A)

### Composition

- **1 général de division + escorte** (10-30 hommes)
- Pion visible sur la carte
- Coordonne 3-5 régiments d'une même division
- **Ciblable, capturable, peut être tué**

### Portée de commandement

- **Rayon ~600m** d'effet bonus moral/cohésion
- Régiment **dans le rayon** → bonus moral, cohésion, transmission d'ordres rapide
- Régiment **hors du rayon** → mode **"autonomie limitée"** :
  - Continue son dernier ordre reçu
  - Pas de bonus EM
  - Seuil de panique abaissé
  - Cohésion baisse plus vite

### Pourquoi 2 niveaux d'EM seulement (et pas 3 ou 4)

- **Pas brigade** : trop bas, multiplierait les pions EM (4-5 par armée), carte saturée
- **Pas corps d'armée** : trop haut, un seul corps = 15-20 régiments, portée de commandement floue
- **Division = sweet spot historique** : c'est l'unité tactique de base de la Grande Armée. Échelle où un général voit encore son champ de bataille à l'œil nu

### Conséquences de la mort/capture du général de division

À trancher selon goût de design :
- Game over partiel ?
- Malus massif moral camp entier ?
- Promotion automatique d'un colonel sur place ?
- Capture = bonus politique pour l'ennemi ? (cf. BACKLOG-prisonniers-echanges)

---

## 5. Commandement d'armée (Niveau B)

- C'est **le joueur lui-même**, hors carte
- Donne les ordres aux EM divisionnaires via les **messagers / aides de camp** (cf. BACKLOG-communication-ordres existant)
- Pas de pion physique à protéger en bataille standard
- **Exception** : scénarios spéciaux où le commandant suprême est sur le champ (Napoléon à Waterloo, Wellington à La Haye Sainte) → pion vulnérable spécial

---

## 6. Algorithme Fusion vs Panique vs Retraite

Quand une unité passe sous le seuil critique (cf. BACKLOG-effectif-critique), **trois mécaniques peuvent se déclencher**. L'arbitre est la **cohésion de commandement**.

### Algorithme de décision

```
SI officier vivant ET cohésion > 50% ET unité amie à portée:
    → FUSION ordonnée (les survivants rejoignent l'unité voisine)
SI officier vivant ET cohésion < 50%:
    → RETRAITE ORDONNÉE vers campement
SI officiers morts OU cohésion < 20%:
    → PANIQUE (effet domino + désertions)
```

### Variables qui décident

1. **Présence d'officier vivant** dans le rayon de commandement
2. **Cohésion résiduelle** (jauge invisible, baisse à chaque tour sous le feu, indépendamment des pertes)
3. **Continuité de la chaîne d'ordres** avec l'EM divisionnaire

### Levier tactique pour le joueur

- **Anticiper et provoquer une fusion** → rapprocher volontairement deux régiments affaiblis avant la rupture. Manœuvre active, pas un événement subi.
- **Tuer les officiers ennemis** devient un objectif prioritaire — pas pour le bonus, mais parce que ça **transforme une fusion potentielle en panique garantie**.
- La cavalerie qui charge un état-major n'est plus un détail, c'est un **levier de basculement** d'une bataille entière.

### Règles de fusion

- Survivants rejoignent une unité **du même type** (infanterie ligne → infanterie ligne, pas vers cavalerie)
- Préférence : **régiment de la même brigade** si dispo
- Unité d'accueil **gagne en effectif** mais **perd en cohésion** (-10 à -20%) — l'intégration n'est pas instantanée
- Le **drapeau du régiment fusionné est sauvé** (récupéré par l'autre régiment) ou **perdu** selon les conditions de fusion

### Validation historique

À Waterloo, plusieurs régiments français se sont **agglomérés en formations de fortune** dans la phase finale (la "masse" qui résiste autour du dernier carré de la Garde). Pendant que d'autres unités, sans officier, **s'évaporaient** sans combattre. Même bataille, même moment, **deux comportements opposés selon la cohésion de commandement**.

---

## 7. Marqueurs visuels d'état d'encadrement

Lecture immédiate par le joueur, **sans menu, sans tooltip**.

| Drapeau du régiment | État d'encadrement |
|---|---|
| **Coloré, dressé** | État-major intact, tout va bien |
| **Penché** | Officier blessé/manquant, encadrement fragile |
| **Absent / tombé** | Encadrement détruit, panique imminente |

Réalisme total : on ne voyait pas chaque officier individuellement à 500m, mais on voyait **si le drapeau régimentaire flottait**. C'est ce qui galvanisait ou démoralisait.

---

## 8. Évolution selon l'époque

| Période | Structure d'encadrement |
|---|---|
| **Médiéval** | Pas de sous-officiers formels. Seigneur + sa mesnie. Cohésion = loyauté féodale. |
| **Louis XIV → 1789** | Émergence des sous-officiers professionnels. Hiérarchie codifiée. |
| **Napoléon** | Structure mature, voltigeurs, EM organisé, écoles d'officiers (Saint-Cyr 1802) |
| **1860+** | Télégraphe arrive → l'aide de camp à cheval cède la place au câble |
| **1914-18** | Téléphone de campagne, mais coupé par l'artillerie → retombée sur agents de liaison à pied |

---

## Lien avec les autres fiches

- **BACKLOG-effectif-critique** : les seuils déclenchent l'algorithme fusion/panique/retraite défini ici
- **BACKLOG-communication-ordres** (session précédente) : les aides de camp/messagers sont la chaîne de transmission entre l'EM et les régiments
- **BACKLOG-prisonniers-echanges** : capture vs kill des officiers ouvre une mécanique distincte
- **BACKLOG-conseillers** : les vétérans récupérés peuvent devenir conseillers spécialisés au QG

---

## Implications BDD

- `regiment_cohesion` : jauge cohésion (sous-officiers)
- `regiment_encadrement` : jauge officiers
- `division_staff` : pion EM divisionnaire avec position, escorte, statut
- `commander_link` : table de liaison régiment ↔ EM divisionnaire (rayon de commandement actif)

---

## Points encore à trancher

- Rayon de commandement exact (600m c'est une suggestion, à équilibrer)
- Conséquence précise de la mort du général de division
- Visuel du pion EM (taille, couleur, distinguer général vs aides de camp)
- Mécanique précise de "tir de précision" : ciblable par le joueur ou auto par l'IA des voltigeurs ?
- Cooldown exact du tir de précision
- Effet exact d'un encadrement à 0% (panique automatique ? désertion immédiate ?)
