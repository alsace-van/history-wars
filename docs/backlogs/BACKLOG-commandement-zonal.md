# BACKLOG — Commandement zonal

**Phase d'intégration cible** : Phase 4 (rôles asymétriques).

## 1. Principe : découpage par zone, pas par type

Plutôt que de répartir les commandants par **type de troupes** (cavalerie / archers / infanterie), on les répartit par **zone géographique de responsabilité**. C'est plus tactique, plus historique, et ça équilibre mieux les rôles.

Doctrine de référence : César à Alésia, Hannibal à Cannes — un commandant tient le **front**, l'autre coordonne **réserve + ailes**.

## 2. Format MVP (2v2)

| Rôle | Responsabilité | Régiments contrôlés |
|---|---|---|
| **Général** | Vue carte complète, validation du plan, ordres macro, ping carte | **Réserve personnelle** : 2-3 régiments d'élite (garde personnelle, type triarii) |
| **Commandant Front** | Régiments engagés en première ligne | Tous les régiments du front, peu importe leur type (infanterie lourde principale + éventuelle cavalerie de soutien front + archers de soutien front) |
| **Commandant Flancs/Arrière** | Ailes, harcèlement, enveloppement, protection arrière | Cavalerie principale + tirailleurs + harceleurs sur les côtés et l'arrière |

**Pourquoi ce découpage marche :**

- **Équilibre des charges** : Front = beaucoup d'unités lentes mais simples (tiens la ligne). Flancs = peu d'unités mais ultra-mobiles et décisives. Les deux ont du gameplay intéressant.
- **Synergie obligatoire** : aucun commandant ne peut gagner seul. Le Front tient, les Flancs enveloppent. C'est exactement Cannes.
- **Lisibilité** : "tu tiens, j'enveloppe" est un langage simple appris en 2 minutes.

## 3. Format évolutif selon taille d'équipe

| Mode | Général | Commandants |
|---|---|---|
| **2v2 MVP** | 1 (réserve + macro) | 1 Front + 1 Flancs/Arrière |
| **3v3** | 1 (macro pur) | 1 Front + 1 Flancs + 1 Réserve/Cavalerie d'élite |
| **4v4** | 1 | 1 Front gauche + 1 Front droite + 1 Cavalerie + 1 Tirailleurs/Réserve |
| **5v5+ tournois** | 1 | Spécialisation pure par type (infanterie / cavalerie / archers / élite / tirailleurs) |

→ Le format 2v2 utilise un découpage **zonal** (équilibrage).
→ Les formats 4v4+ utilisent un découpage **par type** (spécialisation, plus historique).
→ Le 3v3 est un format intermédiaire.

## 4. Le général a-t-il des troupes en propre ?

**Oui.** Le général n'est pas un stratège abstrait : il commande directement sa **réserve personnelle** (garde rapprochée, type cohors praetoria romaine).

- 2-3 régiments d'élite, à lui seul
- Engagés au moment décisif (mécanique d'engagement de la réserve)
- Le général choisit **quand** et **où** les engager
- Si la garde personnelle tombe, **le général lui-même est en danger** (mécanique à creuser : moral catastrophique pour son camp s'il meurt)

Ça donne au rôle de général une **dimension joueur**, pas seulement coordinateur.

## 5. Réaffectation de régiment en cours de bataille

Un régiment peut **changer de commandant** en cours de bataille (passe du Front aux Flancs ou inversement). Décidé par le **général**.

**Coût de la réaffectation** :
- **Délai de communication** : ordre transmis par messager (voir fiche communication), 1-2 tours
- **1 tour de désorganisation** une fois l'ordre reçu : le régiment ne sait plus exactement qui obéir, il est en attente
- **Malus moral léger** pendant ce tour
- **Pas de changement de formation possible** pendant le tour de désorganisation

Historiquement juste : changer de chaîne de commandement en plein combat, c'est toujours la pagaille à court terme.

## 6. Implications BDD

Adaptation de la table `game_players` :

```sql
game_players
  game_id, user_id,
  team ('blue' | 'red'),
  role ('general' | 'commander' | 'observer'),
  zone ('front' | 'flanks_rear' | 'reserve' | 'left_wing' | 'right_wing' | 'cavalry' | 'missiles' | null),
  -- zone = null pour observer, et pour général en MVP (il a sa réserve mais c'est déduit du rôle)
  slot_index, joined_at
```

Et chaque régiment a un champ `assigned_commander_id` (peut être l'id du général pour la réserve personnelle, ou l'id d'un commandant). Réaffectable au cours de la partie.

## 7. Points à trancher plus tard

- Taille exacte de la réserve personnelle du général (2 régiments ? 3 ?)
- Conséquence exacte de la mort du général en bataille (game over immédiat ? Malus moral massif ? Promotion d'un commandant ?)
- Mécanique de "engagement de la réserve" : en un seul ordre ? Engagement progressif ? Limite de portée ?

## 8. Ce que ça apporte au jeu

- **Tension narrative** : "le général engage sa garde" = moment fort de toute bataille antique.
- **Décision spatiale réelle** : où se positionne le général, jusqu'à quand garde-t-il sa réserve, quand l'engage-t-il.
- **Asymétrie satisfaisante** : Front et Flancs ont des gameplays vraiment différents mais complémentaires.
- **Roadmap de scaling** : on commence simple (2v2 zonal), on évolue vers complexe (5v5 par type) à mesure que la communauté grandit.
