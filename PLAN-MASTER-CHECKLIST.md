# PLAN MASTER CHECKLIST — TACTICA

| # | Phase | Résumé features | État |
|---|---|---|---|
| 0 | **Foundations** | Vite/TS strict, Supabase auth + RLS, lobby, grille hex R3F, caméra contrainte, placeholders unités, Realtime, PWA. | 🟡 En cours (8/13, sous-lot 6A livré) |
| 1 | Combat MVP tactique multi humain | 4 unités, ordres simultanés, Edge `resolve_turn(scale)`, combat additif, prévision, victoire, chat. | ⬜ |
| 2 | IA solo tactique | Heuristiques pondérées, 3 difficultés, Bot vs Bot. | ⬜ |
| 3 | Profondeur tactique | Brouillard, météo, fatigue/moral, terrain, flancs/dos. | ⬜ |
| 4 | Rôles asymétriques | Général vs commandant, ordres délégués, vue limitée. | ⬜ |
| 5 | Relief 3D | Heightmap, biomes, modèles low-poly, billboards. | ⬜ |
| 6 | Polish esthétique | Post-processing, particules, sound, UI affinée. | ⬜ |
| 7 | Multiplateforme tablette | Touch controls, layouts adaptatifs. | ⬜ |
| 8 | **Niveau opérationnel** | Hex 500m, tour 30 min, multi-engagements, bascule. | ⬜ |
| 9 | Niveau stratégique + marche d'approche | Hex 5km, tour 1 jour, campagne, surprise. | ⬜ |
| 10 | Pause / reprise / asynchrone | Sauvegarde par tour, mode 1 tour/jour. | ⬜ |
| 11 | Classements / tournois / replays | Elo, scoring, tournois, replays 3 échelles, AAR. | ⬜ |
| 12 | Mode siège | Cartes 3 échelles, murs, famine/sape/sortie. | ⬜ |
| 13 | Open source / moddabilité | Refactoring, API mods, hot reload, GPL v3. | ⬜ |

---

## Phase 0 — Détail

| # | Sous-tâche | État | Lot | Notes |
|---|---|---|---|---|
| 0.1 | Init Vite + React + TS strict | ✅ | Lot 1 | |
| 0.2 | Tailwind + Radix + alias | ✅ | Lot 1 | |
| 0.3 | Supabase schéma + RLS | ✅ | Lot 2 | |
| 0.4 | Auth complète | ✅ | Lot 2-3 | |
| 0.5 | Lobby (CRUD) | ✅ | Lot 4 | |
| 0.6 | Hex cubique paramétré | ✅ | Lot 5 | 57 tests verts |
| 0.7 | SCALE_CONFIG | ✅ | Lot 5 | |
| 0.8 | Grille hex R3F | 🟡 | Lot 6 | **6A livré** : `/render-test` valide la scène |
| 0.9 | Caméra contrainte | 🟡 | Lot 6 | **6A livré** : `OrbitControls` lit `SCALE_CONFIG[scale].camera` |
| 0.10 | Placeholders unités | 🟡 | Lot 6 | **6A livré** : cylindres + Billboard I/C/A + count |
| 0.11 | Realtime sync lobby | ✅ | Lot 4 | |
| 0.12 | PWA manifest + SW | ⬜ | Lot 7 | |
| 0.13 | Skill `tactica` Claude | ⬜ | Lot 7 | |

---

## Découpage restants

- **Lot 6A** ✅ — Scène 3D R3F standalone testable sur `/render-test` (livré 09/05/2026)
- **Lot 6B** ⬜ — Intégration `Game.tsx` (3 zones : header + scène centrale + sidebar équipes), suppression `/render-test`, cochage 0.8 + 0.9 + 0.10
- **Lot 7** ⬜ — PWA + Skill

---

## Critères de fin de Phase 0

- [x] Compte créable
- [x] Création de partie
- [x] Rejoindre une partie
- [ ] Vue 3D R3F fonctionnelle (validable sur `/render-test`, intégration Game à venir 6B)
- [ ] Caméra contrainte (validable sur `/render-test`)
- [ ] Placeholders unités lisibles tous angles (validable sur `/render-test`)
- [x] Realtime sync 2 navigateurs
- [x] Architecture 3 niveaux préparée (`SCALE_CONFIG` + `HexGrid` paramétré)
- [ ] Scènes opérationnelle/stratégique placeholders sans crash (Phase 8 trivial avec l'archi posée)
- [x] `npm run tsc` 0 erreur
- [x] RLS active
- [ ] PWA installable
- [ ] Tag git `phase-0-complete`
