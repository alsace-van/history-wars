# BACKLOG — Index session "blessés, encadrement, prisonniers, conseillers"

Session du 10/05/2026. 5 fiches produites, à uploader dans le project knowledge TACTICA pour les prochaines sessions.

## Les 5 fiches

| # | Fiche | Contenu | Phase d'intégration |
|---|---|---|---|
| 1 | `BACKLOG-blesses-systeme.md` | 3 états (KIA/Invalide/Récupérable), ratios par époque, hôpital comme hub, bataillons de marche, profil vétéran convalescent | Phase 4 + Phase 5 |
| 2 | `BACKLOG-effectif-critique.md` | Seuils 50/30/15%, débandade, fuite, effet domino, marqueurs visuels, récupération post-bataille | Phase 4 + Phase 5 |
| 3 | `BACKLOG-encadrement-officiers.md` | 3 niveaux d'encadrement (sous-off/officiers/EM), unités anti-encadrement, EM divisionnaire, algorithme fusion/panique/retraite | Phase 4 + Phase 5 |
| 4 | `BACKLOG-prisonniers-echanges.md` | 4e état "Capturé", évolution historique, 4 stratégies après capture, école d'officier, boucle régénération | Phase 4 + Phase 5 + campagne |
| 5 | `BACKLOG-conseillers.md` | Architecture 3 couches, 8 types, détecteurs, scoring, templates, asymétrie via fog of war, validation d'existence, MVP itératif | Phase 4 + Phase 6 |

## Décisions verrouillées dans cette session

### Sur les blessés
- 3 états distincts : KIA / Invalide / Récupérable (plus le 4e "Capturé" si officier)
- Ratios modulés par époque (médiéval 60-70% pertes définitives, Larrey 25-35%, 14-18 15-20%)
- Hôpital comme hub logistique avec pool de convalescents
- Bataillons de marche = précédent historique réel (Wagram 1809)
- Vétérans convalescents = profil glass cannon défensif unique

### Sur l'effectif critique
- Seuils 50% / 30% / 15% avec comportements distincts
- Débandade < 15% : 40% désertent / 40% refluent / 20% combattent à mort
- Effet domino dans rayon 50-100m
- Direction de fuite : campement > unité voisine > bord de carte
- Récupération post-bataille 20-60% selon conditions

### Sur l'encadrement
- 3 niveaux : sous-officiers (cohésion) / officiers subalternes (encadrement) / EM divisionnaire
- 2 niveaux d'EM seulement : divisionnaire (pion ciblable) + armée (joueur hors carte)
- Pas brigade (trop bas), pas corps d'armée (trop haut), division = sweet spot
- Unités anti-encadrement spécialisées : Voltigeurs / Tirailleurs / Rifles / Jäger
- Capacité spéciale "tir de précision sur encadrement"
- Marqueurs visuels via drapeau régimentaire (haut / penché / absent)
- Algorithme fusion vs panique vs retraite arbitré par cohésion de commandement

### Sur les prisonniers
- 4e état "Capturé" complémentaire des 3 états blessés
- Capture > Kill (effet moral 2x supérieur)
- 4 stratégies après capture : rançon / échange / parole / captivité
- 5 leviers historiques forcent à reprendre les officiers (moral, politique, économique, ressource non-combat)
- École d'officier comme boucle de régénération du capital humain
- Régulation par 5 leviers (plafond demande, spécialisation, capacité écoles, coûts décroissants, rôles alternatifs)
- Bénéfices immédiats en bataille pour ne pas frustrer le joueur (interrogatoire, choc moral, rançon express)

### Sur les conseillers
- Architecture en 3 couches (passif / réactif / proactif)
- 8 types de conseillers (5 pour bataille tactique, 3 pour campagne)
- 3 couches techniques : détecteurs / scoring / templates
- **RÈGLE D'OR** : validation d'existence (PHASE 0) avant tout conseil — pas d'envoi de conseils sur unités mortes
- Le silence est un état valide
- Asymétrie joueur via 5 leviers : fog of war + spécialisation + probabilité + délai + personnalité
- Anti-radotage par cooldown contextuel + tracking actions joueur
- Conflit entre conseillers comme mécanique d'arbitrage
- Apprentissage progressif des conseillers (4 niveaux)
- MVP itératif en 4 phases (commencer par UN seul conseiller bien fait)

