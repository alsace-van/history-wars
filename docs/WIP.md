# WIP.md

---

## Session 10 &mdash; 09/05/2026 &mdash; Phase 0 Lot 6 sous-lot 6B : intégration TacticalScene dans Game.tsx

**Fait** :
- `src/ui/game/TeamPanel.tsx` v1.0 : extraction du composant `TeamPanel` (était inline dans Game.tsx). Ajout prop `compact` pour le mode sidebar (padding/font size réduits).
- `src/ui/pages/Game.tsx` v2.0 : refonte complète layout 3 zones :
  - Header (sticky top, inchangé).
  - Body flex horizontal avec `flex-1` pour la zone scène et `w-[340px]` sidebar droite.
  - Zone scène : game-header inline (titre + meta condensés) au-dessus + `<TacticalScene />` plein espace.
  - Sidebar : 2 panneaux équipes en compact + footer actions sticky.
  - Disque hex rayon 5 (91 hex) via `spiral({0,0,0}, 5)`, 6 unités factices via `buildMvpUnitPlacement()`.
- `src/App.tsx` v1.0e : route `/render-test` supprimée.
- Page `RenderTest.tsx` à supprimer manuellement côté repo.

**Sous-tâches Phase 0 validées** :
- 0.8 (Grille hex R3F) : ✅
- 0.9 (Caméra contrainte) : ✅
- 0.10 (Placeholders unités) : ✅

**À faire côté utilisateur** :
1. **Supprimer `src/ui/pages/RenderTest.tsx`** (n'est plus référencé).
2. `npm run tsc` 0 erreur, `npm run test` 63 verts.
3. `npm run dev`, login, `/lobby`, créer une partie → `/game/:id` :
   - Header en haut, scène 3D au centre prenant l'espace, sidebar 340px à droite avec les 2 équipes + boutons.
   - 91 hex jointifs + 6 unités factices visibles.
   - Drag/zoom/pan fonctionnent.
   - Realtime : 2e navigateur rejoint → tu vois le slot rouge se remplir dans la sidebar sans refresh.
   - Kick / leave / dissoudre fonctionnent comme avant.

**Phase 0 — état** : 11/13 sous-tâches. Reste 0.12 (PWA) + 0.13 (Skill).

**Prochain Lot** :
- Lot 7 : finitions (PWA + skill `tactica`).

---

## Session 9 &mdash; 09/05/2026 &mdash; Phase 0 Lot 6 sous-lot 6A

- engine render : colors, types, scenes/SceneShell+Loader+TacticalScene, hex/HexGrid+HexTile, camera/CameraController, units/UnitPlaceholder, lighting, _data/mvpUnitPlacement.
- Page démo `/render-test`.
- 6 nouveaux tests (63 total).
- 3 hotfixes HexTile : retrait rotation incorrecte, edges custom (sans diagonales internes), Shape+ExtrudeGeometry pour aligner mesh sur cubeToWorld.

---

## Session 8 &mdash; 08/05/2026 &mdash; Lot 5 hex foundation + SCALE_CONFIG

57 tests verts.

---

## Session 7 &mdash; 08/05/2026 &mdash; Lot 4C page Game + RLS fix

Migrations 004 + 005 (SECURITY DEFINER + drop legacy policies).

---

## Session 6 &mdash; 08/05/2026 &mdash; Lot 4B hooks + Lobby React

sonner, useRealtime, useGames, Lobby.tsx, CreateGameDialog, GameCard.

---

## Session 5 &mdash; 08/05/2026 &mdash; Lot 4A migration BDD + types + maquettes

Migration 003, types/game.ts, 2 maquettes HTML.

---

## Session 4 &mdash; 08/05/2026 &mdash; Lot 2 carrousel images réelles

Bouvines, Austerlitz, Verdun.

---

## Session 3 &mdash; 08/05/2026 &mdash; Lot 2 addendum carrousel

AuthBackground.tsx Ken Burns 4 slides.

---

## Session 2 &mdash; 08/05/2026 &mdash; Lot 2

Migrations 001 + 002, composants atomes, Auth.tsx, hooks auth.

---

## Session 1 &mdash; 08/05/2026 &mdash; Lot 1

Init Vite + React 18 + TS strict + Tailwind + Supabase.
