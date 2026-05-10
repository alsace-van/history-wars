# BACKLOG — Communication et ordres

**Phase d'intégration cible** : Phase 4 (version basique) + Phase 8 (extension stratégique).

> Mécanique signature potentielle du jeu. Aucun wargame tour par tour ne le fait à ce niveau de granularité.

## 1. Principe : pas de téléphone à l'antiquité

Les ordres ne se transmettent pas instantanément. Un général ne peut pas "cliquer" sur un régiment éloigné et lui donner un ordre immédiat. Il doit utiliser un **messager**, qui prend du temps, qui peut être tué, qui peut être intercepté.

C'est le cœur de l'expérience joueur :
- **Anticipation forcée** côté général ("j'envoie l'ordre, en espérant qu'il arrive")
- **Autonomie sous incertitude** côté commandant ("pas de nouvelles depuis 3 tours, je décide seul")

## 2. Briefing initial : exécution sans délai

**Règle fondatrice** : tous les ordres définis et **validés au briefing** par le général sont exécutés au tour 1 **sans délai et sans risque**.

→ Les commandants connaissent leur partition. Les régiments ont leurs consignes. Pas besoin de messager pour ça.

**Conséquence** : un bon plan = équipe réactive sans délai. Un plan bâclé = improvisation permanente avec délais et pertes de transmission.

→ **Incite très fortement à la planification préalable**, ce qui colle à l'ADN "stratégique adulte tour par tour" du jeu.

## 3. Le messager comme entité physique

- Chaque général/commandant dispose d'un **stock de messagers** au début de la bataille
  - Indicatif : 2-3 messagers par général, 1-2 par commandant
- Un messager = **mini-unité de 1 pion** (1 cavalier rapide), visible sur la carte
- Sprite distinct (cavalier seul, allure de coursier) pour reconnaissance immédiate
- Stats : très rapide, peu ou pas combatif, fragile
- **Indisponible pendant qu'il est en mission** (jusqu'à son retour)

## 4. Mécanique de la tournée

**Innovation clé** : un messager peut transporter **plusieurs ordres** distribués lors d'une **tournée**.

**Workflow joueur** :
1. Le général/commandant clique sur un de ses messagers disponibles
2. Il **constitue une tournée** : assigne 1 à N ordres, chacun destiné à un régiment précis
3. La **route est calculée** (route directe entre les points dans l'ordre donné, optimisable plus tard)
4. Le messager part, distribue les ordres dans l'ordre de la tournée
5. À chaque régiment atteint, l'ordre devient **exécutable au tour suivant**
6. Quand la tournée est finie, il **revient à son point de départ**
7. Tant qu'il n'est pas revenu, il est indisponible

**Dilemme tactique créé** :
- 1 messager pour 4 régiments = lent mais économique
- 2 messagers en parallèle pour 2 régiments chacun = rapide mais mobilise 2 ressources
- C'est un vrai choix stratégique, pas une simple optimisation

## 5. Délais de transmission par type d'ordre

| Type d'ordre | Délai de base |
|---|---|
| Signal sonore basique (charge, retraite, halte) à régiment proche | 0 tour (instantané) |
| Ordre simple à régiment à portée de signal visuel (vexillum) | 1 tour |
| Ordre complexe (changement de formation, manœuvre) | 1-2 tours |
| Réaffectation de commandement | 2-3 tours |
| Plan complet de bataille (changement de stratégie) | 3-4 tours |

Modificateurs :
- **Distance** : plus loin = +1 ou +2 tours
- **Terrain** : forêt, montagne, rivière = +1 tour
- **Météo** : brouillard, pluie battante, nuit = signaux visuels inopérants → tout passe par messager

## 6. Risque d'interception

Quand un messager passe à proximité d'unités ennemies, il y a un **risque d'interception** (5-15% selon proximité, vitesse, terrain).

### 3 issues possibles à l'interception :

**1. Tué net** → ordres perdus pour ton camp, **lus par l'ennemi** s'ils étaient en clair.

**2. Capturé vivant** → idem perte + lecture, **plus** information bonus pour l'ennemi (identité du commandant émetteur, position de départ → indice sur où se trouve le général).

**3. Échappé de justesse** → l'ennemi récupère les **messages écrits** mais le messager survit et peut continuer (avec les ordres restants à délivrer si codé, ou perdus si en clair).

## 7. Modes de transmission (protection des messages)

Quand tu envoies un ordre, tu choisis son **mode** :

| Mode | Coût | Bénéfice | Risque interception |
|---|---|---|---|
| **Oral mémorisé** | 1 ordre seul (pas de tournée multi) | Si messager mort, **ordre perdu mais pas lu** | Aucune fuite possible mais inefficace |
| **Écrit clair** | Aucun coût, tournée multi possible | Rapide à composer | **Lecture intégrale par l'ennemi** si intercepté |
| **Écrit codé** | 1 tour de retard avant départ (composition du chiffre) | Tournée possible, contenu protégé | Ennemi voit qu'il y a un message mais **ne peut pas le lire** |
| **Écrit codé + leurre** | 2 tours de retard, mobilise un 2e messager appât | Confusion maximale ennemi | Le vrai messager passe inaperçu pendant que le leurre attire les patrouilles |

## 8. Cryptanalyse : le code peut être cassé

**Mini-méta-guerre** parallèle à la bataille tactique.

- Chaque camp commence avec un **code en vigueur**
- Quand l'ennemi intercepte un message **codé**, il ne le lit pas immédiatement, mais accumule du **matériel cryptanalytique**
- Au bout de **3-5 messages codés interceptés**, le code est **cassé** : tous les futurs messages codés deviennent lisibles
- **Changer de code** : nouvelle clé, ça remet le compteur ennemi à zéro
- Mais distribuer le nouveau code aux commandants se fait **par messager** → tous les risques classiques du contre-espionnage

## 9. Côté ton camp : sais-tu que ton messager a été pris ?

**Modèle mixte recommandé** :

- Tu vois que le messager **n'est pas revenu** après son délai prévu
- Tu **ne sais pas** s'il a été tué, capturé, ou seulement en retard
- Tu **ne sais pas** si l'ennemi a lu tes ordres
- Au bout de N tours supplémentaires, peut-être un éclaireur retrouve son corps (confirmation), peut-être pas
- Tu vis dans le **doute**, le doute peut éventuellement se lever

→ Tension narrative maximale. Tu dois **soupçonner** et adapter ton plan dans l'incertitude.

## 10. Détection des messagers ennemis

Pour que ce soit jouable et non frustrant :

- Sprite distinct (cavalier seul, allure de coursier)
- **Visible quand isolé en mouvement loin des combats**
- **Détectable par éclaireurs** dans certaines conditions
- Difficile à distinguer en plein chaos

→ Envoyer un messager pendant une mêlée massive = plus sûr mais ralenti
→ Envoyer en plein no man's land calme = rapide mais visible

Décision spatiale réelle.

## 11. Remontée d'info commandants → général

**À trancher** : option A ou B.

**Option A — full incertitude antique** : la remontée d'info passe aussi par messagers. Le général ne sait que ce qu'on lui rapporte. Ultra-historique, ultra-tendu. Le général vit l'expérience d'un commandant en chef antique : aveugle, dépendant des rapports.

**Option B — vue temps réel** : le général a une vue carte complète sur les unités amies (mais pas ennemies, brouillard de guerre standard). Moins historique mais plus jouable. Ses ordres descendants restent soumis au délai messagers.

→ **Option A** est plus forte narrativement et plus cohérente avec la mécanique. **Option B** est plus accessible et moins frustrante. À tester en playtest.

→ Compromis possible : Option B en MVP, Option A comme **mode "réalisme historique"** en option.

## 12. Régiments de messagers spécialisés

Possibilité d'avoir des **régiments dédiés** : 2-3 cavaliers rapides, vitesse maximale, mission unique de transmission.

- Si ce régiment est tué, capacité de transmission rapide perdue
- Mécanique de **recrutement** (post-MVP) : convertir un cavalier d'un régiment standard en messager (coût en force du régiment d'origine)

