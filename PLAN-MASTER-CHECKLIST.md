# PLAN MASTER CHECKLIST — TACTICA

Index global des 13 phases. Mis à jour à la fin de chaque phase.

**Méthode** : pour chaque phase, on fait un audit réel du code livré, puis on coche la phase si tous les critères sont validés. Un audit détaillé + plan de la phase suivante est livré dans un `.md` dédié (`AUDIT-PHASE-N.md`).

---

## Index des phases

| # | Phase | Résumé features | État |
|---|---|---|---|
| 0 | **Foundations** | Vite/TS strict, Supabase auth + RLS, lobby, grille hex R3F, caméra contrainte, placeholders unités, Realtime, PWA. Architecture 3 niveaux préparée. | 🟡 En cours (6/13 sous-tâches, Lot 4 terminé) |
| 1 | Combat MVP tactique multi humain | 4 types d'unités, ordres simultanés, Edge Function `resolve_turn(scale)`, combat par points additifs, prévision de combat, conditions de victoire, chat. Realtime sync inter-joueurs. | ⬜ |
| 2 | IA solo tactique | Heuristiques pondérées (défense, terrain, flancs, fatigue), 3 difficultés, mode bot dans lobby, mode Bot vs Bot pour tests. | ⬜ |
| 3 | Profondeur tactique | Brouillard de guerre, météo, fatigue/moral avancés, terrain influence combat, flancs/dos. | ⬜ |
| 4 | Rôles asymétriques | Général vs commandant, ordres délégués, vue limitée par rôle, communication restreinte. | ⬜ |
| 5 | Relief 3D | Heightmap réelle, biomes, modèles low-poly via Meshy/Tripo3D + animations Mixamo, billboards 2D pour effectifs. | ⬜ |
| 6 | Polish esthétique | Post-processing, particules combat, sound design, UI affinée, équilibrage par bot vs bot. | ⬜ |
| 7 | Multiplateforme tablette | Touch controls, layouts adaptatifs, tests iPad/Android. | ⬜ |
| 8 | **Niveau opérationnel** | Hex large (500m), tour 30 min, multi-engagements, bascule tactique↔opérationnel. Pierre angulaire de l'unicité TACTICA. | ⬜ |
| 9 | Niveau stratégique + marche d'approche | Hex géant (5km), tour 1 jour, campagne, raccourcis/fatigue, surprise mécanique, bascule stratégique↔opérationnel. | ⬜ |
| 10 | Pause / reprise / asynchrone | Sauvegarde par tour, reprise propre, mode 1 tour/jour, notifications. | ⬜ |
| 11 | Classements / tournois / replays | Elo par mode/rôle, scoring fin de bataille, tags réputation, tournois auto, replays navigables 3 échelles, AAR. | ⬜ |
| 12 | Mode siège | Cartes dédiées 3 échelles, murs brisables, unités spécialisées, famine/sape/sortie, temps long. | ⬜ |
| 13 | Open source / moddabilité | Refactoring moteur/données, API mods documentée, hot reload, repo public GPL v3, tutoriel mod. | ⬜ |

**Légende** : ⬜ pas commencée · 🟡 en cours · ✅ validée et terminée

---

## Phase 0 — Détail des sous-tâches

