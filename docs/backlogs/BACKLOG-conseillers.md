# BACKLOG — Système de conseillers

**Phase d'intégration cible** : Phase 4 (mécaniques avancées combat) + Phase 6 (IA et assistance joueur).

Session brainstorm du 10/05/2026 — architecture technique des conseillers, types historiques, détecteurs, scoring, asymétrie joueur, anti-radotage, validation d'existence des ressources avant tout conseil.

---

## 1. Principe : un conseiller = 3 couches d'interaction

| Couche | Description |
|---|---|
| **Passif** | Bonus permanent dans son domaine (ex : maître d'artillerie = +10% précision) |
| **Réactif** | Le joueur le consulte sur demande (analyse + recommandation contextualisée) |
| **Proactif** | Il alerte/intervient spontanément quand un détecteur déclenche |

C'est cette **couche 3 (proactive) qui le rend "vivant"**. Sans elle, c'est juste un buff anonyme.

---

## 2. 8 types de conseillers (basés sur les figures historiques)

| Conseiller | Inspiration historique | Domaine | Pertinence |
|---|---|---|---|
| **Chef d'état-major** | Berthier | Transmission d'ordres, délais, planification | Bataille + campagne |
| **Maître d'artillerie** | Drouot, Sénarmont | Placement batteries, portées, optimisation feu | Bataille |
| **Inspecteur de cavalerie** | Murat, Bessières | Timing charges, reconnaissance, raids | Bataille |
| **Maître espion** | Savary, Schulmeister | Renseignement, fog of war, désinformation | Bataille + campagne |
| **Médecin en chef** | Larrey | Hôpital, gestion blessés, ratios récupération | Bataille + campagne |
| **Intendant général** | Daru | Logistique, ravitaillement, munitions | Bataille + campagne |
| **Diplomate** | Talleyrand | Négociations, alliances | Campagne |
| **Conseiller politique** | Cambacérès, Fouché | Stabilité intérieure, recrutement | Campagne |

→ Pour le **MVP TACTICA bataille tactique** : se concentrer sur les 5 premiers (les 3 derniers sont mode campagne).

---

## 3. Architecture technique en 3 couches

### Couche 1 — Détecteurs (la couche obligatoire)

Chaque conseiller possède une **liste de règles de surveillance** qui scannent l'état du jeu en continu.

```typescript
type Detector = {
  id: string;
  
  // Phase 1 - Détection d'opportunité/menace
  detect: (gameState, playerVisibility) => OpportunityDetected | null;
  
  // Phase 2 - Évaluation faisabilité avec MES ressources
  evaluateFeasibility: (opportunity, playerResources) => FeasibilityScore;
  
  // Filtres asymétrie joueur
  visibilityRequired: 'direct' | 'scout' | 'spy';
  detectionProbability: (advisorLevel, gameState) => number;
  transmissionDelay: number; // tours avant arrivée du conseil
  
  // Anti-radotage
  contextChangeRequired: (lastEmission, currentState) => boolean;
  playerActionTracking: 'followed' | 'ignored' | 'alternative';
  
  // Métadonnées
  priority: 1-10;
  cooldown: number;
  speciality: 'artillery' | 'cavalry' | 'intel' | 'logistics' | 'medical';
}
```

**Exemple concret pour le maître d'artillerie :**

| Détecteur | Condition | Priorité | Message |
|---|---|---|---|
| Charge ennemie sur batterie | Cavalerie ennemie < 200m de ma batterie | 9 | *"Sire ! Batterie 3 va être chargée, retirez-la !"* |
| Cible groupée | Régiment ennemi en formation serrée à portée canister | 7 | *"Sire, masse ennemie à portée de mitraille."* |
| Munitions basses | Batterie < 30% munitions | 6 | *"Batterie 5 presque à sec."* |
| Batterie ennemie expose flanc | Batterie ennemie sans escorte cavalerie | 5 | *"Sire, leur batterie 2 est isolée."* |
| Terrain défavorable | Batterie sur sol meuble (pluie) | 4 | *"Sire, terrain trop mou pour le recul."* |

→ **5-10 détecteurs par conseiller suffisent** pour 80% des situations utiles.

### Couche 2 — Scoring (couche analytique sur consultation)

Quand le joueur **consulte activement** un conseiller, le système évalue la situation sur plusieurs axes pondérés.

**Exemple pour l'inspecteur de cavalerie consulté avant une charge :**

```
score_charge = 
  + (faiblesse_cible × 0.3)
  + (fraîcheur_unité × 0.25)
  + (terrain_propice × 0.2)
  + (soutien_disponible × 0.15)
  - (menace_flanc × 0.4)
  - (artillerie_ennemie_active × 0.3)
```

Selon le score :
- **> 0.7** → *"Sire, je recommande la charge. Probabilité de succès : élevée."*
- **0.3 - 0.7** → *"Sire, succès incertain. Considérez l'appui de l'artillerie d'abord."*
- **< 0.3** → *"Sire, je déconseille fortement. Vous allez perdre votre cavalerie."*

### Couche 3 — Templates stratégiques (couche haut niveau)

Patterns reconnaissables d'état du jeu :

| Template | Détection | Conseil associé |
|---|---|---|
| **Encerclement imminent** | 3+ flancs avec ennemis à <300m | *"Sire, repli vers la colline ou carré défensif"* |
| **Brèche exploitable** | Trou >150m dans ligne ennemie + unité dispo | *"Sire, opportunité de percée centrale"* |
| **Effondrement adverse** | 2+ régiments ennemis sous seuil panique | *"Sire, poussez maintenant, leur ligne va craquer"* |
| **Tempo défavorable** | Pertes > pertes ennemies depuis 5 tours | *"Sire, l'attrition vous est défavorable, rompez"* |
| **Réserve à engager** | Front décimé + réserve fraîche disponible | *"Sire, le moment d'engager la 2e ligne"* |

---

## 4. RÈGLE D'OR — Validation d'existence avant TOUT conseil

C'est **la règle non-négociable**. Le conseiller doit valider une **checklist d'existence et d'état** avant d'émettre quoi que ce soit.

```
PHASE 0 — VALIDATION D'EXISTENCE (avant tout conseil)
  → L'unité que je vais recommander existe-t-elle encore ? (pas KIA, pas dissoute)
  → Est-elle sous mon contrôle ? (pas capturée, pas en déroute)
  → Est-elle en état de combattre ? (pas < 10% effectif, pas paniquée)
  → Peut-elle physiquement aller où je dis ? (pas bloquée, pas isolée)
  → Reçoit-elle encore mes ordres ? (pas hors portée commandement)
  → Est-elle disponible ? (pas déjà engagée dans une autre action)

→ SI un seul critère échoue : conseil ANNULÉ ou reformulé
```

### Exemples de bugs absurdes à éliminer

| Erreur du conseiller | Cause | Solution |
|---|---|---|
| *"Envoyez vos artilleurs sur la colline"* alors qu'ils sont morts | Pas de check d'existence | Scan unités vivantes |
| *"La 3e brigade peut charger"* alors qu'elle est paniquée | Pas de check d'état moral | Filtrer par état comportemental |
| *"Renforcez le centre"* alors que toutes réserves engagées | Pas de check disponibilité | Filtrer engaged_in_action |
| *"La cavalerie peut couper la retraite"* alors qu'elle est à 3 km | Pas de check distance temporelle | Calculer temps réel d'arrivée |
| *"Repliez-vous vers le bois"* alors que l'ennemi tient le bois | Pas de check territoire | Vérifier propriétaire zone |
| *"Engagez la batterie 5"* alors qu'à court de munitions | Pas de check logistique | Vérifier stocks |
| *"Le colonel Dupont peut diriger"* alors qu'il est mort/capturé | Pas de check officier | Vérifier statut |

### Code attendu

```typescript
function adviseArtillery(gameState, myArmy) {
  // PHASE 0 - Existence et état
  const availableArtillery = myArmy.units.filter(u => 
    u.type === 'artillery' &&
    u.alive &&
    u.controlled &&
    u.morale > MORALE_THRESHOLD &&
    !u.engagedInAction &&
    u.ammunition > AMMO_THRESHOLD &&
    u.officersAlive
  );
  
  if (availableArtillery.length === 0) return null; // ON SE TAIT
  
  // PHASE 1 - Détection opportunité
  // PHASE 2 - Faisabilité
  // ...
}
```

---

## 5. Le silence est un état valide

Philosophiquement essentiel : **un bon conseiller se tait souvent**. Si rien de pertinent n'est faisable avec tes ressources actuelles, **il ne dit rien**.

Un conseiller artillerie peut très bien **passer 10 tours sans rien dire** en bataille. Ce n'est pas un bug. Quand il parle, **tu écoutes** parce que tu sais que ça compte.

### Conseiller qui dit qu'il ne peut rien faire

Parfois utile d'émettre explicitement un constat d'impuissance :

> *"Sire, je vois une opportunité au centre, mais nos batteries sont décimées. Je ne peux rien faire d'ici."*

À utiliser avec parcimonie, **max 1-2 fois par bataille**, sinon ça redevient du bruit.

---

## 6. Anti-radotage (résoudre le problème de boucle)

### Cooldown contextuel (pas juste temporel)

```
Une fois un conseil émis, il n'est PAS rééémis tant que :
  - Le contexte n'a pas changé significativement
  - OU le joueur n'a pas pris une décision liée
  - OU un seuil temporel maximal n'est pas atteint (sécurité)
```

### Détection de "l'écoute" du joueur

Le conseiller observe ce que le joueur **fait après son conseil** :
- A suivi l'avis → confirmation, pas de répétition
- A agi différemment → enregistre une stratégie alternative, pas de redite
- N'a rien fait → considère que le joueur ignore volontairement, pas de redite

### Hiérarchie des alertes

À tout moment, **une seule alerte critique** s'affiche. Les autres restent en file d'attente, émises seulement si encore pertinentes après résolution. **Une voix à la fois.**

---

## 7. Asymétrie joueur (problème : les 2 joueurs alertés en même temps)

Le plus profond des problèmes. Si les 2 joueurs ont des conseillers, ils détectent la même chose au même moment, donc l'avantage tactique s'annule. Solutions à combiner :

### Levier A — Fog of war strict appliqué AU CONSEILLER

Ton conseiller ne **voit** que ce que **toi tu vois**. Il n'a pas une vue omnisciente. Si tes éclaireurs ne sont pas dans la zone, **la brèche n'existe pas pour ton conseiller**.

```
Détection d'une opportunité = visible(zone) ET reconnu(zone) ET récent(< X tours)
```

→ Si l'autre joueur a de meilleurs éclaireurs sur cette zone, **lui sera alerté**, pas toi (ou inversement). L'asymétrie naît du **renseignement**, pas du conseiller.

### Levier B — Spécialisation de chaque conseiller

Ton **maître d'artillerie** ne détecte pas une opportunité de charge cavalerie. Ton **inspecteur cavalerie** ne détecte pas une vulnérabilité d'artillerie. Chaque conseiller voit le monde **à travers son prisme**.

→ Ton choix de conseillers actifs **structure ce que tu perçois** du jeu.

### Levier C — Compétence du conseiller (probabilité de détection)

Un conseiller n'est **pas garanti** de tout repérer.

| Niveau conseiller | P(détection / tour) |
|---|---|
| Novice | 40% |
| Expérimenté | 60% |
| Vétéran | 80% |
| Maître | 95% |

→ Asymétrie créée par l'investissement long-terme dans tes officiers.

### Levier D — Délai de transmission

Cohérent avec le système de messagers (BACKLOG-communication-ordres) : entre la **détection terrain** et l'arrivée du conseil au joueur, **1-3 tours de délai**.

```
Tour 5 — Brèche apparaît
Tour 6 — Éclaireur la repère
Tour 7 — Aide de camp galope vers QG
Tour 8 — Conseil émis au joueur
```

→ Pendant ces 3 tours, **la situation peut évoluer**. Le conseil arrive parfois trop tard. Comme dans la vraie vie.

### Levier E — Personnalité et école de pensée

| Profil | Pondération | Exemple |
|---|---|---|
| **Agressif** | score_opportunité ×1.5, score_menace ×0.7 | Murat |
| **Prudent** | score_opportunité ×0.7, score_menace ×1.5 | Soult |
| **Méthodique** | score_préparation ×1.5, exige toujours appui combiné | Berthier |
| **Économe** | score_pertes ×1.5, refuse > 20% pertes attendues | Drouot |

→ Même état du jeu, **conseils différents** selon les personnalités. Le conflit entre conseillers émerge naturellement.

### Principe philosophique

> Le conseiller ne donne pas un conseil objectif sur la situation. Il donne un conseil **subjectif**, basé sur **ce que TES yeux voient**, **avec TES outils disponibles**, **filtré par SA personnalité**, **dans TON timing**.

C'est cette **subjectivité multi-couche** qui produit l'asymétrie naturelle entre les 2 joueurs, sans avoir à scripter quoi que ce soit.

---

## 8. Conflit entre conseillers (la pépite)

Tes conseillers ne sont **pas d'accord entre eux**. Tu dois **arbitrer**.

**Exemple en bataille** : tu prépares une charge sur le flanc gauche ennemi.

- **Murat** (cavalerie agressif) : *"Sire, foncez ! La 3e brigade est fraîche, ils ne tiendront pas !"*
- **Savary** (renseignement) : *"Attention. Mes hommes signalent une réserve d'infanterie planquée dans le bois à droite. Embuscade probable."*
- **Drouot** (artillerie économe) : *"Si vous attendez 10 minutes, ma 5e batterie sera en position pour appuyer. Sans elle, vous aurez 30% de pertes en plus."*

→ **Trois avis crédibles, contradictoires**. Le joueur tranche. Reproduit fidèlement les conseils de guerre napoléoniens (Ney/Soult/Berthier).

---

## 9. Rétractation automatique

Cas tordu : conseil émis au tour 5, basé sur l'état au tour 5. Au tour 6, le contexte a changé radicalement (l'unité recommandée vient d'être détruite).

```
À chaque tick de tour :
  pour chaque conseil_actif :
    si ses prérequis ne sont plus valides :
      RÉTRACTATION : "Sire, oubliez mon conseil précédent — la situation a changé."
```

Ou simplement disparition silencieuse de l'UI. **Pas de fantômes de conseils obsolètes qui traînent.**

---

## 10. UI proposée

Panneau latéral compact dans la bataille :

```
┌─────────────────────┐
│ [👤] Berthier      ⬤│  ← LED active = il a qqch à dire
│ [👤] Murat            │
│ [👤] Drouot         ⬤│
│ [👤] Savary           │
│ [👤] Larrey           │
└─────────────────────┘
```

- **LED rouge clignotante** = alerte critique (priorité 8+)
- **LED jaune** = alerte standard (priorité 5-7)
- **Pas de LED** = info passive disponible si consultation
- **Cooldown global** : max 1 alerte spontanée par conseiller toutes les 30-60 secondes
- **Clic sur portrait** → mini-interface avec recommandations

→ Au pire 5 alertes/minute en bataille très active. Pas de bombardement.

---

## 11. Apprentissage progressif (mode campagne)

Un conseiller qui sert depuis longtemps **s'améliore**.

| Niveau | XP gagnée | Effet |
|---|---|---|
| Novice (1ère bataille) | 0 | Détecteurs de base, beaucoup de faux positifs |
| Expérimenté (5+ batailles) | 50 | Détecteurs affinés, +20% précision |
| Vétéran (15+ batailles) | 200 | Nouveaux détecteurs débloqués, scoring nuancé |
| Maître (30+ batailles) | 500 | Conseils stratégiques disponibles, templates personnalisés |

→ **Garder le même conseiller paie.** Le remplacer = repartir de zéro. Donne du **poids** à la mort/capture d'un conseiller.

### Adaptation au playstyle

Si le joueur ignore systématiquement un conseiller agressif, le conseiller devient plus prudent (s'adapte). Mode campagne uniquement.

---

## 12. Coûts et limites (anti-inflation)

- **Max 5 conseillers actifs** simultanément (un par domaine)
- Pas de cumul dans le même domaine (1 maître d'artillerie, pas 3)
- **Coût en or** : entretien, train de maison, secrétaires
- **Coût en réputation** : un conseiller célèbre attire l'attention politique (jalousies de cour)
- **Coût en confiance** : si le joueur ignore ses conseils trop souvent, **il démissionne** ou devient passif (-50% efficacité)

→ Il y a une **relation à entretenir** avec chaque conseiller.

---

## 13. Synergie avec les officiers capturés

Bouclage de la mécanique : **les vétérans récupérés en captivité deviennent les meilleurs conseillers**.

- Vétéran cavalerie (60 ans, 30 ans de service) capturé puis libéré → **Inspecteur de cavalerie** au QG
- Vétéran artillerie sur parole → **Maître d'artillerie**
- Médecin militaire blessé sur le terrain → **Médecin en chef** au QG

→ La boucle de capture/échange (BACKLOG-prisonniers-echanges) alimente directement le pool de conseillers. Aucun officier n'est perdu.

Validation historique : Berthier, Drouot, Larrey, Daru étaient tous des vétérans recyclés en conseillers spécialisés.

---

## 14. MVP itératif réaliste

Faire tout d'un coup = 3-6 mois de dev solo. **Approche itérative recommandée** :

| Phase | Contenu | Livrable |
|---|---|---|
| **Phase 1 (MVP)** | UN seul conseiller : chef d'EM. 5-7 détecteurs simples. Alertes seulement. UI minimaliste | Conseiller fonctionnel et testable |
| **Phase 2** | + maître d'artillerie + inspecteur cavalerie. Cooldown global. Premier scoring sur consultation | 3 conseillers tactiques |
| **Phase 3** | + personnalités + conflit entre conseillers. Pondérations différentes | Système subjectif et asymétrique |
| **Phase 4** | + templates stratégiques + apprentissage progressif | Système mature |

→ Chaque phase **livrable et jouable** indépendamment.

### Reco pratique

Commencer par **un seul conseiller bien fait** (chef d'EM, 5-7 détecteurs intelligents) avant d'en avoir 5 mal foutus. Un seul détecteur qui dit *"Sire, l'aile gauche va craquer dans 3 tours"* à un moment juste = **plus utile** que 50 détecteurs qui radotent.

**Prêt à virer 30% de tes détecteurs au playtest.** La plupart des règles imaginées au design ne marchent pas en pratique. C'est itératif.

---

## Lien avec les autres fiches

- **BACKLOG-prisonniers-echanges** : les vétérans récupérés alimentent le pool de conseillers
- **BACKLOG-communication-ordres** (session précédente) : les messagers/aides de camp sont la chaîne de transmission entre détection et conseil
- **BACKLOG-encadrement-officiers** : le chef d'EM conseiller est l'extension naturelle du pion EM divisionnaire
- **BACKLOG-blesses-systeme** : le médecin en chef conseiller pilote la doctrine médicale active

---

## Implications BDD

- `advisors` : pool de conseillers disponibles (background, niveau, spécialité, personnalité)
- `advisor_assignments` : conseillers actifs par camp (max 5)
- `advisor_xp` : tracking de l'expérience par conseiller
- `detectors_log` : historique des détections et émissions (pour debug et analyse)
- `player_advisor_trust` : jauge de confiance/écoute (pour adaptation comportement)

---

## Points encore à trancher

- Liste exhaustive des détecteurs par conseiller (5-10 chacun) → à formaliser pour le MVP Phase 1
- Valeurs exactes des seuils (probabilité de détection, cooldown, etc.)
- Tuning de l'UI (taille du panneau, sons d'alerte, animations LED)
- Mécanique exacte de "démission" d'un conseiller ignoré (mode campagne)
- Liste des templates stratégiques pour Phase 4
- Choix précis du conseiller MVP (chef d'EM ? maître d'artillerie ?)
- Localisation/i18n des messages des conseillers (français d'époque ? moderne ?)
