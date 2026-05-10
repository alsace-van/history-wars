# BACKLOG — Système de blessés

**Phase d'intégration cible** : Phase 4 (mécaniques avancées combat) + Phase 5 (logistique/hôpital).

Session brainstorm du 10/05/2026 — gestion des pertes humaines selon l'époque, hôpital de campagne, vétérans convalescents.

---

## 1. Système à 3 états (au lieu du binaire mort/vivant)

| État | Ratio moyen | Effet en jeu |
|---|---|---|
| **KIA** (Killed In Action) | ~30% | Perte sèche, retiré définitivement |
| **Invalide** | ~30-40% | Vivant, sauvé, hors-service à vie (amputés, éborgnés) |
| **Récupérable** | ~30-40% | Revient au combat après convalescence |

**Pourquoi cette distinction matters** : un soldat amputé est sauvé sur le plan humain, mais ne retournera jamais au front. Le coût humain réel d'une victoire devient lisible — gagner Austerlitz peut coûter 4000 vétérans définitivement, vivants mais hors-jeu.

**Implication mode campagne** : jauge **"Invalides à charge"** comme pression politique long-terme (Invalides de Paris, Louis XIV, 1670). À creuser plus tard, pas pour le MVP.

---

## 2. Modulation du service de santé par époque

Le ratio KIA / Invalide / Récupérable **dépend de l'époque**. C'est un paramètre historique qui change profondément la valeur stratégique de chaque homme.

| Période | % pertes définitives | Doctrine médicale |
|---|---|---|
| **Médiéval → 1700** | 60-70% | Aucun service organisé. Pillage des blessés. Survie = chance + camarades |
| **1700 → 1792** | 40-50% | Hôpitaux fixes en ville. Évacuation par musiciens/tambours improvisés |
| **1792 → 1815** | 25-35% | Larrey + Percy : ambulances volantes, triage, despotats Percy (100 brancardiers/division) |
| **1815 → 1860** | 40% | Régression Bourbons. Crimée chaotique. Florence Nightingale côté anglais |
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

## Implications BDD

### Nouvelles tables / colonnes potentielles

- `casualties_log` : tracking par bataille de chaque homme touché (KIA / invalide / récupérable)
- `hospital_pool` : pool de convalescents par hôpital, avec délai de retour
- `marche_battalions` : bataillons de marche reformés à partir des convalescents
- `era_medical_config` : table de config par époque pour les ratios et paramètres

### Lien avec les fiches existantes

- **BACKLOG-effectif-critique** : la direction de fuite vers l'hôpital influence le pool de convalescents
- **BACKLOG-encadrement-officiers** : les médecins/Larrey peuvent devenir conseillers spécialisés (cf. BACKLOG-conseillers)

---

## Points encore à trancher

- Ratios exacts KIA/Invalide/Récupérable par époque (à équilibrer en playtest)
- Délai de convalescence par gravité de blessure (1 tour ? 5 tours ? 1 bataille entière ?)
- Modélisation de la "gravité" : 2 niveaux (léger/grave) ou 3 (léger/moyen/grave) ?
- Seuil minimal pour reformer un bataillon de marche (200, 500, 1000 hommes ?)
- Coût de ravitaillement de l'hôpital
- Mécanique exacte de capture de l'hôpital (raid cosaques) : événement scripté ou émergent ?
- Bonus mentorat exact (% XP/tour, durée d'attachement minimum)
- Visuel 3D des bandages : prioritaire ou cosmétique tardif ?

---

## Mécaniques évoquées non développées

À creuser dans des sessions futures :

- **Jauge "Invalides à charge"** mode campagne (pression politique long-terme)
- **Modélisation gaz et blessures industrielles** pour 1914-18
- **Hospitalisation différée** pour blessures longues (gangrène qui se développe sur 3-5 jours)
- **Réputation médicale** d'un général : un général qui "broie ses hommes" perd des points politiques même victorieux
