# BACKLOG.md

Idées hors scope de la phase courante. À évaluer plus tard, pas à oublier, pas à implémenter maintenant.

Format : 1-2 lignes par item, étiquettes entre crochets.

---

## Phase 3.3 — issues différées (session 22)

- **[gameplay Phase 5]** **Vrai mode sentinelle temps-réel** : aujourd'hui les ordres `fire` (mode alerte) sont évalués UNE fois en début du tour entrant (snapshot-then-resolve). Plus tard : évaluer pendant le mouvement adverse (réaction immédiate dès qu'un ennemi entre dans la portée). Conditionne IA Phase 4 (l'IA devra prévoir le risque de réaction côté humain). Origine : feedback user 13/05 session 22.
- **[gameplay Phase 5]** **Vraie jauge d'endurance** pour remplacer le placeholder "−1 morale par déclenchement d'ordre fire" (cf. `applyFireOrderCombat` v1.2). Modèle : `endurance INT 0-100`, −5 par déclenchement, +2/tour de repos. Sous 30 → bonus défense, sous 10 → routed automatique. Voir aussi backlog Phase 5 jauge endurance dédiée. Origine : user 13/05 "il faut juste trouver un truc pour pas en abuser".
- **[gameplay Phase 3.3 follow-up]** **`charge` order applique réellement le combat mêlée + charge cav**. Actuellement (`_evaluateOrders.ts` v1.2) charge fait juste déplacement + INSERT engagement sans dégâts ni détection charge cav (`isChargeApplicable` non vérifié). Symétrique de `fire` mais avec lastMovePath synthétique (depuis position d'origine vers destHex) + handling riposte + dissolution si défenseur tué.
- **[ux Phase 3.3 follow-up]** **Notification "ton ordre déclenché"** côté owner : aujourd'hui le toast `useCombatActions.endTurn` v2.4 dit "Ordre adverse déclenché" car la string est vue par l'outgoing player (= adversaire de l'owner). Pour l'owner, la notification arrive via Realtime `useCombatNotifications` (attack_melee/attack_ranged inséré par fire). OK pour les déclenchements avec combat, mais `hold` et `retreat` n'insèrent QUE `order_triggered` qui n'est pas écouté par useCombatNotifications. Ajouter listener `order_triggered` filtré sur owner_user_id pour qu'il voie ses ordres exécutés.

## Phase 3.2-bis — issues différées (session 21)

- **[bdd — petite migration]** Stabilisation `ordinal_index` des pions (`I.1`, `I.2`...). Aujourd'hui calculé à l'affichage par `computeOrdinalLabels(units)` dans l'ordre `created_at` → si un pion meurt, les n° suivants se décalent (`I.2` devient `I.1`). Persister via colonne `units.ordinal_index INTEGER NOT NULL` set à start_battle, ne change jamais. Pas urgent, feedback user requis si la décalage gêne.
- **[ux/render Phase 5]** Vraie animation de combat 3D (au-delà du DamageFloater) : pulse rouge sur unité engagée, particules de cliquetis entre les 2 hexes, son. Évoqué session 21 lors de la clarté engagement.
- **[gameplay Phase 5]** Jauge d'endurance dédiée distincte du moral (cf. PLAN-MASTER-V2 Phase 5). Aujourd'hui simulée via `ENGAGEMENT_MORALE_DELTA_PER_TURN=-1` (fatigue continue). User a demandé une vraie jauge si on s'éloigne du système moral combiné.
- **[gameplay Phase 5]** **Mode "campement"** (4ᵉ posture en plus de charge/fire/retreat/hold). La troupe se relâche : régénération morale (+5/tour), soin des blessés par un **Infirmier** adjacent (rend `wounded → effective`), ravitaillement (consomme stock régiment). Trade-off : aucune défense — facilement surpris si attaqué. Sortie du mode automatique sur trigger `on_attacked`. Pré-requis : unité Infirmier (`subKind='medic'` côté A ?), stock régiment, UI bouton "campement". Origine : user 14/05 session 22 conversation "bonus défensif hold". Voir aussi [[feedback_no_icon_overlap]] pour l'icône (tente / feu de camp).
- **[bdd one-shot]** SQL recompute `routed` pour parties existantes : avec le changement Phase 3.2-bis (routed basé sur effectif), les parties en cours peuvent avoir `routed=true` stocké par l'ancienne règle (morale<25). Auto-corrigé au prochain `resolve_turn`, mais possible de forcer via `UPDATE units SET routed = (effective::float / effective_max) < 0.20` si demande user pour parties bloquées.

## Phase 2.6 — engagement persistant (design figé)

- **[design figé]** Combat continu : engagement entre 2 unités adjacentes = état persistant, attrition par tour, relève 10 % depuis les réserves arrière. Origine : feedback user 11/05 "une fois qu'un combat est entamé ça va jusqu'au bout". Voir [`PLAN-ENGAGEMENT-PERSISTENT.md`](./PLAN-ENGAGEMENT-PERSISTENT.md). ~5 jours.
- **[gameplay]** Action `engage` (clic explicite — pas d'auto, permet contournement) + action `break_combat` (coût fixe 10 % effective).
- **[gameplay]** Cavalerie : charge ponctuelle inchangée. Après impact, menu joueur : Rester en mêlée (malus def×0.8 + attrition ×1.3) OU Replier 1 hex (gratuit).
- **[gameplay]** Tireurs : pas d'engagement auto. Si ennemi adjacent clique "Engager", bascule en mêlée forcée (tireur très vulnérable).
- **[render]** Anneau pulsant rouge + ligne 3D entre les 2 pions engagés.
- **[bdd]** Migration 015 : table `engagements (game_id, unit_a_id, unit_b_id, started_turn)` + RLS + Realtime.

## Phase 2.5 — moral / cohésion / soutien (design figé)

- **[ux/communication]** Afficher "Hommes engagés au contact: X / Y" + cap terrain dans le `CombatResultPanel` et `CombatPreviewTooltip`. Aujourd'hui peu intuitif : 750 vs 450 hommes I vs I sur plaine_standard font les mêmes dégâts (~16) car les 2 sont limités à 200 hommes engagés. C'est le design Thermopyles voulu, mais l'UI ne le dit pas. Origine : feedback user 11/05 "dégâts toujours 10-11 peu importe l'effectif".
- **[balance]** Pondération `baseAttritionRate` (0.08) à revoir selon retour humain. Actuellement à égalité parfaite = 8% des hommes engagés morts/tour. Tester 0.06 (plus lent) ou 0.10 (plus dynamique).
- **[design figé]** Refonte routed binaire → 3 états (Nominal / Ébranlé / Brisé) avec score de cohésion `0.5×moral + 0.3×effectif + 0.2×soutien`. Soutien = alliés rayon 1+2 (plafond 3). Voir [`PLAN-MORAL-COHESION.md`](./PLAN-MORAL-COHESION.md). Origine : soft-lock Session 16 (PR #27). ~4 jours.
- **[ux]** Modale confirmation attaque pour Ébranlé (skipable via `useSettings`).
- **[ux]** Panneau "État critique" pour Brisé : Retraite / Reddition / Combat suicide (selon encerclement et effectif global camp).
- **[render]** Anneau état multi-couleurs (vert/jaune/orange clair/orange foncé) + anneau bleu soutien superposé.
- **[gameplay]** Actions `retreat` (move 1 hex direction choisie + désertion si pertes ≥ 50%), `surrender` (élimination + bonus moral adverse +10 / malus camp -10), `suicide_attack` (×1.5 dégâts, pas de riposte, unité éliminée).
- **[gameplay]** Reconstitution Brisé conditionnée à effectif ≥ 25% kind, sinon merge ou soin Infirmier (Phase 5 unité).

## Phase 1.5 — backlog enrichi

- **[ux Phase 6]** Remplacer le `CombatResultPanel` actuel (panneau texte X-fermable) par une **animation messager** : un cavalier bleu/rouge traverse l'écran et délivre le rouleau de pertes (illustre le "porte-message" historique). Le contenu reste identique mais la présentation est plus immersive.
- **[balance]** Rebalance ratio split killed/wounded par `UnitKind` : artillerie 0.7 (plus létal), cavalerie 0.65, infanterie 0.55-0.6, futurs siège 0.85 (massacre). Actuellement uniforme 0.6.
- **[gameplay]** Unité Infirmier (Phase 3) : action `heal` qui transfère `wounded → hp` au taux X/tour avec portée 1 hex. Consomme un point d'ordre.
- **[gameplay]** Récupération naturelle wounded en fin de tour : 5 % du `wounded` total transféré vers `hp` si l'unité n'a pas combattu et n'est pas en ZdC ennemie. Pré-requis Infirmier ou en complément.
- **[ux]** Fusion toasts combat rapprochés : si 2+ actions de combat sur la même unité du défenseur dans la même seconde, agréger en 1 toast au lieu d'en empiler 2-3.
- **[piège #50]** Realtime payload INSERT `game_actions` peut arriver avant le DELETE/UPDATE `units` → lookup `kind` côté client null. Mitigation actuelle = fallback "Unité ennemie". Futur : enrichir `AttackResult` côté EF avec `attacker_kind` + `defender_kind`.

## Phase 1 — reports / dette technique

- **[asset]** Compresser `public/models/soldier.glb` (~5 Mo, 10 % du bundle) via Draco + KTX2 → cible < 500 Ko. Impact PWA install size.
- **[asset]** Vrais uniformes par période historique : 1 mesh par `scenario_id` ou par `UnitKind`, plus juste le même soldat tinté bleu/rouge.
- **[gameplay]** Vitesse km/h réaliste par `UnitKind` : `SECONDS_PER_HEX = SCALE_CONFIG[scale].metersPerHex / (kmh * 1000 / 3600)` avec kmh par kind (infanterie 5, cavalerie 12, artillerie 3). Actuellement 1 s/case en dur.
- **[anim]** Mouvement plus organique : courbes Bézier ou ease-in-out global sur le path entier, plutôt que linear segment-par-segment.
- **[refacto]** Bouger `handleTileClick` (déclenche `aStar` + `submitAction` + `setUnitPaths`) dans le hook `useTacticalSelection` — réduit Game.tsx 588 → ~450 lignes (gain de marge sous le seuil 600).
- ~~`src/hooks/useGameRealtime.ts` créé en L1C.1 jamais câblé~~ — **résolu session 14** (câblé dans Game.tsx v3.14, remplace useRealtime inline).
- **[ux]** Transfert d'hôte au lieu de dissolution : quand l'host quitte une partie `in_progress`, transférer la propriété au plus ancien restant au lieu de dissoudre (`games_delete_host` actuellement permet à l'host de tout dissoudre).
- **[ux]** Sélection drag&drop figurine en complément du click. Reporté Phase 6 polish (Phase 7 tablette : touch events).
- **[ux]** Inspection unité ennemie en cliquant : actuellement `handleUnitClick` rejette les clics sur ennemis (sauf targetable → attaque). Permettre l'inspection pure pour voir leurs stats.

## Phases futures

- Mode "Battle normale" vs "Historique" → post-Phase 1.
- Aura général + propagation panique → Phase 3.
- Replay URL partageable `/replay/{game_id}` → Phase 11.
- RLS units : vue SQL filtrée pour fog of war → Phase 4.
- HexTile materials adaptatifs au terrain (heightmap, biome) → Phase 5 relief.
- ScalingTransition tactique ↔ opérationnel → Phase 8.
- **[design — phase 8 opérationnel]** Boucle opérationnelle complète : carte régionale type "campagne" + **objectifs cliquables sur la map** (ville, pont, col, ravitaillement) assignables à chaque régiment + **cycle jour/nuit** (marche le jour, bivouac la nuit avec récup cohésion/fatigue) + **marche automatique multi-jours** vers l'objectif assigné (pauses bivouac automatiques) + **bascule auto vers tactique** à l'arrivée sur objectif disputé ou à la rencontre. Origine : feedback user 12/05 — "il faudra faire évoluer le gameplay quand la map sera plus grande". Voir [`backlogs/BACKLOG-trois-echelles.md`](./backlogs/BACKLOG-trois-echelles.md) § 13.
- **[ux/mod]** **Menu de personnalisation assets** → Phase 13 moddabilité. Permettre à l'utilisateur d'importer ses propres `.glb` (par `UnitKind` ou par `subKind` historique) + ses icônes UI (drapeau camp, icônes ordres, marqueurs hex). Storage Supabase par user, hot-reload côté client. Origine : feedback user 12/05 (1ère intégration `cavalier.glb` manuelle). Pré-requis : pipeline auto de compression à l'upload (gltf-transform `optimize --simplify-ratio 0.15 --compress meshopt --texture-compress webp`), validation taille max (cible < 5 MB par modèle), bounding box auto-normalisée à la hauteur unitaire 2.0 (évite les ajustements de scale manuels comme `CAVALRY_BBOX_SCALE`).
