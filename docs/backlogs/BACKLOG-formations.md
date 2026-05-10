# BACKLOG — Formations militaires

**Phase d'intégration cible** : Phase 1 (formations de base) + Phase 4 (formations avancées).

## 1. Principe

Une formation = un **template de positions relatives** + une **orientation**. Le commandant ordonne "ligne, face nord" et les N pions du régiment migrent vers les hex contigus formant la ligne.

Chaque formation a un **profil de combat** : modificateurs ATK / DEF / vitesse selon angle d'attaque (frontal, flanc, arrière).

## 2. Application par régiment

- Une formation s'applique à **1 régiment** (les N pions qui le composent).
- Pas de formation transversale entre régiments — chaque régiment garde sa cohésion propre.
- **Réservée par type** : chaque type de régiment a ses formations spécifiques (testudo réservée à l'infanterie lourde, coin à la cavalerie, phalange aux piquiers, mur de boucliers à l'infanterie générale).

## 3. Coût de transition

**Règle** : changer de formation coûte du temps, et plus le régiment est nombreux, plus c'est long.

| Effectif du régiment | Tours de transition |
|---|---|
| 2-3 pions | 1 tour |
| 4-6 pions | 2 tours |
| 7-10 pions | 3 tours |
| 10+ pions | 4 tours |

(valeurs indicatives à ajuster en équilibrage)

Pendant la transition :
- Le régiment est en **désordre** (malus ATK/DEF lourds : -50% par exemple)
- Il ne peut pas attaquer
- Il peut se déplacer mais lentement
- Il est **vulnérable** : attaqué pendant la transition = pertes amplifiées

→ Ça force à anticiper les changements de formation avant le contact.

## 4. Catalogue de formations (Antiquité, à valider)

### Infanterie lourde (légionnaires, hoplites)

| Formation | Effet principal | Faiblesse |
|---|---|---|
| **Ligne (acies)** | Frontage maximal, ATK/DEF frontal forts | Flanc et arrière fragiles |
| **Colonne** | Vitesse, perce les lignes ennemies | Très exposée latéralement |
| **Carré (orbis)** | Défense 360°, tient encerclé | Quasi immobile, ATK faible |
| **Coin (cuneus)** | Force de pénétration frontale | Flancs ouverts |
| **Testudo** | Encaisse missiles (-80% dégâts archers) | Vitesse réduite, ATK très faible |
| **Mur de boucliers** | Polyvalent défensif | Ni offensif ni mobile |
| **Triple ligne (hastati/principes/triarii)** | Profondeur de réserve, relais | Demande grand effectif |

### Cavalerie

| Formation | Effet | Faiblesse |
|---|---|---|
| **Coin de charge** | Charge dévastatrice frontale | Désordre après impact |
| **Ligne légère** | Mobilité, harcèlement | Faible en mêlée prolongée |
| **Échelon oblique** | Attaque concentrée sur un point | Vulnérable au reste du front |
| **Tactique de feinte (parthe)** | Tir en fuite simulée, attire l'ennemi | Demande coordination, terrain dégagé |

### Archers / tirailleurs

| Formation | Effet | Faiblesse |
|---|---|---|
| **Tirailleurs dispersés** | Mobilité, esquive | Aucune défense au contact |
| **Volée serrée** | Cadence de tir maximale | Cible facile au contact |
| **Tirs en cloche** (Phase 8+) | Tirs indirects par-dessus obstacles | Précision réduite |

### Phalange (piquiers)

| Formation | Effet | Faiblesse |
|---|---|---|
| **Phalange serrée** | Mur de piques infranchissable frontalement | Quasi immobile, vulnérable au flanc |
| **Phalange oblique** | Manœuvre stratégique (Léouktres) | Demande discipline |

## 5. Visuel de la testudo (à trancher)

**Question ouverte** : sur une grille hex, on ne peut pas empiler 4 pions sur 1 hex. Donc la testudo c'est :

**Option A** : formation compacte qui occupe 4 hex contigus (losange ou carré), avec un visuel commun dessiné par-dessus (toit de boucliers étendu sur les 4 hex). Les pions restent visibles individuellement dessous.

**Option B** : les pions du régiment **fusionnent** en 1 seul gros pion testudo qui occupe 1 hex unique. Visuellement plus gros, plus lent. Quand la testudo se "défait", les pions se redéploient.

→ Recommandation provisoire : **Option A** pour préserver la lisibilité du nombre d'hommes et permettre les pertes localisées (un pion peut tomber sans que la testudo entière disparaisse).

## 6. Lien avec la communication d'ordres

- Le **briefing initial** définit les formations de départ → exécutées sans délai au tour 1.
- Un **changement de formation en cours de bataille** = ordre complexe transmis par messager (voir fiche communication).
- Le commandant peut modifier la formation en autonomie si la situation l'exige (Phase 4 — ordres formels avec acceptation/refus).

## 7. Points à trancher plus tard

- Liste finale des formations par type pour le MVP (commencer avec 3-4 par type)
- Valeurs exactes des modificateurs ATK/DEF par formation
- Visuel de la testudo (Option A ou B)
- Animations de transition (Phase 6 polish)

## 8. Phasage suggéré

- **Phase 1** : 2-3 formations basiques par type (ligne, colonne, carré pour infanterie ; coin, ligne pour cavalerie ; dispersé, serré pour archers). Sans ça, les régiments sont juste des blobs.
- **Phase 4** : formations avancées (testudo, phalange, échelon, tactique de feinte) avec les rôles asymétriques.
- **Phase 6** : polish visuel, animations de transition.
