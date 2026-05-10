# BACKLOG — Index session brainstorm "commandement et formations"

Session du 03/05/2026. 5 fiches produites, à uploader dans le project knowledge TACTICA pour les prochaines sessions.

## Les 5 fiches

| # | Fiche | Contenu | Phase d'intégration |
|---|---|---|---|
| 1 | `BACKLOG-regiments-cohesion.md` | Hiérarchie homme/pion/régiment/armée, détachement, fusion-reformatio, étendards | Phase 1 + Phase 4 |
| 2 | `BACKLOG-formations.md` | Catalogue formations (ligne, colonne, carré, testudo, coin, phalange...), coûts de transition par effectif, formations par type | Phase 1 + Phase 4 |
| 3 | `BACKLOG-commandement-zonal.md` | Découpage Front/Flancs en 2v2, évolution selon taille équipe, réserve personnelle du général, réaffectation de régiment | Phase 4 |
| 4 | `BACKLOG-communication-ordres.md` | Messagers physiques, tournées multi-ordres, modes oral/clair/codé, interception, cryptanalyse | Phase 4 + Phase 8 |
| 5 | `BACKLOG-points-meta.md` | Système de bonus/pénalités plan respecté/ignoré/sauvé, moral / score fin / réputation | Phase 4 + Phase 10 |

## Décisions verrouillées dans cette session

- Hiérarchie à 4 niveaux : homme / pion (5 hommes / 1 hex) / régiment (N pions, type unique) / armée
- Régiments à cohésion forte (pas de pions baladeurs)
- Détachement possible entre régiments compatibles, avec coût en délai et moral
- Fusion / reformatio possible quand régiment décimé, sans malus moral (au contraire)
- Système d'étendards comme objet narratif et tactique (à protéger, à reprendre, à brandir)
- Découpage 2v2 par zone (Front / Flancs+Arrière) plutôt que par type de troupes
- Le général a une réserve personnelle à lui (2-3 régiments d'élite, type cohors praetoria)
- Format évolutif : zonal en MVP, par type pour les grandes équipes (4v4+)
- Réaffectation d'un régiment d'un commandant à un autre = coût en délai + 1 tour de désorganisation
- Briefing initial = ordres validés exécutés au tour 1 sans délai
- Messagers physiques sur la carte, tournées multi-ordres
- 1 messager indisponible jusqu'à son retour à la base
- Interception possible avec 3 issues (tué / capturé / échappé)
- Si messager intercepté avec message en clair, l'ennemi lit
- Modes de protection : oral / écrit clair / écrit codé / codé+leurre
- Cryptanalyse : code cassable au bout de N messages codés interceptés
- Côté camp émetteur : modèle mixte (on sait qu'il n'est pas revenu, on ne sait pas pourquoi immédiatement)
- 3 niveaux de scoring distincts : moral en partie / score fin de bataille / réputation persistante
- Le scoring récompense planification, discipline, initiative intelligente, vigilance
- Garde-fous anti-farming et anti-bash de coéquipier

## Points encore à trancher (listés dans les fiches)

### Sur les régiments et la cohésion
- Seuil exact de déclenchement de la reformatio (30% ? 25% ?)
- Coût exact en moral du détachement
- Mécanique précise de récupération d'un étendard ennemi

### Sur les formations
- Liste finale des formations par type pour le MVP
- Valeurs exactes des modificateurs ATK/DEF par formation
- Visuel testudo : Option A (4 hex avec toit étendu) ou Option B (fusion en 1 hex unique)

### Sur le commandement zonal
- Taille exacte de la réserve personnelle du général
- Conséquence exacte de la mort du général (game over ? Malus massif ? Promotion ?)
- Mécanique précise de l'engagement de la réserve

### Sur la communication
- Remontée d'info commandant → général : Option A (full incertitude par messager) ou Option B (vue temps réel) ?
- Nombre exact de messagers par rôle
- Probabilités d'interception
- Nombre de messages codés à intercepter pour casser un code

### Sur les points méta
- Valeurs exactes des bonus/malus
- Algorithme précis du score de fin
- Liste finale des tags de réputation
- Visibilité publique vs. privée de certains tags

## Prochaines pistes de brainstorm évoquées (pas creusées)

- Catalogue exact des unités antiques (velites / hastati / principes / triarii / equites / auxilia)
- Style graphique des sprites (4 directions stylistiques esquissées via images)
- Moral collectif / héros / champions
- Conditions météo dynamiques

## Comment utiliser ces fiches

À uploader dans le project knowledge TACTICA aux côtés des 4 fichiers existants (`00-README`, `01-AUDIT`, `02-PLAN-MASTER`, `03-PHASE-0-FOUNDATIONS`).

Au début de chaque future session sur TACTICA, ces fiches font partie du corpus de référence à lire pour comprendre les décisions de game design prises hors phase d'implémentation.
