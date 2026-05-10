# BACKLOG — Système de points méta (plan, initiative, réputation)

**Phase d'intégration cible** : Phase 4 (rôles asymétriques, version basique) + Phase 10 (Elo/réputation persistants).

## 1. Principe

Récompenser et pénaliser les joueurs **selon la qualité du plan préparé et la qualité de l'exécution**, pour orienter le comportement vers la planification rigoureuse et l'autonomie tactique intelligente.

Trois niveaux distincts (à différencier dans le code dès le départ) :

1. **Moral en partie** : impact direct sur le combat des unités concernées, dans la bataille en cours.
2. **Score de fin de bataille** : XP/Elo persistants entre parties, alimentant le classement (Phase 10).
3. **Réputation joueur** : visible sur le profil — "ce commandant désobéit souvent / cet homme sauve les plans" — alimente le matchmaking et le feedback social.

## 2. Événements à traquer et leurs effets

### 2.1 Briefing et plan

| Événement | Moral en partie | Score fin | Réputation |
|---|---|---|---|
| Plan validé par l'équipe au briefing | Bonus initial moral pour tous les régiments | — | — |
| Plan respecté ET réussi | Bonus moral collectif fin partie | Bonus collectif | Bonus "discipline" |
| Plan échoué malgré exécution correcte | Neutre | Score plein si exécution propre | Bonus "loyauté" |
| Plan ignoré sans raison + succès | Bonus combat local | Pénalité tactique | Pénalité "indiscipline" |
| Plan ignoré sans raison + échec | Malus moral lourd | Pénalité forte | Pénalité forte "indiscipline" |
| Plan modifié en urgence + succès (commandant qui sauve) | Bonus moral local | **Bonus initiative** | Bonus "initiative" |
| Plan modifié en urgence + échec | Pénalité moral local | Pénalité légère | Neutre (a tenté) |

### 2.2 Communication et messagers

