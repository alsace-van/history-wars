# BACKLOG — Blessés, encadrement et effondrement

**Phase d'intégration cible** : Phase 4 (mécaniques avancées combat) + Phase 5 (logistique/hôpital) + mode campagne pour les conséquences long-terme.

Session brainstorm du 10/05/2026 — historique et game design des pertes humaines, du service de santé, et de la chaîne de commandement.

---

## 1. Système de blessés à 3 états

Remplacer le binaire **mort / vivant** par **trois issues distinctes** pour chaque homme touché.

| État | Ratio moyen | Effet en jeu |
|---|---|---|
| **KIA** (Killed In Action) | ~30% | Perte sèche, retiré définitivement |
| **Invalide** | ~30-40% | Vivant, sauvé, hors-service à vie (amputés, éborgnés, poumon perforé) |
| **Récupérable** | ~30-40% | Revient au combat après convalescence |

**Pourquoi cette distinction matters** : un soldat amputé est sauvé sur le plan humain, mais ne retournera jamais au front. Le coût humain réel d'une victoire devient lisible — on peut gagner Austerlitz et perdre 4000 vétérans définitivement, vivants mais hors-jeu.

**Implication mode campagne** : les invalides peuvent peser sur l'économie/moral de la nation (Invalides de Paris, Louis XIV, 1670). Jauge **"Invalides à charge"** comme pression politique long-terme. À creuser plus tard, pas pour le MVP.

---

## 2. Modulation du service de santé par époque

Le ratio KIA / Invalide / Récupérable **dépend de l'époque**. C'est un paramètre historique qui change profondément la valeur stratégique de chaque homme.

| Période | % pertes définitives | Doctrine médicale |
|---|---|---|
| **Médiéval → 1700** | 60-70% | Aucun service organisé. Pillage des blessés. Survie = chance + camarades |
| **1700 → 1792** | 40-50% | Hôpitaux fixes en ville. Évacuation par musiciens/tambours improvisés |
| **1792 → 1815** | 25-35% | Larrey + Percy : ambulances volantes, triage, despotats Percy (100 brancardiers/division) |
| **1815 → 1860** | 40% | Régression Bourbons. Crimée chaotique. Naissance Florence Nightingale côté anglais |
| **1860 → 1900** | 20-25% | Croix-Rouge (1863), antisepsie Lister (1867), anesthésie généralisée |
| **1914-1918** | 15-20% | Trains sanitaires, chirurgie de l'avant (Depage), transfusion sanguine (1917) |

### Paramètres modulables par époque

- `medicalDoctrineEra` → multiplicateur taux de récupération
- `evacuationSpeed` (charrette paysanne 2 km/h → ambulance volante 8 km/h → train sanitaire)
- `triageEnabled` (false avant 1792, true après — priorise gravité au lieu de grade)
- `frontlineSurgery` (false avant 1792, true après — réduit la fenêtre critique)
- `stretcherBearersPerDivision` (0 → 100 sous Percy → 200+ en 14-18)

### Détail "social" exploitable

Avant 1792, **l'officier blessé a une survie nettement meilleure** (on vient le chercher en priorité). Après Larrey, c'est le triage médical qui prime — un grognard en hémorragie passe avant un colonel avec une jambe cassée. Petit clin d'œil historique pour les bulles d'aide.

---

## 3. Hôpital comme hub logistique de réserve

L'hôpital de campagne **n'est pas un lieu où des hommes disparaissent**, mais un **point d'accumulation de convalescents** mobilisables.

### Mécanique

- Chaque blessé "récupérable" arrive à l'hôpital → délai de convalescence (X tours selon gravité)
- Convalescents sortis de l'infirmerie = **pool de soldats stationnés sur la tuile hôpital**
- À partir d'un seuil (200/500/1000 hommes selon échelle), reformation possible en **bataillon de réserve**
- Stat spéciale : moral +, XP conservée, mais endurance - au début

