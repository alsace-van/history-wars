# WIP.md

Journal des sessions de developpement, plus recente en haut. Maximum 10 entrees.

---

## Session 8 &mdash; 08/05/2026 &mdash; Phase 0 Lot 5 : hex foundation + SCALE_CONFIG

**Fait** :
- `src/engine/hex/types.ts` : `Cube` et `Axial`, readonly.
- `src/engine/hex/coordinates.ts` : `cube`, `axialToCube`, `cubeToAxial`, `cubesEqual`, `cubeToWorld`, `worldToCube`, `cubeRound`. Orientation flat-top, formules Red Blob Games.
- `src/engine/hex/distance.ts` : `cubeDistance`.
- `src/engine/hex/neighbors.ts` : `HEX_DIRECTIONS` (E/NE/NW/W/SW/SE), `neighbor`, `neighbors`, `ring`, `spiral`. Modulo positif strict sur les directions.
- `src/engine/hex/line.ts` : `cubeLerp`, `cubeLineDraw` avec epsilon-shift anti-tie. Pre-cable Phase 3 (ligne de vue).
- `src/engine/hex/key.ts` : `cubeKey` ("q,r"), `parseCubeKey`.
- `src/engine/hex/index.ts` : barrel export complet.
- `src/engine/scales/types.ts` : `CameraConstraints`, `ScaleProfile`, `ScaleConfigMap`. Importe `Scale` depuis `@/types/game` (source unique).
- `src/engine/scales/config.ts` : `SCALE_CONFIG` avec 3 profils (tactical/operational/strategic). `hexSize` constant a 1.0 a toutes les echelles, c'est `metersPerHex` qui change.
- `src/engine/scales/index.ts` : barrel export.
- 5 fichiers de tests Vitest : `coordinates.test.ts` (19 tests), `distance.test.ts` (5), `neighbors.test.ts` (15), `line.test.ts` (8), `key.test.ts` (5). **57 tests verts**.
- `vite.config.ts` v1.0b : ajout config Vitest (environment node, include src/**/*.test.ts).

**Decisions** :
- Flat-top valide.
- Ordre voisins fige : 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE.
- `SCALE_CONFIG` en TS const Phase 0 (BDD plus tard Phase 13 moddabilite).
- `line.ts` integre des Lot 5 (pre-cable Phase 3).
- Helper interne `nz(x)` partout pour normaliser `-0` en `+0` (sinon `q+r=0` produit `s=-0` et casse `toBe`/`toEqual` strict).
- Aucun import depuis React/render/ui dans engine/. Engine totalement pur.

**A faire cote utilisateur** :
1. **`npm run tsc`** doit passer 0 erreur.
2. **`npm run test`** doit passer 57/57 verts.
3. **`npm run dev`** : aucun changement visuel (engine pur, pas de React).
4. Le contenu sera consomme au Lot 6 par `HexGrid.tsx` et `CameraController.tsx`.

**Sous-taches Phase 0 validees** :
- 0.6 (coordonnees hex cubiques) : ✅
- 0.7 (SCALE_CONFIG) : ✅

**Prochain Lot** :
- Lot 6 : R3F render (sous-taches 0.8 + 0.9 + 0.10) — premiere vue 3D. Audit + plan livres au prochain message.

---

## Session 7 &mdash; 08/05/2026 &mdash; Phase 0 Lot 4 sous-lot 4C : page Game + fix RLS recursion

**Fait** :
- Migrations 004 + 005 : fix RLS recursion `games` <-> `game_players` via fonctions SECURITY DEFINER. Drop des policies legacy 001 en francais.
- `src/hooks/useGame.ts` v1.0 : single game CRUD.
- `src/ui/game/PlayerSlot.tsx` v1.0 : variants rempli + vide.
- `src/ui/pages/Game.tsx` v1.0 : route `/game/:id`, 2 panneaux equipes, kick par hote, dissolution, leave, redirect securisee.
- `src/App.tsx` v1.0c : route `/game/:id` ajoutee.
- `docs/CLAUDE.md` : pieges 8 (RLS recursive) et 9 (policies legacy).
- Hotfix : sous-titre "Salle de commandement" / "Brief" agrandi de 12 a 18px.

---

## Session 6 &mdash; 08/05/2026 &mdash; Phase 0 Lot 4 sous-lot 4B : hooks + page Lobby React

- `package.json` v0.0.3 : `sonner@^1.7.1`.
- `index.html` : Cormorant Garamond.
- `useRealtime.ts` v1.0 : postgres_changes + presence.
- `useGames.ts` v1.0 : CRUD parties.
- `PageBackground.tsx` v1.0, `GameCard.tsx` v1.0, `CreateGameDialog.tsx` v1.0, `Lobby.tsx` v1.0.
- `App.tsx` v1.0b : routes `/lobby` + Toaster.

---

## Session 5 &mdash; 08/05/2026 &mdash; Phase 0 Lot 4 sous-lot 4A : migration BDD + types + maquettes

- Migration `003_lobby_columns.sql`.
- `src/types/game.ts`.
- 2 maquettes HTML statiques.

---

## Session 4 &mdash; 08/05/2026 &mdash; Lot 2 carrousel images reelles

- 3 images `public/scenes/` : bouvines, austerlitz, verdun.
- `AuthBackground.tsx` v1.0b : bascule SVG -> img.

---

## Session 3 &mdash; 08/05/2026 &mdash; Lot 2 addendum carrousel

- Refonte `AuthBackground.tsx` en carrousel automatique 4 slides + Ken Burns.

---

## Session 2 &mdash; 08/05/2026 &mdash; Phase 0 Lot 2

- Migration BDD `001_foundations`.
- Migration `002_secure_handle_new_user`.
- Composants atomes : `Label`, `Input`, `Button`, `PasswordInput`, `Typewriter`.
- `Auth.tsx` splitscreen 4 modes.
- Hooks `useAuth`, `useRequireAuth`.

---

## Session 1 &mdash; 08/05/2026 &mdash; Phase 0 Lot 1

- Init Vite + React 18 + TS strict.
- Tailwind, Radix, alias.
- Validation Zod env vars.
- Client Supabase singleton.