## 13. Liens avec les autres mécaniques

- **Lien avec formations** : changement de formation en cours de bataille = ordre complexe par messager.
- **Lien avec commandement zonal** : réaffectation d'un régiment d'un commandant à un autre = ordre par messager (2-3 tours).
- **Lien avec système de points/meta** : intercepter un messager = bonus, casser un code = bonus, perdre un messager = pénalité légère.
- **Lien avec marche d'approche (Phase 8)** : interception de messagers sur grandes distances stratégiques, modes oral/écrit/codé prennent tout leur sens.

## 14. Implications BDD

```sql
messengers
  id, game_id, owner_user_id, owner_team,
  position_q, position_r,
  speed, is_dead, is_captured, is_at_base,
  current_tour_id (référence vers une tournée active ou null)

messenger_tours
  id, messenger_id, status ('preparing' | 'in_route' | 'completed' | 'lost'),
  encryption_mode ('oral' | 'plain' | 'coded' | 'coded_decoy'),
  preparation_turns_remaining, departed_at_turn

messenger_orders
  id, tour_id, sequence_index, target_regiment_id,
  order_type, order_payload (jsonb),
  status ('pending' | 'delivered' | 'lost'),
  delivered_at_turn

intercepted_messages
  id, game_id, intercepting_team, message_content (jsonb),
  was_coded, was_decoded, intercepted_at_turn

cryptanalysis_progress
  game_id, attacking_team, target_team,
  intercepted_coded_count, current_code_version,
  is_code_broken
```

## 15. Phasage suggéré

- **Phase 4 (rôles asymétriques)** :
  - Messagers physiques sur la carte
  - Tournées multi-ordres
  - Délais de transmission
  - Pas encore de chiffrement : interception simple = ordre perdu (pas de lecture par ennemi)
  - Briefing initial sans délai
- **Phase 8 (marche d'approche)** :
  - Modes oral / écrit clair / écrit codé
  - Lecture des messages interceptés par l'ennemi
  - Détection des messagers par éclaireurs
- **Post-MVP / extension** :
  - Cryptanalyse, code cassable
  - Leurres
  - Désinformation active
  - Régiments de messagers spécialisés

## 16. Points à trancher

- Remontée d'info : Option A (messagers) ou B (vue temps réel) ?
- Nombre exact de messagers par rôle au début d'une partie
- Probabilité d'interception selon distance ennemis
- Nombre de messages codés à intercepter pour casser un code
