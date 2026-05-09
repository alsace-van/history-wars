# PLAN MASTER CHECKLIST — TACTICA

| # | Phase | État |
|---|---|---|
| 0 | **Foundations** | 🟡 11/13 |
| 1 | Combat MVP tactique | ⬜ |
| 2 | IA solo | ⬜ |
| 3 | Profondeur tactique | ⬜ |
| 4 | Rôles asymétriques | ⬜ |
| 5 | Relief 3D | ⬜ |
| 6 | Polish esthétique | ⬜ |
| 7 | Tablette | ⬜ |
| 8 | Niveau opérationnel | ⬜ |
| 9 | Niveau stratégique | ⬜ |
| 10 | Asynchrone | ⬜ |
| 11 | Tournois / replays | ⬜ |
| 12 | Mode siège | ⬜ |
| 13 | Open source | ⬜ |

---

## Phase 0 — Détail

| # | Sous-tâche | État | Lot |
|---|---|---|---|
| 0.1 | Init Vite + React + TS strict | ✅ | 1 |
| 0.2 | Tailwind + Radix + alias | ✅ | 1 |
| 0.3 | Supabase schéma + RLS | ✅ | 2 |
| 0.4 | Auth complète | ✅ | 2-3 |
| 0.5 | Lobby (CRUD) | ✅ | 4 |
| 0.6 | Hex cubique paramétré | ✅ | 5 |
| 0.7 | SCALE_CONFIG | ✅ | 5 |
| 0.8 | Grille hex R3F | ✅ | 6 |
| 0.9 | Caméra contrainte | ✅ | 6 |
| 0.10 | Placeholders unités | ✅ | 6 |
| 0.11 | Realtime sync lobby | ✅ | 4 |
| 0.12 | PWA manifest + SW | ⬜ | 7 |
| 0.13 | Skill `tactica` Claude | ⬜ | 7 |

---

## Lots restants

- **Lot 7** ⬜ — PWA + Skill (finitions Phase 0)

---

## Critères de fin de Phase 0

- [x] Compte créable
- [x] Création de partie
- [x] Rejoindre une partie
- [x] Vue 3D R3F fonctionnelle
- [x] Caméra contrainte
- [x] Placeholders unités lisibles tous angles
- [x] Realtime sync 2 navigateurs
- [x] Architecture 3 niveaux préparée
- [x] Scènes opérationnelle/stratégique placeholders sans crash (architecture prête)
- [x] `npm run tsc` 0 erreur
- [x] RLS active
- [ ] PWA installable (Lot 7)
- [ ] Tag git `phase-0-complete` (après Lot 7)