| # | Sous-tâche | État | Lot | Notes |
|---|---|---|---|---|
| 0.1 | Init projet Vite + React + TS strict | ✅ | Lot 1 | package.json OK, deps installées, structure dossiers complète |
| 0.2 | Configuration Tailwind + Radix + alias d'imports | ✅ | Lot 1 | tsconfig + vite.config alignés, palette tokens HSL shadcn |
| 0.3 | Supabase : schéma initial avec colonne `scale`, RLS active | ✅ | Lot 2 | tables `profiles`, `games`, `game_players`. Trigger `handle_new_user` sécurisé |
| 0.4 | Auth (signup, login, logout, reset, update password) | ✅ | Lot 2-3 | Splitscreen 4 modes, carrousel 3 images réelles avec Ken Burns, citations sync |
| 0.5 | Lobby (création / listing / join parties) | ✅ | Lot 4 | Migration `003`, types `game.ts`, hooks `useGames` + `useGame` + `useRealtime`, page `Lobby.tsx`, page `Game.tsx`, modale `CreateGameDialog`, slots, kick, dissolution, leave. Migrations 004 + 005 pour fix RLS récursive. |
| 0.6 | Système coordonnées hex cubiques paramétrées | ⬜ | Lot 5 | engine/hex/coordinates.ts, distance.ts, neighbors.ts. **hexSize en paramètre obligatoire** |
| 0.7 | SCALE_CONFIG (tactical/operational/strategic) | ⬜ | Lot 5 | engine/scales/config.ts + types.ts. Hex size, time per turn, contraintes caméra par échelle |
| 0.8 | Grille hex R3F paramétrée par scale | ⬜ | Lot 6 | HexGrid.tsx + HexTile.tsx, instanciable n'importe quelle échelle |
| 0.9 | Caméra orbitale contrainte (profil par scale) | ⬜ | Lot 6 | CameraController.tsx, contraintes pan/zoom/rotation depuis SCALE_CONFIG |
| 0.10 | Placeholders unités (cylindres colorés) | ⬜ | Lot 6 | UnitPlaceholder.tsx, 'I'/'C'/'A', team blue/red |
| 0.11 | Realtime Supabase (sync lobby) | ✅ | Lot 4 | Publication étendue à `games` + `game_players`. Hook `useRealtime` paramétré (postgres_changes + presence). Branché sur Lobby (sync liste + officiers en ligne) et Game (sync slots + dissolution partie). |
| 0.12 | PWA (manifest + service worker) | ⬜ | Lot 7 | vite-plugin-pwa à installer, manifest.json, icons 192/512 |
| 0.13 | Skill `tactica` côté Claude | ⬜ | Lot 7 | /mnt/skills/user/tactica/SKILL.md avec conventions Phase 0 + architecture 3 niveaux |

**Découpage en lots restants** :

- **Lot 4A** ✅ — Migration BDD + types + maquettes HTML + cleanup SVG (livré 08/05/2026)
- **Lot 4B** ✅ — Hooks `useGames` + `useRealtime` + page `Lobby.tsx` + `CreateGameDialog.tsx` + `GameCard.tsx` + `PageBackground.tsx` + suppression `Home.tsx` + redirection `/` → `/lobby` + install `sonner` (livré 08/05/2026)
- **Lot 4C** ✅ — Hook `useGame` + `PlayerSlot` + page `Game.tsx` + route `/game/:id` + migrations 004 et 005 (fix RLS récursive et legacy policies) + pitfalls 8-9 (livré 08/05/2026)
- **Lot 5** ⬜ — Hex foundation pure (0.6 + 0.7) — code moteur, pas de React, testable Vitest
- **Lot 6** ⬜ — R3F render (0.8 + 0.9 + 0.10) — première vue 3D
- **Lot 7** ⬜ — Finitions (0.12 + 0.13)

---

## Critères de fin de Phase 0

- [x] Compte créable et utilisable (vérifié en BDD)
- [x] Création de partie depuis le lobby fonctionnelle
- [x] Rejoindre une partie ajoute un slot
- [ ] Vue 3D R3F fonctionnelle (grille hex tactique navigable)
- [ ] Caméra contrainte (impossible de passer sous le sol ou de zoomer trop loin)
- [ ] Placeholders unités lisibles depuis tous les angles
- [x] Realtime sync entre 2 navigateurs (l'un voit l'autre rejoindre)
- [ ] Architecture 3 niveaux préparée (`SCALE_CONFIG`, `HexGrid` paramétré, `current_scale` en BDD) — partiel : `current_scale` en BDD ✅, reste SCALE_CONFIG (Lot 5)
- [ ] Scènes opérationnelle/stratégique placeholders sans crash
- [x] `npm run tsc` 0 erreur
- [x] RLS active sur toutes les tables (testé)
- [ ] PWA installable (icône Installer dans Chrome)
- [ ] Commit propre poussé avec tag `phase-0-complete`

---

## Quand passer à Phase 1

Tous les critères ci-dessus cochés + 1-2 potes ont testé l'inscription et création de partie sans aide + zéro bug bloquant connu.

À la fin de Phase 0, je livre `AUDIT-PHASE-1.md` avec audit du code Phase 0 final + plan détaillé Phase 1.
