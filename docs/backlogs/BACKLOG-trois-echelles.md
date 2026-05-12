# BACKLOG — Architecture à 3 niveaux

**Phase d'intégration cible** : préparation Phase 0 + implémentation Phases 8 (opérationnel) et 9 (stratégique).

> Décision de design verrouillée le 03/05/2026. Document de référence pour toutes les futures discussions sur la mécanique multi-échelles.

## 1. Les 3 niveaux

### 1.1 Tableau récapitulatif

| Niveau | Échelle géographique | Hex size | Échelle temporelle | Ce qu'on y fait |
|---|---|---|---|---|
| **Stratégique (World)** | 50-200 km | ~5 km/hex | 1 jour / tour | Marche d'armée entre régions, gestion de campagne, ravitaillement long, stratégie globale, météo régionale |
| **Opérationnel (Theater)** | 5-20 km | ~500 m/hex | 10-30 min / tour | Convergence des forces, manœuvres de flanc, déploiement multi-engagements, artillerie longue portée, mouvements parallèles, transmission par messagers |
| **Tactique (Battle)** | 500 m - 2 km | ~10 m/hex | 1 min / tour | Combat hex à hex, formations, mêlée, charge, tirs, micro-décisions |

### 1.2 Pourquoi 3 niveaux et pas 2

La doctrine militaire distingue 3 niveaux de commandement (stratégique / opérationnel / tactique). Total War, Heroes, Songs of Conquest ont stratégique + tactique mais **sautent le milieu**. Le niveau opérationnel est précisément là où se jouent les batailles antiques :

- **Cannes (216 av. JC)** : la cavalerie numide d'Hannibal poursuit la cavalerie romaine **hors du champ tactique principal**, puis revient prendre l'infanterie romaine à revers. Sans niveau opérationnel, c'est juste un mouvement absurde "elle revient comme par magie".
- **Gaugamèles (331)** : Alexandre laisse délibérément un trou dans sa ligne pour attirer Darius, pendant que sa cavalerie compagnonne fait un mouvement large hors zone de combat principale.
- **Trasimène (217)** : embuscade qui n'a de sens qu'au niveau opérationnel — Hannibal positionne ses troupes hors-vue tactique.
- **Waterloo (1815)** : l'arrivée de Blücher en fin d'après-midi décide la bataille. C'est une force opérationnelle qui converge sur le tactique.

C'est exactement ce trou que TACTICA remplit.

## 2. Cas d'usage joueur du niveau opérationnel

Ce que le joueur peut faire qu'il ne pourrait pas faire sans niveau opérationnel :