## Synergie inter-fiches

```
Capture officier (Fiche 4)
        ↓
Récupération vétéran (Fiche 4)
        ↓
        ├──→ Conseiller au QG (Fiche 5)
        ├──→ Instructeur école (Fiche 4) → Junior officier (Fiche 4)
        ├──→ Gouverneur place forte (Fiche 4)
        └──→ Diplomate (Fiche 4)

Bataille avec EM divisionnaire (Fiche 3)
        ↓
Pertes en cours de combat (Fiche 1)
        ↓
Seuils critiques atteints (Fiche 2)
        ↓
Algorithme fusion/panique/retraite (Fiche 3)
        ↓
Fuyards refluent vers hôpital (Fiche 1) ou désertent (Fiche 2)
        ↓
Convalescents reformés en bataillon de marche (Fiche 1)
```

## Points encore à trancher (transversaux)

### Équilibrage chiffré
- Tous les pourcentages, seuils, rayons, durées proposés sont des suggestions à équilibrer en playtest
- Aucun chiffre n'est gravé dans le marbre

### Sur le MVP
- Quelle phase de TACTICA pour intégrer quoi en priorité ?
- Le MVP minimum viable : système de blessés à 3 états + seuils d'effectif critique + 1 conseiller (chef d'EM) ?
- Reste à arbitrer : conseiller MVP = chef d'EM ou maître d'artillerie ?

### Sur les visuels
- Modèles 3D des bandages et drapeaux penchés (effort de modélisation)
- Animation des fuyards, des fusions, des reformations
- UI du panneau de conseillers (taille, position, animations)

### Sur l'IA
- Combien de détecteurs raisonnables au démarrage par conseiller ?
- Comment équilibrer les pondérations de personnalité ?
- Comment tester que les conseils ne deviennent pas absurdes en playtest ?

## Comment utiliser ces fiches

À uploader dans le project knowledge TACTICA aux côtés des fiches existantes :

**Fiches existantes (session du 03/05/2026)** :
- `BACKLOG-INDEX.md` (l'ancien index)
- `BACKLOG-regiments-cohesion.md`
- `BACKLOG-formations.md`
- `BACKLOG-commandement-zonal.md`
- `BACKLOG-communication-ordres.md`
- `BACKLOG-points-meta.md`

**Fiches de cette session (session du 10/05/2026)** :
- `BACKLOG-INDEX-session-blesses-conseillers.md` (cet index)
- `BACKLOG-blesses-systeme.md`
- `BACKLOG-effectif-critique.md`
- `BACKLOG-encadrement-officiers.md`
- `BACKLOG-prisonniers-echanges.md`
- `BACKLOG-conseillers.md`

→ Au début de chaque future session sur TACTICA, ces fiches font partie du **corpus de référence** à lire pour comprendre les décisions de game design prises hors phase d'implémentation.

→ Le fichier `BACKLOG-blesses-encadrement.md` créé en début de session est **remplacé** par les 5 fiches granulaires de cette session — à archiver/supprimer du project knowledge.

## Mécaniques évoquées non développées (pour sessions futures)

- **Capture / massacre des prisonniers** selon époque (différence médiévale vs Genève)
- **Jauge "Invalides à charge"** comme pression politique long-terme
- **Modélisation gaz et blessures industrielles** pour 1914-18
- **Réputation médicale** d'un général qui broie ses hommes
- **Système d'évasion** pour officiers détenus
- **Cryptanalyse** entre conseillers espions adverses (lien avec BACKLOG-communication-ordres)
- **Hospitalisation différée** (gangrène qui se développe sur plusieurs jours)