### Options de réintégration

- **Renvoyer aux régiments d'origine** : renfort de cohésion, mais éparpillé
- **Fusionner en bataillon "ad hoc"** : style Vieille Garde, vétérans toutes unités confondues, élite mais sans drapeau régimentaire

### Précédent historique

Les **dépôts de convalescents** existaient sous l'Empire. Après Wagram (1809), Napoléon a reformé des bataillons entiers à partir de blessés rétablis dans les hôpitaux de Vienne et de Bavière → **"bataillons de marche"**, unités provisoires de transit vers le front.

### Vulnérabilité de l'hôpital

- Capture par l'ennemi → **pool entier perdu** (prisonniers ou achevés selon époque)
- Besoin de ravitaillement (vivres, pansements) → ligne logistique à protéger
- Plus l'hôpital est gros, plus il est visible/ciblable
- **Précédent réel** : cosaques russes en 1812 ciblaient explicitement les hôpitaux français traînés dans la retraite, pour empêcher la régénération de la Grande Armée. **Très exploitable comme événement scripté.**

### Tactique induite

L'emplacement de l'hôpital devient une **décision stratégique** :
- Trop loin du front → blessés meurent en route
- Trop près → vulnérable à un raid
- Pas un détail logistique, un vrai choix tactique

---

## 4. Profil "Vétéran convalescent"

Les soldats sortis d'infirmerie ne sont **ni meilleurs ni pires** que des recrues fraîches — ils sont **différents**. Glass cannon défensif.

| Stat | Modificateur | Justification |
|---|---|---|
| HP max | -20 à -30% | Corps marqué, plaies récentes |
| Endurance | -25% | Fatigue rapide, souffle court |
| Vitesse de marche | -15% | Boitent, fatiguent |
| Dégâts | +15 à +25% | Sait viser, sait frapper, sang-froid |
| Précision tir | +20% | A déjà entendu le sifflement des balles |
| Moral | +30% | Survivants, ils ont déjà vu pire |
| Résistance déroute | élevée | Ne fuient pas pour un coup de canon |
| Cadence de tir | normale ou + | Réflexes acquis |

### Cas d'usage tactique

- **Tenir un pont** pendant que la ligne se replie
- **Garder un flanc** contre charge de cavalerie (carré, ne fuient pas)
- **Embuscade** depuis bois ou village fortifié
- **Réserve de moral** — leur seule présence remonte le moral des unités voisines

### À éviter

- Charge à la baïonnette (endurance + HP trop faibles)
- Marche forcée longue distance
- Position exposée sans couverture

### Identité visuelle

