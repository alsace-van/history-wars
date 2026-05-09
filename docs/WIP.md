# WIP.md

Journal des sessions, plus recente en haut. 10 max.

---

## Session 9 &mdash; 09/05/2026 &mdash; Phase 0 Lot 6 sous-lot 6A : scene 3D R3F standalone

**Fait** :
- `src/types/game.ts` v1.0a : ajout `export type UnitKind = 'I' | 'C' | 'A'` (Infanterie/Cavalerie/Artillerie).
- `src/render/colors.ts` v1.0 : constantes hex Three.js (teamBlue, teamRed, amber, tile colors). Synchro avec tokens Tailwind.
- `src/render/types.ts` v1.0 : `UnitInstance`, `HexTileState`, `HexTileVisibility`.
- `src/render/_data/mvpUnitPlacement.ts` v1.0 : 6 unites factices (3 vs 3, 1 de chaque type par equipe). Distance min blue-red >= 4 hex.
- `src/render/_data/mvpUnitPlacement.test.ts` : 6 tests verts (count, types, sides, distances, ids).
- `src/render/lighting/SceneLighting.tsx` v1.0 : ambient + directional principale + fill light.
- `src/render/hex/HexTile.tsx` v1.0 : cylindre tres aplati (CylinderGeometry 6 segments) + LineSegments edges, geometrie partagee. memo. States : idle/hover/selected (+ visibility fog/hidden).
- `src/render/hex/HexGrid.tsx` v1.0 : grille parametree par scale (lit `SCALE_CONFIG[scale].hexSize`), gere hover state local.
- `src/render/units/UnitPlaceholder.tsx` v1.0 : cylindre colore par equipe + torus bordure haut + Billboard avec lettre I/C/A et count, toujours face camera (drei `<Billboard>` + `<Text>`).
- `src/render/camera/CameraController.tsx` v1.0 : `<PerspectiveCamera makeDefault />` + `<OrbitControls />`, contraintes lues depuis `SCALE_CONFIG[scale].camera` (min/maxDistance, min/maxPolarAngle).
- `src/render/scenes/SceneLoader.tsx` v1.0 : fallback Suspense via drei `<Html>`.
- `src/render/scenes/SceneShell.tsx` v1.0 : wrapper Canvas R3F + Suspense + tone mapping ACESFilmic + bg transparent.
- `src/render/scenes/TacticalScene.tsx` v1.0 : compose camera + lighting + grid + units.
- `src/render/index.ts` v1.0 : barrel.
- `src/ui/pages/RenderTest.tsx` v1.0 : page demo plein ecran sur `/render-test`. Affiche 91 hex (spiral rayon 5) + 6 unites factices. Aide controles en overlay.
- `src/App.tsx` v1.0d : route `/render-test` ajoutee.

**Decisions** :
- Convention Y-up Three.js : `position={[world.x, elevation, world.y]}` dans HexTile/UnitPlaceholder. Convention encapsulee dans render/, jamais dans engine/.
- Geometrie hex partagee (`HEX_GEOMETRY` const hors composant) → 1 seule allocation pour les 91 tiles.
- Materials non partages (chaque tile cree son material) : Lot 6A simple, optimisation Phase 5+ si besoin.
- Bordure tile legerement levee de Y (+0.005) au-dessus de la face superieure pour eviter Z-fighting.
- `screenSpacePanning={false}` sur OrbitControls : le pan reste dans le plan XZ, pas perpendiculaire a la camera (sinon en vue plongee on peut faire monter la camera dans le ciel).

**A faire cote utilisateur** :
1. **`npm run tsc`** doit passer 0 erreur.
2. **`npm run test`** : 63 tests verts (57 hex + 6 mvp unit placement).
3. **`npm run dev`** + naviguer vers `http://localhost:5173/render-test` :
   - Tu vois 91 hex en disque + 6 unites cylindriques (3 bleues a gauche, 3 rouges a droite).
   - Chaque unite a une lettre (I/C/A) + un nombre (100/60/30) flottant au-dessus, toujours face camera.
   - Hover sur un hex : bordure ambre + couleur plus claire.
   - Clic sur un hex : log dans la console `[RenderTest] tile clicked: { q: ..., r: ..., s: ... }`.
   - Drag souris : rotation orbitale autour du centre.
   - Drag droit : pan dans le plan.
   - Molette : zoom (contraint min 3, max 25).
   - Tu ne peux pas basculer la camera sous l'horizon ni dessus.

**Sous-lot 6A vert si** :
- [ ] Page `/render-test` rend la scene sans crash.
- [ ] 91 hex + 6 unites visibles.
- [ ] Hover, clic, rotation, zoom, pan fonctionnent.
- [ ] Caméra contrainte (pas sous le sol, pas trop loin).

**Prochain sous-lot 6B** : refonte layout `Game.tsx` en 3 zones (header + scene 3D centrale + sidebar equipes droite). Suppression route `/render-test`. Cochage 0.8 + 0.9 + 0.10.

---

## Session 8 &mdash; 08/05/2026 &mdash; Phase 0 Lot 5 : hex foundation + SCALE_CONFIG

- engine/hex/* (types, coordinates, distance, neighbors, line, key, index, 5 tests Vitest = 57 tests verts).
- engine/scales/* (types, config, index).
- vite.config.ts v1.0b ajout config Vitest.
- Sous-taches 0.6 + 0.7 ✅.

---

## Session 7 &mdash; 08/05/2026 &mdash; Lot 4C : page Game + RLS fix recursion

- Migrations 004 + 005 (SECURITY DEFINER pour casser recursion games <-> game_players).
- useGame.ts, PlayerSlot.tsx, Game.tsx route `/game/:id`.
- Hotfix sous-titre header 12px → 18px.

---

## Session 6 &mdash; 08/05/2026 &mdash; Lot 4B : hooks + Lobby React

- sonner installe.
- Cormorant Garamond.
- useRealtime, useGames, PageBackground, GameCard, CreateGameDialog, Lobby.
- App.tsx routes /lobby + Toaster.

---

## Session 5 &mdash; 08/05/2026 &mdash; Lot 4A : migration BDD + types + maquettes

- Migration 003 (idempotente).
- types/game.ts.
- 2 maquettes HTML.

---

## Session 4 &mdash; 08/05/2026 &mdash; Lot 2 carrousel images reelles

- 3 images public/scenes/.
- AuthBackground.tsx v1.0b.

---

## Session 3 &mdash; 08/05/2026 &mdash; Lot 2 addendum carrousel

- Refonte AuthBackground.tsx : carrousel 4 slides + Ken Burns.

---

## Session 2 &mdash; 08/05/2026 &mdash; Lot 2

- Migrations 001 + 002.
- Composants atomes + Auth.tsx + hooks auth.

---

## Session 1 &mdash; 08/05/2026 &mdash; Lot 1

- Init Vite + React 18 + TS strict.
- Tailwind, Radix, alias.
- Validation Zod env vars + Supabase client.