| Événement | Moral en partie | Score fin | Réputation |
|---|---|---|---|
| Intercepter un messager ennemi | Bonus moral collectif (info ou héros) | Bonus tactique | Bonus "vigilance" |
| Casser un code ennemi | Bonus moral camp entier | Bonus stratégique | Bonus "intelligence" |
| Perdre un messager (en clair) | Malus moral (l'ennemi a lu) | Pénalité légère | Pénalité "imprudence" |
| Perdre un messager (codé) | Malus léger | Quasi-neutre | Neutre |

### 2.3 Cohésion et étendards

| Événement | Moral en partie | Score fin | Réputation |
|---|---|---|---|
| Récupérer un étendard ami à terre | Bonus moral camp entier | Bonus narratif | Bonus "honneur" |
| Étendard ami capturé par ennemi | Malus moral camp entier | Pénalité forte | Pénalité "honte" |
| Capturer un étendard ennemi | Bonus moral camp entier | **Bonus narratif majeur** | Bonus "gloire" |
| Reformatio réussie (régiments décimés fusionnés) | Bonus "frères d'armes" | Bonus stratégique | Bonus "pragmatisme" |
| Régiment combattu jusqu'au dernier homme | Bonus moral camp entier (sacrifice héroïque) | Bonus narratif | Bonus "héroïsme" |

### 2.4 Initiative locale (commandant sans ordres)

| Événement | Moral en partie | Score fin | Réputation |
|---|---|---|---|
| Commandant n'a pas reçu d'ordre depuis N tours et agit conformément à la doctrine briefée | Bonus initiative (ATK/DEF léger) | Bonus | Bonus "discipline doctrinale" |
| Commandant agit en autonomie après briefing solide et réussit | Bonus moral local | Bonus | Bonus "leadership" |
| Commandant inactif sans raison (n'agit pas alors qu'il pourrait) | Malus moral | Pénalité | Pénalité "passivité" |

## 3. Comment le moral en partie se traduit mécaniquement

Le moral d'un régiment (déjà prévu dans le système de combat par points) est **modulé** par les événements ci-dessus :

- Moral haut → bonus ATK/DEF (~+10 à +20%)
- Moral moyen → neutre
- Moral bas → malus ATK/DEF, risque de **déroute**
- Moral effondré → déroute automatique (régiment fuit, ne combat plus)

Les événements méta (plan respecté, étendard capturé, etc.) **ajustent** ce moral en plus des effets purement tactiques (pertes au combat, encerclement, vue d'unités amies tomber).

## 4. Score de fin de bataille (Phase 10)

À la fin d'une bataille, chaque joueur reçoit un **score individuel** calculé sur :

- **Objectifs principaux** (victoire/défaite, conditions de scénario)
- **Performance tactique** (pertes infligées vs. subies, ratio efficacité)
- **Performance méta** (somme des bonus/pénalités événementiels ci-dessus)
- **Évaluation de rôle** (le général est jugé sur la coordination, le commandant sur l'exécution de zone)

Ce score alimente :
- Un **Elo par mode et par rôle** (général vs. commandant scorés différemment)
- L'**XP du joueur** (progression long terme)
- Le **AAR** (After Action Report) généré automatiquement

## 5. Réputation joueur (long terme, Phase 10+)

**Tags persistants** affichés sur le profil :

- "Discipliné" (suit les plans, score plein en exécution)
- "Initiative" (sauve souvent les plans qui partent en vrille)
- "Indiscipliné" (ignore régulièrement les ordres)
- "Honneur" (ne perd jamais d'étendard, en récupère)
- "Stratège" (haut taux de plans validés et réussis en tant que général)
- "Vigilant" (intercepte beaucoup de messagers)
- "Pragmatique" (utilise reformatio, sauve les pions, gère le sale boulot)
- ...

Impact :
- Visibilité sur le profil et dans le matchmaking
- Optionnel : système de **trust** entre joueurs (un général peut "demander" un commandant disciplinéavec qui il a bien joué auparavant)
- Histoire personnelle du joueur (collection de batailles marquantes générées par AAR)

## 6. Lien avec les autres mécaniques

- **Lien avec briefing** : le briefing est la source du "plan officiel" qui sert de référence pour le scoring "plan respecté/ignoré".
- **Lien avec commandement zonal** : un commandant ne peut être noté "indiscipliné" que sur les régiments de **sa zone**. La désobéissance est jugée localement.
- **Lien avec communication** : si un commandant n'a pas reçu d'ordre (messager perdu), ses actions ne sont **pas jugées** indisciplinées — au contraire, l'initiative est récompensée.
- **Lien avec étendards** : système d'étendards à part (voir fiche cohésion), mais sa valorisation passe par le score méta.

## 7. Garde-fous à prévoir

- **Pas de farming** : un événement bonus ne doit pas être déclenchable artificiellement (ex : se faire intercepter exprès pour qu'un coéquipier "récupère" l'info → ne marche pas si le système détecte le pattern).
- **Pas de bash de coéquipier** : pas de mécanisme où un joueur peut directement faire perdre des points à un autre membre de son équipe par mauvaise foi.
- **Évaluation contextuelle** : si un plan échoue à cause de l'ennemi (et pas à cause d'un joueur), c'est neutre, pas pénalité.
- **Non frustrant** : les pénalités sont mineures en valeur absolue. Ce qui compte, c'est la **direction** des incitations, pas la punition forte.

## 8. Phasage suggéré

- **Phase 4 (rôles asymétriques)** :
  - Système de moral en partie modulé par événements (plan, étendards basiques)
  - Pas encore de score persistant ni réputation
- **Phase 10 (classements/tournois)** :
  - Score de fin de bataille
  - Elo par rôle
  - XP joueur
  - Tags de réputation

## 9. Points à trancher plus tard

- Valeurs exactes des bonus/malus moral
- Algorithme précis du score de fin de bataille
- Liste finale des tags de réputation
- Visibilité publique vs. privée de certains tags (ex : "Indiscipliné" affiché publiquement ou seulement aux coéquipiers passés ?)

## 10. Ce que ça apporte au jeu

- **Incitations cohérentes** : le système récompense ce qu'on veut voir (planification, discipline, initiative intelligente) et pénalise ce qu'on ne veut pas voir (égoïsme, ignorance des plans, passivité).
- **Récit émergent** : chaque joueur construit une **identité de jeu** via ses tags. Un joueur "Initiative + Pragmatisme" est très différent d'un joueur "Discipliné + Honneur".
- **Matchmaking enrichi** : on peut composer des équipes équilibrées en mélangeant des profils complémentaires.
- **AAR riche** : le score méta alimente directement la narration des After Action Reports.