- Uniformes rapiécés, dépareillés (mix de plusieurs régiments)
- Bandages visibles sur certains modèles 3D (bras en écharpe, bandeau sur l'œil)
- Nom d'unité générique : *"1er Bataillon de Marche"*, *"Compagnie des Convalescents"*, *"Demi-brigade provisoire"*
- Drapeau improvisé ou aucun drapeau

### Mécanique de mentorat

Attacher un bataillon de marche à un régiment de bleus pendant X tours → **bonus XP passif aux recrues**. L'hôpital devient une **académie involontaire** : non seulement il régénère l'armée, il **transmet le savoir-faire** des anciens aux nouveaux.

---

## 5. Seuils d'effectif critique

Le comportement d'un régiment change automatiquement à mesure qu'il fond — pas juste ses stats, son **comportement**.

| Effectif restant | État | Comportement |
|---|---|---|
| 100% → 50% | Normal | Discipline tient, comportement standard |
| 50% → 30% | **Ébranlé** | Moral baisse, cadence de tir réduite, refus de charger, tient la ligne |
| 30% → 15% | **Décimé** | Désertions ponctuelles (1-3 hommes/tour), refus d'avancer sous le feu |
| < 15% | **Débandade** | Événement de bascule (voir §6) |

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

## 6. Événement de débandade (< 15% effectif)

Quand un régiment passe sous le seuil critique, un **événement de bascule** se déclenche avec trois issues automatiques (ou jet de dé selon goût RNG) :

- **40% des survivants désertent** → disparaissent de la carte, perdus pour toujours
- **40% refluent vers campement/hôpital** → récupérables, rejoignent le pool de réserve
- **20% se battent jusqu'au bout** → petit noyau dur, souvent les vétérans, qui meurt sur place

### Direction de la fuite

Les fuyards ne courent pas n'importe où. Priorité de reflux :

1. **Campement / hôpital** s'il existe et est accessible
2. **Unité amie la plus proche** (risque de **contagion de panique** !)
3. **Bord de carte** s'ils sont coupés du campement → **désertion pure**

→ **L'emplacement du campement détermine combien de fuyards on récupère.**

---

## 7. Effet domino (propagation de panique)

Une unité qui panique près d'autres **propage la peur**. Test de moral pour toutes les unités amies dans un rayon de 50-100m.

C'est exactement comme ça que des batailles entières basculaient — pas par destruction totale, mais par **effondrement en chaîne** d'un flanc. Iéna 1806, Waterloo 1815, Sedan 1870 : toutes décidées par cet effet.

---

## 8. Arbitrage Fusion vs Panique

Quand une unité passe sous le seuil critique, **deux mécaniques peuvent se déclencher** : la fusion ordonnée (positive) ou la panique (négative). L'arbitre est la **cohésion de commandement**.

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

## 9. Architecture de l'encadrement (3 niveaux)

```
RÉGIMENT (pion unique sur la carte)
├── Soldats : effectif visible
├── Sous-officiers (caporaux, sergents) : jauge "cohésion"
│       → Ciblable par tirailleurs (capacité spéciale)
└── Officiers subalternes (lieutenants, capitaines, colonel) : jauge "encadrement"
        → Ciblable par tirailleurs (capacité spéciale)

UNITÉS SPÉCIALISÉES (régiments dédiés)
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

### Pourquoi 2 niveaux d'EM seulement

- **Pas brigade** : trop bas, multiplierait les pions EM (4-5 par armée), carte saturée
- **Pas corps d'armée** : trop haut, un seul corps = 15-20 régiments, portée de commandement floue
- **Division = sweet spot historique** : c'est l'unité tactique de base de la Grande Armée. Échelle où un général voit encore son champ de bataille à l'œil nu

---

## 10. État-major divisionnaire

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

### Mort/capture du général

À trancher selon goût :
- Game over partiel ? Malus massif moral camp entier ?
- Promotion automatique d'un colonel sur place ?
- Capture = bonus politique pour l'ennemi ?

---

## 11. Marqueurs visuels d'état d'encadrement

Lecture immédiate par le joueur, **sans menu, sans tooltip**.

| Drapeau du régiment | État d'encadrement |
|---|---|
| **Coloré, dressé** | État-major intact, tout va bien |
| **Penché** | Officier blessé/manquant, encadrement fragile |
| **Absent / tombé** | Encadrement détruit, panique imminente |

Le joueur lit l'état d'un coup d'œil. L'adversaire qui voit un drapeau penché sait que c'est le moment de **pousser sur ce flanc**. Réalisme total : on ne voyait pas chaque officier individuellement à 500m, mais on voyait **si le drapeau régimentaire flottait**.

---

## 12. Récupération post-bataille des fuyards

24h après la fin de la bataille, mini-phase logistique :

- **Cavalerie légère** envoyée sur le terrain pour récupérer les fuyards dispersés
- Selon **terrain, temps écoulé, présence ennemie** → récupération de **20-60%** des fuyards
- Les autres = **désertion réelle**, perdus définitivement

→ Les vainqueurs ramassent, les vaincus essaient de reformer ce qui peut l'être.

---

## Implications BDD (à confirmer en phase d'implémentation)

### Nouvelles tables / colonnes potentielles

- `casualties_log` : tracking par bataille de chaque homme touché (KIA / invalide / récupérable)
- `hospital_pool` : pool de convalescents par hôpital, avec délai de retour
- `marche_battalions` : bataillons de marche reformés à partir des convalescents
- `regiment_cohesion` : jauge cohésion (déjà partiellement couverte par BACKLOG-regiments-cohesion)
- `regiment_encadrement` : jauge officiers/sous-officiers
- `era_medical_config` : table de config par époque pour les ratios et paramètres

### Lien avec les fiches existantes

- **BACKLOG-regiments-cohesion** : la fusion/reformatio y est déjà décrite, ce backlog l'enrichit avec l'arbitrage cohésion-de-commandement
- **BACKLOG-communication-ordres** : les messagers et la portée de commandement EM sont liés directement
- **BACKLOG-commandement-zonal** : la mort du général y est évoquée, à harmoniser

---

## Points encore à trancher

### Sur les blessés
- Ratios exacts KIA/Invalide/Récupérable par époque (les valeurs proposées sont des moyennes historiques, à équilibrer en playtest)
- Délai de convalescence par gravité de blessure (1 tour ? 5 tours ? 1 bataille entière ?)
- Modélisation de la "gravité" : 2 niveaux (léger/grave) ou 3 (léger/moyen/grave) ?

### Sur l'hôpital
- Seuil minimal pour reformer un bataillon de marche (200, 500, 1000 hommes ?)
- Coût de ravitaillement de l'hôpital
- Mécanique exacte de capture (raid cosaques) : événement scripté ou émergent ?

### Sur les vétérans convalescents
- Bonus mentorat exact (% XP/tour, durée d'attachement minimum)
- Visuel 3D des bandages : prioritaire ou cosmétique tardif ?

### Sur les seuils d'effectif
- Valeurs exactes par type d'unité (recrues vs élite vs Garde)
- Effet exact des modulateurs (% précis)

### Sur l'effet domino
- Rayon exact de propagation de panique (50m ? 100m ? variable selon terrain ?)
- Probabilité du test de moral (fixe ou modulée par cohésion ?)

### Sur l'EM divisionnaire
- Rayon de commandement exact (600m c'est une suggestion, à équilibrer)
- Conséquence précise de la mort du général
- Visuel du pion EM (taille, couleur, distinguer général vs aides de camp)

### Sur la récupération post-bataille
- Mécanique précise (auto, ou action joueur explicite ?)
- Risque de la cavalerie de récupération (peut être interceptée par cavalerie ennemie ?)

---

## Mécaniques évoquées mais non développées

À creuser dans des sessions futures :

- **Jauge "Invalides à charge"** mode campagne (pression politique long-terme)
- **Modélisation gaz et blessures industrielles** pour 1914-18
- **Capture de prisonniers** comme alternative au KIA (différent des fuyards désertés)
- **Hospitalisation différée** pour blessures longues (gangrène qui se développe sur 3-5 jours)
- **Réputation médicale** d'un général : un général qui "broie ses hommes" perd des points politiques même victorieux

---

## Validation historique du système global

Cette mécanique permet de simuler fidèlement :

- L'**après-Iéna** où la Grande Armée a fondu en convalescents reformés
- La **retraite de Russie 1812** où les hôpitaux étaient ciblés par les cosaques
- **Waterloo** où la cohésion de commandement a fait la différence dans la phase finale
- L'**effondrement à Sedan 1870** par effet domino, pas par destruction totale
- La **boucherie 14-18** où le ratio blessés/morts a explosé mais où les bataillons étaient reconstitués en quelques semaines grâce à l'évacuation industrielle

Le joueur ressent que **chaque homme compte différemment selon l'époque**, et que la victoire tactique n'est pas la même chose que la victoire stratégique.
