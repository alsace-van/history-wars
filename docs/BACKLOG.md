# BACKLOG.md

Idées hors scope de la phase courante. À évaluer plus tard, pas à oublier, pas à implémenter maintenant.

Format : 1-2 lignes par item, étiquettes entre crochets.

---

## Phase 1.5 — backlog enrichi

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
- **[refacto]** Bouger `handleTileClick` (déclenche `aStar` + `submitAction` + `setUnitPaths`) dans le hook `useTacticalSelection` — réduit Game.tsx 560 → ~400 lignes.
- **[refacto]** `src/hooks/useGameRealtime.ts` créé en L1C.1 jamais câblé. Décider en début Phase 2 : brancher (avec hook unifié) ou supprimer.
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
