# PLAN MASTER CHECKLIST — TACTICA

Index global des 13 phases.

---

## Index des phases

| # | Phase | Résumé features | État |
|---|---|---|---|
| 0 | **Foundations** | Vite/TS strict, Supabase auth + RLS, lobby, grille hex R3F, caméra contrainte, placeholders unités, Realtime, PWA. Architecture 3 niveaux préparée. | 🟡 En cours (8/13 sous-tâches) |
| 1 | Combat MVP tactique multi humain | 4 types d'unités, ordres simultanés, Edge Function `resolve_turn(scale)`, combat par points additifs, prévision de combat, conditions de victoire, chat. | ⬜ |
| 2 | IA solo tactique | Heuristiques pondérées, 3 difficultés, mode bot dans lobby, Bot vs Bot. | ⬜ |
| 3 | Profondeur tactique | Brouillard de guerre, météo, fatigue/moral, terrain, flancs/dos. | ⬜ |
| 4 | Rôles asymétriques | Général vs commandant, ordres délégués, vue limitée, communication restreinte. | ⬜ |
| 5 | Relief 3D | Heightmap réelle, biomes, modèles low-poly, billboards 2D. | ⬜ |
| 6 | Polish esthétique | Post-processing, particules, sound design, UI affinée, équilibrage bot. | ⬜ |
| 7 | Multiplateforme tablette | Touch controls, layouts adaptatifs, tests iPad/Android. | ⬜ |
| 8 | **Niveau opérationnel** | Hex 500m, tour 30 min, multi-engagements, bascule tactique↔opérationnel. | ⬜ |
| 9 | Niveau stratégique + marche d'approche | Hex 5km, tour 1 jour, campagne, raccourcis/fatigue, surprise, bascule stratégique↔opérationnel. | ⬜ |
| 10 | Pause / reprise / asynchrone | Sauvegarde par tour, mode 1 tour/jour, notifications. | ⬜ |
| 11 | Classements / tournois / replays | Elo, scoring, tags réputation, tournois, replays 3 échelles, AAR. | ⬜ |
| 12 | Mode siège | Cartes 3 échelles, murs, unités spécialisées, famine/sape/sortie. | ⬜ |
| 13 | Open source / moddabilité | Refactoring moteur, API mods, hot reload, repo public GPL v3. | ⬜ |

**Légende** : ⬜ pas commencée · 🟡 en cours · ✅ validée

---

## Phase 0 — Détail des sous-tâches

| # | Sous-tâche | État | Lot | Notes |
|---|---|---|---|---|
| 0.1 | Init projet Vite + React + TS strict | ✅ | Lot 1 | |
| 0.2 | Tailwind + Radix + alias d'imports | ✅ | Lot 1 | |
| 0.3 | Supabase : schéma + RLS active | ✅ | Lot 2 | |
| 0.4 | Auth (signup/login/logout/reset) | ✅ | Lot 2-3 | Splitscreen 4 modes, carrousel images Ken Burns |
| 0.5 | Lobby (création/listing/join) | ✅ | Lot 4 | 4A migration + 4B Lobby + 4C Game + RLS fix recursive |
| 0.6 | Système coordonnées hex cubiques | ✅ | Lot 5 | flat-top, hexSize en paramètre, 57 tests verts |
| 0.7 | SCALE_CONFIG (3 échelles) | ✅ | Lot 5 | tactical/operational/strategic, hexSize=1.0 partout |
| 0.8 | Grille hex R3F paramétrée par scale | ⬜ | Lot 6 | HexGrid.tsx + HexTile.tsx |
| 0.9 | Caméra orbitale contrainte | ⬜ | Lot 6 | CameraController.tsx |
| 0.10 | Placeholders unités | ⬜ | Lot 6 | UnitPlaceholder.tsx |
| 0.11 | Realtime Supabase (sync lobby + game) | ✅ | Lot 4 | useRealtime générique + branché Lobby et Game |
| 0.12 | PWA (manifest + service worker) | ⬜ | Lot 7 | |
| 0.13 | Skill `tactica` côté Claude | ⬜ | Lot 7 | |

**Découpage en lots restants** :

- **Lot 4A/B/C** ✅ — Lobby, Game, RLS fix
- **Lot 5** ✅ — Hex foundation + SCALE_CONFIG (engine pur, 57 tests verts)
- **Lot 6** ⬜ — R3F render (HexGrid + Camera + UnitPlaceholder) — première vue 3D
- **Lot 7** ⬜ — Finitions (PWA + Skill)

---

## Critères de fin de Phase 0

- [x] Compte créable et utilisable
- [x] Création de partie depuis le lobby fonctionnelle
- [x] Rejoindre une partie ajoute un slot
- [ ] Vue 3D R3F fonctionnelle (grille hex tactique navigable)
- [ ] Caméra contrainte
- [ ] Placeholders unités lisibles
- [x] Realtime sync entre 2 navigateurs
- [x] Architecture 3 niveaux préparée (`SCALE_CONFIG` ✅, `HexGrid` paramétré → Lot 6, `current_scale` BDD ✅)
- [ ] Scènes opérationnelle/stratégique placeholders sans crash
- [x] `npm run tsc` 0 erreur
- [x] RLS active sur toutes les tables
- [ ] PWA installable
- [ ] Commit propre poussé avec tag `phase-0-complete`

---

## Quand passer à Phase 1

Tous les critères ci-dessus cochés + 1-2 potes ont testé sans aide + zéro bug bloquant.