1. **Combat tactique en cours au centre** + **manœuvre d'autres unités sur les flancs** au niveau opérationnel, en parallèle.
2. **Dézoomer pendant un combat** pour voir où sont les renforts, donner l'ordre à la cavalerie de prendre à revers, déployer l'artillerie longue portée.
3. **Plusieurs combats tactiques actifs en parallèle** sur le même théâtre opérationnel (l'ennemi attaque ton flanc droit pendant que toi tu attaques son flanc gauche, deux combats à gérer alternativement).
4. **Déployer de l'artillerie longue portée** (balistes, scorpions) qui tire entre tiles opérationnels sur un combat tactique en cours.
5. **Envoyer une troupe prendre à revers** un assaillant — qui prend X tours plausibles pour arriver, pas un mouvement instantané.
6. **Continuer à déployer d'autres troupes** au niveau opérationnel pendant qu'un combat tactique se déroule au centre.
7. **Recevoir des renforts** depuis la périphérie — convergence dramatique en fin de bataille.
8. **Embusquer** : positionner des unités cachées hors du champ tactique adverse, qu'il ne découvrira qu'en avançant.

## 3. Réconciliation des échelles temporelles

C'est le point technique le plus délicat. Si tu joues au tactique pendant 20 tours (= 20 minutes simulées) et que ton renfort de cavalerie est à 5 km, à quelle vitesse il arrive ?

### 3.1 Solution retenue : temps unifié dans tout le théâtre opérationnel

**Quand un tour tactique se résout (1 min simulée), un tour opérationnel partiel se résout aussi (1 min simulée).** Une cavalerie au galop fait 800 m/min, donc à 5 km elle arrive en ~6 tours tactiques = ~6 minutes simulées.

→ Ça crée une **vraie tension dramatique** : "ma cavalerie arrive dans 6 tours, tiendrai-je jusque-là ?"

### 3.2 Niveau stratégique : temps distinct

Le niveau stratégique en revanche tourne à un rythme propre (1 jour / tour). On y bascule **entre** deux phases opérationnelles, pas pendant. Quand on est en opérationnel ou en tactique, le stratégique est figé.

### 3.3 Synchronisation entre combats tactiques simultanés

Si 2 combats tactiques sont actifs sur un même théâtre opérationnel, ils se résolvent **par sous-tours synchrones** :
- Tour opérationnel T+1 commence
- Sous-tour tactique 1/30 : combats A et B avancent d'1 minute simulée chacun
- Sous-tour tactique 2/30 : idem
- ...
- Sous-tour tactique 30/30 : fin du tour opérationnel T+1, état mis à jour

Le joueur peut basculer entre les vues des combats A et B à tout moment. Ses ordres pour chaque sous-tour sont soumis avant la résolution.

## 4. Architecture technique

### 4.1 Architecture retenue : C — Hybride, scènes générées à la volée

3 architectures considérées, choix retenu = C :

| Architecture | Comment | Avantage | Inconvénient |
|---|---|---|---|
| A — Scènes Three.js séparées | `<StrategicScene>`, `<OperationalScene>`, `<TacticalScene>` totalement isolées | Code propre, perf optimale | Transitions = écran de chargement |
| B — Une scène, caméra unique zoomable | Un seul monde Three.js, la caméra zoome continuellement entre les 3 modes | Transition fluide cinématique | Très complexe à coder, demande LOD énorme |
| **C — Hybride** | Scènes séparées MAIS le tactique hérite du contexte de l'opérationnel qui hérite du contexte du stratégique | Transition courte (cinématique) + cohérence d'état totale + complexité gérable | Génération de la scène à la volée |

Songs of Conquest fait C. Heroes of Might and Magic fait C. Total War fait B (mais a 200+ devs).

**B reste possible en Phase 13+** si la perf le permet et si l'envie est là. Pas l'architecture cible MVP.

### 4.2 État unifié côté serveur

Un seul état JSONB par partie, structuré par échelle :

```json
{
  "current_scale": "operational",
  "current_turn": 47,
  "state": {
    "strategic": {
      "world_map_id": "uuid-...",
      "armies": [...],
      "weather": {...},
      "supply_lines": [...]
    },
    "operational": {
      "theater_id": "uuid-...",
      "regiments": [...],
      "weather": {...},
      "messengers": [...],
      "active_tactical_battles": ["battle-1-uuid", "battle-2-uuid"]
    },
    "tactical": {
      "battle-1-uuid": {
        "hex_grid": {...},
        "pawns": [...],
        "current_subturn": 12
      },
      "battle-2-uuid": {
        "hex_grid": {...},
        "pawns": [...],
        "current_subturn": 12
      }
    }
  }
}
```

### 4.3 Edge Function `resolve_turn` paramétrée

Une seule Edge Function, paramétrée par scale :

```
resolve_turn(game_id, scale='tactical', battle_id?)
  → résout 1 sous-tour tactique pour le combat indiqué

resolve_turn(game_id, scale='operational')
  → résout 1 tour opérationnel = 30 sous-tours tactiques pour tous les combats actifs
  → met à jour positions des unités opérationnelles (marche, messagers, artillerie)
  → détecte nouvelles rencontres → déclenche éventuellement nouveaux combats tactiques

resolve_turn(game_id, scale='strategic')
  → résout 1 tour stratégique = 1 jour simulé
  → marche des armées entre régions
  → détecte rencontres stratégiques → bascule éventuelle vers opérationnel
```

### 4.4 Composants R3F décorrélés

Tous les composants partagés (`<HexGrid>`, `<HexTile>`, `<CameraController>`, `<UnitModel>`, etc.) **prennent leur configuration en props**, jamais hardcodée. Ils ne savent pas s'ils sont rendus en mode tactique, opérationnel ou stratégique.

Seules les scènes (`<TacticalScene>`, `<OperationalScene>`, `<StrategicScene>`) connaissent leur scale et instancient les composants partagés avec la bonne config.

### 4.5 Caméra : 3 profils de contraintes

Chaque scale a ses contraintes de caméra (voir `SCALE_CONFIG` Phase 0) :
- Tactique : caméra inclinée à 60°, distance courte
- Opérationnel : caméra plus haute, plus reculée, distance moyenne
- Stratégique : vue presque top-down, distance grande

## 5. UX des transitions entre échelles

### 5.1 Cinématiques courtes

Pas de zoom continu en MVP. Transition = cinématique courte (1-2 secondes) :
- Tactique → Opérationnel : dézoom rapide, fondu, changement de scène
- Opérationnel → Tactique : zoom in dramatique, son d'épées qui se dégainent
- Stratégique → Opérationnel : sweep aérien rapide vers le théâtre concerné

### 5.2 Indicateurs permanents à l'écran

Le joueur sait toujours où il est :
- **Barre de scale en haut** : `Stratégique | Opérationnel | Tactique` avec l'actuel surligné
- **Mini-carte en coin** : montre la position dans l'échelle supérieure
- **Sélecteur de combats actifs** (mode opérationnel) : "Combat A en cours • Combat B en cours • Vue théâtre"
- **Indicateur de sous-tour** (mode tactique pendant opérationnel actif) : "Sous-tour 12/30 — fin du tour opérationnel dans 18 min simulées"

### 5.3 Bascule manuelle

Le joueur peut basculer manuellement entre les échelles à tout moment (pour consulter, pas pour interférer avec la résolution en cours) :
- Bouton "Vue opérationnelle" en haut à droite quand on est en tactique
- Bouton "Vue stratégique" en haut à droite quand on est en opérationnel
- Retour à la vue précédente via Échap

### 5.4 Bascule automatique

Certains événements forcent une bascule :
- Détection de rencontre stratégique → bascule vers opérationnel (avec confirmation joueur "Engager / Esquiver / Négocier")
- Détection de rencontre opérationnelle → bascule vers tactique (avec cinématique)
- Fin d'un combat tactique → retour automatique à la vue opérationnelle

## 6. Génération de scène à partir du contexte

### 6.1 Stratégique → Opérationnel

Quand une rencontre stratégique se déclenche, le théâtre opérationnel est **généré à partir du contexte du tile stratégique** :

| Contexte stratégique | Effet opérationnel |
|---|---|
| Tile = forêt dense | Théâtre majoritairement boisé, hex de forêt nombreux |
| Tile = plaine | Théâtre dégagé, idéal pour cavalerie |
| Tile = colline | Relief marqué, élévations significatives |
| Tile = rivière | Rivière qui traverse le théâtre, gués limités |
| Tile = village | Village au centre du théâtre, bonus défensif si occupé |
| Météo stratégique = pluie | Météo opérationnelle = pluie aussi |
| Fatigue accumulée armée A = 60% | Fatigue de départ régiments armée A = 60% |
| Direction d'arrivée armée A = nord | Régiments armée A arrivent par le nord du théâtre |

### 6.2 Opérationnel → Tactique

Pareil, héritage du contexte du tile opérationnel :

| Contexte opérationnel | Effet tactique |
|---|---|
| Tile = forêt | Carte tactique majoritairement boisée |
| Position d'arrivée armée A = sud du tile opérationnel | Armée A arrive par le sud de la carte tactique |
| Régiments engagés | Seuls ces régiments apparaissent sur la carte tactique (pas toute l'armée) |
| Fatigue régiment X = 75% | Fatigue de départ X = 75% |
| Météo opérationnelle = brouillard | Vision réduite sur la carte tactique |

## 7. Implications pour le gameplay des BACKLOG existants

L'architecture 3 niveaux **renforce et justifie** chaque BACKLOG produit jusqu'ici. C'est le chaînon manquant.

### 7.1 BACKLOG-regiments-cohesion

- Un régiment isolé en plein théâtre opérationnel = vulnérable, capturable.
- Étendard perdu en pleine marche opérationnelle = catastrophe morale visible à l'échelle de toute l'armée.
- Reformatio possible entre régiments dispersés à travers le théâtre, mais demande déplacement et délai.

### 7.2 BACKLOG-formations

- Les coûts de transition de formation (X tours selon effectif) sont cohérents avec la temporalité opérationnelle (1 tour opérationnel = 30 minutes simulées = temps réaliste pour réorganiser un régiment).
- Une formation en marche stratégique (colonne) doit être réorganisée en formation de combat à l'arrivée → délai à anticiper.

### 7.3 BACKLOG-commandement-zonal

- Front / Flancs / Arrière n'ont vraiment de sens géographique qu'à l'échelle opérationnelle (un théâtre de 10 km a de vrais flancs distincts du front).
- La réserve personnelle du général est positionnée à l'échelle opérationnelle, engageable au moment décisif.
- Réaffectation de régiment d'un commandant à un autre = ordre par messager opérationnel, délai cohérent.

### 7.4 BACKLOG-communication-ordres

**C'est la fiche qui gagne le plus avec le niveau opérationnel.**

- Les messagers physiques avec délais de transmission (X tours pour traverser le théâtre) ne sont crédibles qu'à l'échelle opérationnelle (10 km).
- L'interception de messagers a un sens spatial réel : il faut traverser un théâtre potentiellement hostile.
- Les modes de transmission (oral / clair / codé) prennent leur sens stratégique : un messager codé qui va du général vers la cavalerie de réserve à l'autre bout du théâtre, c'est crédible.
- La cryptanalyse opère sur durée stratégique (sur plusieurs jours, plusieurs codes interceptés).

### 7.5 BACKLOG-points-meta

- Les bonus "intercepter un messager", "casser un code", "récupérer un étendard" se déclenchent à l'échelle opérationnelle.
- L'évaluation "plan respecté / ignoré" prend tout son sens : le plan est défini à l'échelle stratégique ou opérationnelle, exécuté à l'échelle tactique.
- L'initiative locale du commandant ("pas reçu d'ordre depuis N tours, agit en autonomie") suppose une distance suffisante = niveau opérationnel.

## 8. Implications BDD

Tables prévisionnelles (Phase 8 et 9, pas avant) :

```sql
-- Phase 9
strategic_maps
  id, scenario_id, hex_data jsonb, terrain_types jsonb,
  width int, height int

strategic_armies
  id, game_id, owner_team, owner_general_id,
  position_q int, position_r int,
  fatigue, supply_level,
  composition_summary jsonb (résumé pour vue stratégique)

-- Phase 8
operational_theaters
  id, game_id, generated_from_strategic_tile_q int, generated_from_strategic_tile_r int,
  hex_data jsonb, weather, dominant_terrain,
  width int, height int

operational_units
  id, theater_id, regiment_id,
  position_q int, position_r int,
  fatigue, status ('marching' | 'engaged_in_battle' | 'resting' | 'fleeing'),
  current_battle_id uuid (null si pas en combat tactique)

-- Phase 8 (table parente des combats tactiques actifs)
tactical_battles
  id, theater_id, started_at_operational_turn int,
  position_in_theater_q int, position_in_theater_r int,
  hex_grid jsonb, status ('active' | 'finished'),
  current_subturn int

-- Refonte de game_state (Phase 8)
game_state
  game_id, turn_number, scale,
  state jsonb (state.strategic, state.operational, state.tactical)
```

## 9. Risques spécifiques 3 niveaux

| Risque | Niveau | Mitigation |
|---|---|---|
| Complexité UX 3 niveaux | Élevé | Introduction progressive (tactique seul jusqu'à Phase 7), tests utilisateurs systématiques aux Phases 8 et 9 |
| Perte de cohérence d'état entre échelles | Moyen | État unique côté serveur, scénarios de test cross-échelles dès Phase 8 |
| Performance dégradée (théâtre opérationnel + 2 combats tactiques actifs) | Moyen | Instancing systématique, LOD agressif, profiling régulier dès Phase 5 |
| Joueur perdu dans la navigation entre échelles | Moyen | Indicateurs permanents, tutoriel dédié à l'introduction du niveau opérationnel |
| IA qui ne sait pas exploiter le niveau opérationnel | Élevé | IA spécialisée par échelle (`engine/ai/operational.ts`), tests bot vs bot massifs |
| Scope creep en Phase 8 et 9 | Élevé | Discipline phasing, refus systématique d'ajouts hors phase |
| Tentation de coder l'opérationnel avant que le tactique soit stable | Élevé | Règle absolue : Phase 8 ne commence qu'après Phase 7 complète et validée |

## 10. Phasage strict

**Règles non-négociables** :

1. **Phases 0-7 : tactique uniquement.** Architecture préparée pour 3 niveaux mais implémentation tactique seule.
2. **Phase 8 : niveau opérationnel introduit.** L'opérationnel est testé, jouable, stable avant de passer.
3. **Phase 9 : niveau stratégique introduit.** Idem.
4. **Aucun raccourci.** Si en Phase 5 tu as une idée géniale pour l'opérationnel, elle va dans `BACKLOG.md`, pas dans le code.

Cette discipline est ce qui garantit que TACTICA reste **livrable à chaque phase**. Si tu t'arrêtes après Phase 7, tu as un wargame tactique fini. Si tu vas jusqu'à Phase 8, tu as quelque chose d'unique au monde. Si tu vas jusqu'à Phase 9, tu as un produit complet sans équivalent.

## 11. Points à trancher plus tard

- **Synchronisation précise** entre tour opérationnel et sous-tours tactiques (combien de sous-tours par tour opérationnel : 30 ? 20 ? variable ?).
- **Limite max de combats tactiques simultanés** sur un théâtre (2 ? 3 ? illimité avec dégradation graphique ?).
- **UX de bascule** : raccourcis clavier ? Bouton ? Geste ?
- **Détection de rencontre** : rayon exact, modificateurs par terrain, par météo, par vigilance.
- **Architecture B (caméra unique)** : à reconsidérer Phase 13+ si perf et envie sont là.
- **IA stratégique** : heuristiques pures ou MCTS léger ? Le stratégique est le plus combinatoire des 3.

## 13. Boucle opérationnelle "campagne" (feedback user 12/05)

Ajout de design : ce que doit pouvoir faire un joueur **en mode campagne opérationnelle**, indépendamment des batailles tactiques. Compatible avec § 1-12 ci-dessus, précise les briques manquantes.

### 13.1 Objectifs sur la map
- Chaque tile opérationnel peut porter un **objectif typé** : ville à prendre, pont à tenir, col à franchir, dépôt à piller, source d'eau à contrôler, signal à allumer.
- Affichage permanent comme **marqueurs cliquables** sur la carte opérationnelle (icône + libellé + camp possesseur).
- Pour chaque régiment, le joueur peut **assigner un objectif courant** (clic sur le pion → clic sur le marqueur). L'IA peut aussi en assigner via heuristiques (cf. § 9 risque IA opérationnelle).
- Objectifs peuvent être **séquencés** : route ordonnée (atteindre A, puis B, puis C). Stocké côté `operational_units` en `route_q[]`, `route_r[]`.

### 13.2 Marche automatique multi-jours
- Une fois objectif assigné, le régiment **marche tout seul** chaque tour opérationnel selon sa vitesse + le terrain + sa fatigue.
- Le joueur n'a plus à donner d'ordre tant que l'objectif n'est pas atteint, sauf intervention explicite (reroutage, halte forcée, repli).
- Vitesse réaliste par kind (km/jour ou m/min selon échelle temporelle § 3) : infanterie 25 km/jour, cavalerie 50 km/jour, artillerie 15 km/jour, modifiés par terrain et météo.

### 13.3 Cycle jour/nuit
- Le tour opérationnel encode l'heure (`current_op_hour: 0-23`) en plus du jour (`current_op_day`).
- **Jour (06h-18h)** : marche normale, vitesse pleine.
- **Crépuscule (18h-20h)** : vitesse réduite, vigilance accrue (détection diminuée pour l'adversaire).
- **Nuit (20h-06h)** : **bivouac automatique** sur le tile courant (sauf si ordre "marche forcée nocturne" → cohésion −, fatigue ++).
  - Récupération cohésion + fatigue pendant le bivouac (cf. règle BACKLOG-formations sur fatigue).
  - Repérage adverse réduit (cf. § 6.2 fog tactique : "brouillard opérationnel = vision réduite tactique" — extension : nuit = vision opérationnelle réduite aussi).
- **Aube (06h)** : reprise auto de la marche selon route assignée.

### 13.4 Détection de rencontre et bascule tactique
- Pendant la marche, à chaque pas opérationnel, on vérifie les **rencontres** : régiments ennemis à portée de détection (rayon variable selon météo, terrain, vigilance, nuit).
- Rencontre détectée → **modale joueur** ("Engager / Esquiver / Négocier" cf. § 5.4) avec timer si action requise.
- Engagement → **bascule cinématique vers tactique** (cf. § 5.1) avec **héritage contexte** : direction d'arrivée, fatigue accumulée, météo, terrain dominant (cf. § 6.2 tableau).
- Si plusieurs régiments alliés sont à portée mutuelle d'aide, ils peuvent **converger** sur le tactique (renforts qui arrivent en cours de combat, cf. § 2.1).

### 13.5 Arrivée sur objectif
- Régiment arrive sur tile objectif → 3 sous-cas :
  - **Objectif inoccupé** : capture immédiate, état tile passe à `held_by` du régiment, bonus campagne (points méta cf. BACKLOG-points-meta).
  - **Objectif occupé par ennemi** : bascule tactique forcée (siège, assaut). Pas d'esquive possible.
  - **Objectif occupé par allié** : pas de combat, renfort de la garnison.

### 13.6 Implications BDD additionnelles

```sql
-- Phase 8, en complément du § 8 plus haut
operational_objectives
  id, theater_id, position_q int, position_r int,
  kind ('city' | 'bridge' | 'pass' | 'depot' | 'water' | 'beacon'),
  held_by_team text, -- 'blue' | 'red' | 'neutral'
  importance int, -- score campagne

operational_units (ajouts)
  route_q int[], route_r int[],         -- séquence d'objectifs
  current_objective_idx int,             -- où en est-on dans la route
  status_phase text,                     -- 'marching' | 'bivouacking' | 'engaged' | 'capturing' | 'resting'
  fatigue float,                          -- 0.0 - 1.0
  cohesion float                          -- 0.0 - 1.0 (cf. BACKLOG-regiments-cohesion)

game_state (ajouts)
  current_op_day int,
  current_op_hour int,                   -- 0-23
```

### 13.7 Pré-requis Phase 8

Cette boucle exige :
- Architecture 3 niveaux (§ 4) en place.
- Système messager (BACKLOG-communication-ordres) opérationnel (ordres de reroutage transitent par messager, pas instantanés).
- Système fatigue (BACKLOG-formations § fatigue) opérationnel.
- Système cohésion (BACKLOG-regiments-cohesion) opérationnel — étendu hors combat.

Origine : feedback user 12/05 après session 20 (Phase 3.1 fog tactique livré). Cette boucle est ce qui transforme TACTICA d'un jeu de batailles en un jeu de **campagne** — différenciation forte vs Total War (qui fait la campagne au tour-par-tour figé).

## 12. Ce que ça apporte au jeu

- **Niche structurellement défendable** : aucun jeu grand public ne fait les 3 niveaux. C'est pas un avantage marketing, c'est un avantage de design.
- **Reproductibilité historique** : les batailles antiques ne sont pas qu'un combat tactique, elles sont une convergence opérationnelle. TACTICA peut reproduire Cannes, Trasimène, Gaugamèles fidèlement.
- **Profondeur de gameplay** : 3 métiers mentaux distincts (commandant tactique, général opérationnel, stratège de campagne).
- **Variété visuelle** : 3 ambiances graphiques, 3 rythmes, alternance permanente qui évite la lassitude.
- **Modes de jeu déclinables** : on peut imaginer des modes "tactique pure" pour parties courtes, "opérationnel + tactique" pour parties moyennes, "stratégique complet" pour parties longues. Tous se basent sur les mêmes fondations.
- **Modabilité enrichie** : un mod peut enrichir une seule échelle (ex : campagne stratégique de la guerre des Gaules, sans toucher au tactique).
