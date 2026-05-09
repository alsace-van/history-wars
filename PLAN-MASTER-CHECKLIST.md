# PLAN MASTER CHECKLIST — TACTICA

| # | Phase | Résumé features | État |
|---|---|---|---|
| 0 | **Foundations** | Init Vite/TS, Auth, Lobby, hex cubique, SCALE_CONFIG, R3F, caméra, placeholders unités, Realtime, PWA, Skill | ✅ 13/13 |
| 1 | Combat MVP tactique | Mouvement hex, ZdC, combat distance + corps-à-corps, moral, ligne de vue basique | ⬜ |
| 2 | IA solo | IA tactique heuristique, profils difficulté, simulation tour | ⬜ |
| 3 | Profondeur tactique | Terrain (forêt/colline/rivière), formations, fatigue, ravitaillement | ⬜ |
| 4 | Rôles asymétriques | Commandant/scout/artilleur, brouillard de guerre, ordres limités | ⬜ |
| 5 | Relief 3D | Heightmap, normales, post-processing, eau/végétation | ⬜ |
| 6 | Polish esthétique | Animations, particules, bannières, sons, ambiance période | ⬜ |
| 7 | Tablette | Touch, layout responsive, gestures, orientation | ⬜ |
| 8 | Niveau opérationnel | Hex × 10-20, journées, logistique, corps d'armée | ⬜ |
| 9 | Niveau stratégique | Hex × 100, semaines, économie, recrutement, diplomatie | ⬜ |
| 10 | Asynchrone | Tour différé, notifications, Background Sync API | ⬜ |
| 11 | Tournois / replays | Bracket, ladder ELO, replays sérialisés | ⬜ |
| 12 | Mode siège | Cartes urbaines, fortifications, brèches | ⬜ |
| 13 | Open source | Licence, docs publiques, modabilité JSONB, modding | ⬜ |

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
| 0.12 | PWA manifest + SW | ✅ | 7 |
| 0.13 | Skill `tactica` Claude | ✅ | 7 |

---

## Lots livrés

- **Lot 1** ✅ Init Vite + TS strict + Tailwind + Supabase singleton
- **Lot 2-3** ✅ Auth complète + carrousel Ken Burns 3 batailles
- **Lot 4** ✅ Lobby CRUD + Realtime + page Game slots
- **Lot 5** ✅ engine/hex + engine/scales (57 tests)
- **Lot 6** ✅ render/* intégré dans Game.tsx layout 3 zones
- **Lot 7** ✅ PWA + skill `tactica` + closure Phase 0

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
- [x] Scènes opérationnelle/stratégique placeholders sans crash
- [x] `npm run tsc` 0 erreur
- [x] RLS active
- [x] PWA installable (Lot 7)
- [x] Skill `tactica` créé (Lot 7)
- [ ] Tag git `phase-0-complete` (à pousser côté repo)

---

## Cadre transverse — règles non négociables

1. Architecture 3 niveaux : zéro hardcode, tout via `SCALE_CONFIG` ou tables.
2. Frontière `engine/` ↔ `render/` ↔ `ui/` étanche.
3. Z = hauteur (Fusion 360), conversion Y↔Z encapsulée dans `render/`.
4. Hex flat-top cubique, voisins `0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE`.
5. TS strict, pas de `any`.
6. Fichiers max 500-600 lignes.
7. Hooks React : ajout en queue, jamais déplacer.
8. Header versioning 4 entrées max + TAG `console.log` matche.
9. RLS active sur toute nouvelle table + `Supabase:get_advisors`.
10. `service_role` jamais côté client.
11. Try/catch + toast sonner sur tout async.
12. Maquette HTML d'abord pour modale/popup.

---

## Pièges connus (cumulatif)

1. Mélanger conventions hex.
2. Oublier RLS sur table.
3. Hardcoder valeurs de jeu.
4. Hardcoder `hexSize` dans `HexGrid`.
5. Confondre Y et Z dans Three.js.
6. Coupler composant render à une échelle.
7. Edge Function par échelle au lieu de `resolve_turn(scale)`.
8. RLS récursive → `SECURITY DEFINER` (Lot 4 migrations 003→004).
9. Policies legacy non droppées lors d'un fix RLS (Lot 4 migration 005).
10. `registerType: 'prompt'` sans `<UpdatePrompt />` monté (Lot 7).
11. `virtual:pwa-register/react` introuvable en dev avec `devOptions.enabled: false` (Lot 7).

---

**État courant** : **Phase 0 complète**. Prochaine session : audit + plan master Phase 1 (Combat MVP tactique).
