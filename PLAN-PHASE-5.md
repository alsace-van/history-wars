# PLAN-PHASE-5 — Relief, Terrain Riche, Multi-Hex

> Production : 21/05/2026, après session 26 (Phase 4-bis Lot 2 clôturée).
> Prérequis lecture : `AUDIT-PHASE-5.md`, `docs/dependency-map.md` § 12, `docs/CLAUDE.md`.

---

## 0. Vagues d'exécution

| Vague | Lots | Parallèle ? | Bloque-t-il la suivante ? |
|---|---|---|---|
| **V1 — Fondations** | 5.0 | Non | Oui (refactor BDD + perf) |
| **V2 — Contenu** | 5.1 | Indép. de 5.2/5.3 | Non |
| **V2 — Engine + Render** | 5.2, 5.3 | Parallèles entre eux | Oui pour 5.4-5.5 |
| **V3 — UX** | 5.4, 5.5 | Parallèles entre eux | Oui pour 5.6 (déploiement nécessaire) |
| **V4 — Refonte unité** | 5.6 | Séquentiel | Fin de phase |

Une session = un lot complet livré + tests verts + EFs déployées si applicable.

---

## 1. Lot 5.0 — Fondations BDD + perf

**Objectif** : préparer le socle technique sans changer le gameplay observable. Tester perf 5 000+ hex avant d'engager les lots de contenu.

### TASK 5.0.1 — Migration 035 : scenarios étendus

**Fichiers IN** : `supabase/migrations/013_terrain_tiles.sql`, `supabase/migrations/029_hex_templates.sql`, `supabase/migrations/030_terrain_tiles_template_id.sql`

**Fichiers OUT** : `supabase/migrations/035_scenarios_phase5_dimensions.sql`

Contenu :
- `ALTER TABLE scenarios ADD COLUMN meters_per_hex int NOT NULL DEFAULT 50;`
- `ALTER TABLE scenarios ADD COLUMN board_radius int NOT NULL DEFAULT 40;`
- `ALTER TABLE scenarios ADD COLUMN bbox jsonb;` (lat/lon bounds pour traçabilité géo)
- `ALTER TABLE scenarios ADD COLUMN source_label text;` (« Azincourt 1415 », « Plaine générique »)
- Backfill scenarios existants à `meters_per_hex=50, board_radius=7` pour compat MVP.

**Validation** :
- `supabase mcp get_advisors` clean (RLS, search_path)
- `tsc` 0 erreur
- Migration appliquée prod via `apply_migration`

### TASK 5.0.2 — Migration 036 : terrain_tiles enrichi

**Fichiers IN** : `supabase/migrations/030_terrain_tiles_template_id.sql`

**Fichiers OUT** : `supabase/migrations/036_terrain_tiles_phase5_effects.sql`

Contenu :
- `ALTER TABLE hex_templates ADD COLUMN elevation_m smallint NOT NULL DEFAULT 0;`
- `ALTER TABLE hex_templates ADD COLUMN los_block_pct smallint NOT NULL DEFAULT 0;`
- `ALTER TABLE hex_templates ADD COLUMN defense_modifier numeric(3,2) NOT NULL DEFAULT 0;`
- `ALTER TABLE hex_templates ADD COLUMN movement_cost numeric(3,1) NOT NULL DEFAULT 1.0;`
- `ALTER TABLE hex_templates ADD COLUMN biome text NOT NULL DEFAULT 'plain';` (CHECK IN plain, forest, hill, marsh, water, urban, road)
- Templates seeds par défaut : `plain, forest_light (LoS 30%), forest_dense (LoS 60%), hill, marsh, water_impassable, urban (LoS 100%), road`.
- `ALTER TABLE terrain_tiles ADD COLUMN overrides jsonb;` (rare, pour cas exceptionnels)

**Validation** :
- `get_advisors` clean
- Seed des 8 templates en INSERT idempotent (ON CONFLICT DO NOTHING)

### TASK 5.0.3 — Migration 037 : terrain_edges + terrain_buildings

**Fichiers IN** : aucune dépendance code

**Fichiers OUT** : `supabase/migrations/037_terrain_edges_and_buildings.sql`

Contenu :
- Table `terrain_edges(game_id uuid, q1 int, r1 int, q2 int, r2 int, edge_kind text)` avec contrainte ordre canonique (q1, r1) < (q2, r2) via CHECK, PK composite.
  - `edge_kind` CHECK IN ('wall', 'hedge', 'bridge', 'ford', 'river_block').
- Table `terrain_buildings(id uuid pk, game_id, q, r, kind, capacity_max, garrison_unit_id, captured_by_team text)`.
  - `kind` CHECK IN ('farm', 'hamlet', 'church', 'castle', 'windmill', 'bridge_tower', 'ruin').
- RLS : SELECT autorisé aux membres du game (cohérent avec terrain_tiles).
- INSERT/UPDATE/DELETE host-only (paint mode admin).
- REPLICA IDENTITY FULL sur `terrain_buildings` (changements en cours de partie : capture).

**Validation** :
- `get_advisors` clean
- Realtime test : modification de `terrain_buildings.captured_by_team` propage côté client.

### TASK 5.0.4 — Refactor boardRadius variable

**Fichiers IN** :
- `src/ui/pages/Game.tsx` (ligne 68 + 210)
- `src/ui/editor/MapsList.tsx`
- `supabase/functions/run_bot_turn/index.ts` (boardRadius hardcode 5 reporté en session 22)
- `supabase/functions/_shared/engine-port/*` (vérifier hardcodes)

**Fichiers OUT** :
- `src/ui/pages/Game.tsx` (lit `scenarios.board_radius` via `useGame`)
- `src/ui/editor/MapsList.tsx` (lit `scenarios.board_radius`)
- `supabase/functions/run_bot_turn/index.ts` (lit `scenario.board_radius`)
- Hook : éventuellement `useScenarioDimensions(scenarioId): { boardRadius, metersPerHex }`

**Validation** :
- `grep -r "DEFAULT_TACTICAL_RADIUS\|boardRadius = 7\|radius: 7" src/ supabase/` → 0 résultat
- Test manuel : créer scenario avec `board_radius=15`, vérifier grille rendue à rayon 15

### TASK 5.0.5 — HexGrid en InstancedMesh

**Fichiers IN** :
- `src/render/hex/HexGrid.tsx`
- `src/render/hex/HexTile.tsx`
- `src/render/hex/types.ts`

**Fichiers OUT** :
- `src/render/hex/HexGridInstanced.tsx` (NEW)
- `src/render/hex/HexTileOverlay.tsx` (NEW, overlay state via instanceColor)
- `src/render/hex/HexGrid.tsx` (deprecated, conserver fallback)
- `src/render/hex/__tests__/HexGridInstanced.perf.test.tsx` (test perf 5000 hex)

Contenu :
- 1 `InstancedMesh` pour le sol hex (géométrie partagée, transform par instance)
- 1 `InstancedMesh` pour overlay state (alpha + couleur via instanceColor)
- 1 `LineSegments` agrégé pour bordures (BufferGeometry concaténée)
- Hit test : `useRaycaster` sur l'`InstancedMesh` sol, `event.instanceId` → cube via index inverse
- Élévation : `instanceMatrix` Y selon `getElevation(cube)`

**Validation** :
- 5 000 hex affichés, 60 fps en idle, ≥ 30 fps avec 20 unités en mouvement
- Click sur tile match correctement le cube cliqué (test e2e)
- Visuellement identique à HexGrid actuel à rayon 7

### TASK 5.0.6 — Refactor Game.tsx ≤ 500 lignes

**Fichiers IN** : `src/ui/pages/Game.tsx` (863 lignes)

**Fichiers OUT** :
- `src/ui/pages/Game.tsx` (≤ 500 lignes)
- `src/hooks/useTacticalRenderState.ts` (NEW, calculs tileStates/unitStates extraits)
- `src/ui/pages/BattleLayout.tsx` (NEW, assemblage Sidebar/HUD/Scene)

**Validation** :
- `wc -l src/ui/pages/Game.tsx` ≤ 500
- Tous tests existants verts (381 + nouveaux)
- Aucun hook réordonné

### Critères fin Lot 5.0
- [ ] Migrations 035-037 appliquées prod
- [ ] `get_advisors` clean
- [ ] InstancedMesh perf validée 5 000+ hex
- [ ] Game.tsx ≤ 500 lignes
- [ ] Tous tests verts (cible 410+)
- [ ] `npm run build` PWA OK
- [ ] Aucun gameplay observable changé (régression visuelle 0)

---

## 2. Lot 5.1 — Importeur DEM + OSM

**Objectif** : pipeline standalone qui transforme un GeoJSON OSM + une heightmap PNG en INSERT BDD pour un scenario complet.

### TASK 5.1.1 — Recherche sources et bbox

**Fichiers IN** : aucune

**Fichiers OUT** : `docs/PHASE-5-SOURCES-CARTOGRAPHIQUES.md`

Contenu : table de bbox + sources DEM/OSM pour 5 batailles candidates :
- Azincourt 1415 (50.46N 2.14E, 5×5 km)
- Bouvines 1214 (50.59N 3.18E, 5×5 km)
- Marignan 1515 (45.42N 9.20E, 6×6 km)
- Austerlitz 1805 (49.13N 16.76E, 10×10 km)
- Verdun-Douaumont 1916 (49.21N 5.43E, 8×8 km)
- 1 plaine fictive générique (8×8 km, France métropolitaine plate)

Pour chaque : URL Tangram Heightmapper (paramétrée), URL Overpass Turbo (query préfaite).

### TASK 5.1.2 — Script standalone build-scenario

**Fichiers IN** :
- `src/engine/hex/coords.ts` (axialToCube, cubeDistance — à dupliquer car script standalone)
- `src/engine/scales/config.ts` (lecture metersPerHex)

**Fichiers OUT** :
- `scripts/build-scenario.ts` (NEW, ~300 lignes)
- `scripts/lib/heightmap-sampler.ts` (NEW, sample bilinéaire PNG)
- `scripts/lib/osm-mapper.ts` (NEW, parse GeoJSON → hex)
- `scripts/lib/hex-utils.ts` (NEW, dup minimal cubeDistance/axialToCube)
- `package.json` (ajout script `build:scenario`)

Contenu :
- Input : `--heightmap path.png --osm path.geojson --meters-per-hex 50 --board-radius 60 --output scenario-{slug}.sql`
- Process :
  1. Charger heightmap PNG 16-bit (lib `sharp` ou `pngjs`)
  2. Charger OSM GeoJSON
  3. Pour chaque cube hex (BFS spiral `boardRadius`) :
     - Centre cubique → lat/lon via bbox
     - Sample heightmap → elevation_m
     - Query OSM polygons contenant le centre → biome dominant
     - Détecter linéaires (Bresenham hex le long de chaque LineString OSM) → terrain_edges
     - Détecter bâtiments (polygones < 1 hex → 1 building au centroïde)
  4. Émettre fichier SQL : INSERT scenarios, INSERT hex_templates (réf existante), INSERT terrain_tiles, INSERT terrain_edges, INSERT terrain_buildings.

**Validation** :
- `npx tsx scripts/build-scenario.ts --heightmap data/azincourt.png --osm data/azincourt.geojson --output out/azincourt.sql`
- Fichier SQL valide, applicable via `psql` ou Supabase Studio
- Audit auto post-import : `% hex praticables ≥ 60%`, `nb chemins distincts entre 2 zones de déploiement ≥ 3`

### TASK 5.1.3 — Premier scenario réel ingéré

**Fichiers IN** : sortie TASK 5.1.2 sur 1 site (proposition : plaine générique 8×8 km en France centre, plat avec routes + forêts + hameaux)

**Fichiers OUT** :
- `supabase/migrations/038_scenario_generic_8x8.sql` (INSERT scenario complet)

**Validation** :
- Scenario visible dans le lobby
- Click "Créer game" → chargement OK
- Visuel cohérent (vu de dessus : routes lisibles, forêts vertes, plaines beige)

### Critères fin Lot 5.1
- [ ] Script `build-scenario.ts` fonctionnel sur 1 input réel
- [ ] Migration 038 = 1 scenario complet en BDD
- [ ] Audit auto post-import documenté
- [ ] Doc sources cartographiques figée

---

## 3. Lot 5.2 — Engine terrain

**Objectif** : tous les effets gameplay du terrain (mvmt, LoS, combat) lisent les nouvelles colonnes BDD.

### TASK 5.2.1 — `engine/terrain/` refondu

**Fichiers IN** :
- `src/engine/terrain/types.ts`
- `src/engine/terrain/caps.ts`

**Fichiers OUT** :
- `src/engine/terrain/types.ts` (étendu)
- `src/engine/terrain/templates.ts` (NEW, dictionnaire biome → effets)
- `src/engine/terrain/lookup.ts` (NEW, helper `getTerrainAt(state, cube): TerrainTile`)
- `src/engine/terrain/__tests__/lookup.test.ts`

Contenu types :
```ts
export interface TerrainTile {
  readonly q: number;
  readonly r: number;
  readonly elevation_m: number;
  readonly biome: 'plain' | 'forest' | 'hill' | 'marsh' | 'water' | 'urban' | 'road';
  readonly losBlockPct: number;
  readonly defenseModifier: number;
  readonly movementCost: number;
  readonly buildingKind?: 'farm' | 'hamlet' | 'church' | 'castle' | 'windmill' | 'ruin';
}
```

**Validation** : ≥ 8 tests Vitest sur `getTerrainAt`, gestion default biome=plain hors carte.

### TASK 5.2.2 — BFS/A* coût terrain

**Fichiers IN** :
- `src/engine/movement/path.ts`
- `src/engine/movement/range.ts`
- `src/engine/terrain/lookup.ts`

**Fichiers OUT** :
- `src/engine/movement/path.ts` (utilise `costPerHex` injecté depuis terrain)
- `src/engine/movement/range.ts` (idem)
- `src/engine/movement/terrain-cost.ts` (NEW, factory `makeTerrainCostFn(terrainMap, unitKind): (cube) => number`)
- `src/engine/movement/__tests__/terrain-cost.test.ts`

Contenu :
- Coût base = `terrain.movementCost`
- Modifier par kind : cavalerie en forêt = ×3 au lieu de ×2 (lit `cavMovementPenalty` existant + `movementCost` template)
- Coût infini si biome=water et pas d'edge `bridge`/`ford` adjacent

**Validation** :
- Tests : marais ralentit infanterie, bloque cavalerie ; route accélère ; rivière bloque sauf pont.

### TASK 5.2.3 — LoS avec opacité partielle

**Fichiers IN** :
- `src/engine/los/has-line-of-sight.ts` (existant client)
- `src/engine/hex/line.ts`
- `supabase/migrations/024_fog_rls_server_side.sql`

**Fichiers OUT** :
- `src/engine/los/has-line-of-sight.ts` (refactor : cumul losBlockPct)
- `supabase/migrations/039_los_opacity_partial.sql` (UPDATE `has_line_of_sight` PL/pgSQL avec param `los_pct_map jsonb`)
- `src/engine/los/__tests__/opacity.test.ts`

Contenu :
- Signature client : `hasLineOfSight(a, b, terrainMap, unitsBlockers): boolean`
- Cumul des `losBlockPct` sur le path hexagonal (sauf a et b inclus dans le calcul ? à figer en test)
- Bloqué si somme ≥ 100
- Bâtiment = forcément 100% (vue interrompue brutalement)
- Unités blockers : 50% par unité (peut être ajusté en balance)

**Validation** :
- Tests : forêt légère sur 1 hex = visible, forêt légère sur 4 hex = bloqué (30×4=120)
- Mirror EF ↔ client identiques (pitfall #30)

### TASK 5.2.4 — Combat defense modifier terrain

**Fichiers IN** :
- `src/engine/combat/v2/contact.ts` (lignes 18, 140)
- `src/engine/terrain/lookup.ts`

**Fichiers OUT** :
- `src/engine/combat/v2/contact.ts` (lit `terrain.defenseModifier`)
- `src/engine/combat/v2/__tests__/terrain-defense.test.ts`

Contenu : `terrainDefBonus` actuel devient `terrain.defenseModifier` lu depuis terrainMap. Conserver l'amplification ×2 si défenseur hold (Phase 3.3).

**Validation** : tests : combat sur forêt = +25% défenseur, sur bâtiment = +50%, sur hill (vs assailant en plaine basse) = +15%.

### TASK 5.2.5 — Edges (bridges, walls, rivers) dans BFS et LoS

**Fichiers IN** :
- `src/engine/movement/path.ts`
- `src/engine/los/has-line-of-sight.ts`

**Fichiers OUT** :
- `src/engine/terrain/edges.ts` (NEW, helper `hasEdge(state, a, b, kind): boolean`, `isPassable(state, a, b, unitKind): boolean`)
- `src/engine/movement/path.ts` (consulte `isPassable` à chaque step)
- `src/engine/los/has-line-of-sight.ts` (mur entre 2 hex bloque LoS)
- `src/engine/terrain/__tests__/edges.test.ts`

**Validation** : tests : pont permet traverser rivière, mur bloque mvmt direct, rivière_block infranchissable sans gué.

### TASK 5.2.6 — `applyAction` (sim IA) lit terrain

**Fichiers IN** : `src/engine/sim/applyAction.ts`

**Fichiers OUT** : `src/engine/sim/applyAction.ts` (intègre terrain dans coût mvmt + bonus combat)

**Validation** : tests sim IA toujours verts, IA ne fait pas plus de bêtises (winrate test dormant à relancer).

### Critères fin Lot 5.2
- [ ] `engine/terrain/` étendu, 8 biomes typés
- [ ] BFS/A*/LoS/combat lisent terrainMap
- [ ] Edges respectées (ponts, murs, rivières)
- [ ] EF `has_line_of_sight` v2 mirror client
- [ ] ≥ 50 nouveaux tests Vitest, total ≥ 430

---

## 4. Lot 5.3 — Render terrain

**Objectif** : visuels par biome, élévation 3D, bâtiments.

### TASK 5.3.1 — HexTile couleur/texture par biome

**Fichiers IN** :
- `src/render/hex/HexGridInstanced.tsx` (issu Lot 5.0)
- `src/render/hex/HexTile.tsx`

**Fichiers OUT** :
- `src/render/hex/biome-materials.ts` (NEW, palette couleurs + texture refs par biome)
- `src/render/hex/HexGridInstanced.tsx` (utilise `instanceColor` selon biome)

Contenu : 8 couleurs/textures de base, légères variations procédurales pour casser la régularité (noise sur hue ±5%).

**Validation** : visuellement, plaine/forêt/marais/route distinguables au premier coup d'œil.

### TASK 5.3.2 — Élévation 3D translate Z

**Fichiers IN** :
- `src/render/hex/HexGridInstanced.tsx`
- `src/engine/terrain/lookup.ts`

**Fichiers OUT** :
- `src/render/hex/HexGridInstanced.tsx` (translate Y par instance selon `terrain.elevation_m / metersPerHex`)
- `src/render/hex/__tests__/elevation.test.tsx` (smoke test)

**Validation** : carte avec relief (5 m → 50 m d'élévation max) montre bosses visibles, caméra orbitale ne traverse pas les collines.

### TASK 5.3.3 — Bâtiments InstancedMesh

**Fichiers IN** : néant (nouveau composant)

**Fichiers OUT** :
- `src/render/buildings/BuildingsLayer.tsx` (NEW)
- `src/render/buildings/building-models.ts` (NEW, low-poly GLB ou primitives ProcGen)
- `src/render/buildings/__tests__/BuildingsLayer.test.tsx`

Contenu :
- Lecture `terrain_buildings` via hook `useTerrainBuildings(gameId)`
- 1 InstancedMesh par `kind` (farm, hamlet, church, castle, windmill, bridge_tower)
- Pour MVP : primitives Three.js (box + roof) colorées (gris pierre, brun bois, rouge tuile). Remplacement GLB Phase 7.

**Validation** : 50 bâtiments rendus sur la carte, FPS stable.

### TASK 5.3.4 — Routes et linéaires

**Fichiers IN** : néant

**Fichiers OUT** :
- `src/render/terrain/RoadsLayer.tsx` (NEW, LineSegments le long des hex `road`)
- `src/render/terrain/RiversLayer.tsx` (NEW, bandes bleues le long des hex `water`)
- `src/render/terrain/EdgesLayer.tsx` (NEW, murs entre hex)

Contenu : géométries dérivées des positions hex, matériaux simples.

**Validation** : routes lisibles, rivières en serpentin réaliste.

### Critères fin Lot 5.3
- [ ] Biomes visuellement distincts
- [ ] Élévation Z effective
- [ ] Bâtiments + routes + rivières visibles
- [ ] 5 000 hex à 60 fps en idle
- [ ] Caméra orbitale OK sur relief

---

## 5. Lot 5.4 — Mode déploiement

**Objectif** : nouvelle phase entre `lobby` et `in_progress` où chaque joueur place ses unités.

### TASK 5.4.1 — Status `deploying` BDD

**Fichiers IN** :
- `supabase/migrations/007_phase1_units_and_actions.sql` (games.status enum)
- `supabase/functions/start_battle/index.ts`

**Fichiers OUT** :
- `supabase/migrations/040_games_status_deploying.sql` (ALTER ENUM ADD VALUE `deploying`)
- `supabase/migrations/041_scenario_deploy_zones.sql` (table `scenario_deploy_zones(scenario_id, team, hex_list jsonb)`)
- `supabase/functions/start_battle/index.ts` (v6 : pivot vers `deploying` au lieu de `in_progress`)
- `supabase/functions/start_combat/index.ts` (NEW EF : passe de `deploying` à `in_progress`)

**Validation** :
- Bouton "Engager bataille" → status=`deploying`
- Une fois tous unités placées + bouton "Prêt" de tous joueurs → `in_progress`

### TASK 5.4.2 — UI placement drag&drop

**Fichiers IN** :
- `src/ui/pages/Game.tsx`
- `src/render/units/UnitPlaceholder.tsx`

**Fichiers OUT** :
- `src/ui/deployment/DeploymentPanel.tsx` (NEW, palette d'unités à placer)
- `src/ui/deployment/DeploymentZoneHighlight.tsx` (NEW, surligne hex éligibles)
- `src/hooks/useDeploymentState.ts` (NEW, gestion drag&drop)
- `src/ui/pages/Game.tsx` (branche conditionnelle status=deploying)

Contenu :
- Side panel droite : liste des unités à placer (drag depuis liste)
- Hex valides surlignés (zone de déploiement de l'équipe)
- Drop sur hex valide → INSERT units row
- Bouton "Prêt" → flag `game_players.deploy_ready`

**Validation** :
- 2 navigateurs, chacun place ses unités, bouton Prêt, combat démarre.
- Impossible de placer hors zone, impossible de placer 2 unités même hex.

### TASK 5.4.3 — Validation pré-déploiement

**Fichiers IN** : `src/ui/lobby/`

**Fichiers OUT** : `src/ui/deployment/__tests__/deployment.test.ts`

Tests :
- Placer hors zone → erreur
- Démarrer combat sans avoir placé toutes ses unités → erreur
- Quitter pendant deploying → rollback to lobby (host) / spectator (membre)

### Critères fin Lot 5.4
- [ ] Status `deploying` actif
- [ ] Drag&drop fluide
- [ ] Zones de déploiement définies dans scenario
- [ ] Bouton Prêt sync 2 joueurs

---

## 6. Lot 5.5 — Bâtiments interactifs

**Objectif** : capture, garnison, bonus défensif effectif.

### TASK 5.5.1 — Action `enter_building` / `leave_building`

**Fichiers IN** :
- `src/engine/orders/types.ts`
- `supabase/functions/resolve_action/index.ts`

**Fichiers OUT** :
- `src/engine/orders/types.ts` (ajout 2 kinds)
- `supabase/functions/resolve_action/index.ts` (v23, dispatch nouvelles actions)
- `supabase/functions/_shared/engine-port/orders/enter-building.ts` (NEW)
- Tests unitaires engine + EF

Contenu :
- Entrer : unité doit être adjacente, bâtiment libre ou amical (capacity_max non atteint), action coûte 1 PA
- Sortir : déplacement vers hex adjacent libre, action coûte 1 PA
- Si bâtiment ennemi occupé : enter = combat de prise (résolution spéciale)

**Validation** : tests + e2e manuel : prise de ferme par infanterie.

### TASK 5.5.2 — Combat assaut de bâtiment

**Fichiers IN** : `src/engine/combat/v2/contact.ts`

**Fichiers OUT** :
- `src/engine/combat/v2/building-assault.ts` (NEW)
- Tests dédiés

Contenu : si défenseur dans bâtiment :
- +50% defense_modifier (cumulé avec terrain)
- Attaquant subit +20% pertes
- Garnison ne peut pas riposter à plus de 50% effectif
- Cavalerie ne peut pas assaillir un bâtiment (doit démonter, mécanique future)

### TASK 5.5.3 — UI bâtiment

**Fichiers IN** : `src/ui/units/UnitInspector.tsx`

**Fichiers OUT** :
- `src/ui/buildings/BuildingInspector.tsx` (NEW)
- `src/render/buildings/BuildingsLayer.tsx` (étendre : bannière team par-dessus si occupé)

**Validation** :
- Click bâtiment → inspector avec capacity_max, garnison actuelle, équipe de contrôle
- Bannière colorée bleue/rouge visible de loin

### Critères fin Lot 5.5
- [ ] Bâtiments capturables
- [ ] Combat assaut équilibré
- [ ] Inspector UI lisible
- [ ] Tests ≥ 20 nouveaux

---

## 7. Lot 5.6 — Multi-hex foundation

**Objectif** : 1 unité = N hex contigus. Sans formation typée (Phase 6).

### TASK 5.6.1 — Migration 042 : unit_positions

**Fichiers IN** : `supabase/migrations/007_phase1_units_and_actions.sql`

**Fichiers OUT** : `supabase/migrations/042_unit_multi_hex.sql`

Contenu :
- Nouvelle table `unit_positions(unit_id uuid REFERENCES units(id) ON DELETE CASCADE, q int, r int, effective_share int, PRIMARY KEY (unit_id, q, r))`
- Backfill : pour chaque unit existante, INSERT 1 row dans unit_positions avec `effective_share = effective`
- Index `(game_id, q, r)` via vue ou trigger pour query rapide
- RLS : SELECT cohérent avec units (membres + spectateurs en respect fog)
- `units.position_q`, `units.position_r` désormais redondants (à supprimer Phase 5+ après stabilisation)

**Validation** : `get_advisors` clean, lookup `SELECT * FROM unit_positions WHERE game_id=X AND q=2 AND r=3` rapide.

### TASK 5.6.2 — UnitState refonte

**Fichiers IN** :
- `src/engine/units/types.ts`
- `src/lib/unitAdapter.ts`

**Fichiers OUT** :
- `src/engine/units/types.ts` (NEW field `positions: ReadonlyArray<{ cube: Cube; effectiveShare: number }>`)
- `src/engine/units/positions.ts` (NEW helpers `mainPosition(unit)`, `allCubes(unit)`, `unitShape(unit): 'point' | 'line' | 'cluster'`)
- `src/lib/unitAdapter.ts` (refactor adapter pour mapper unit_positions → positions[])
- Tests Vitest

**Validation** : tests adapter, tests positions helpers.

### TASK 5.6.3 — ZdC sommée

**Fichiers IN** : `src/engine/zoc/zoc.ts`

**Fichiers OUT** :
- `src/engine/zoc/zoc.ts` (refactor : ZdC = union des voisins de **chaque** hex de l'unité)
- Tests dédiés

**Validation** : tests : unité 3-hex en ligne projette ZdC sur ~7 hex au lieu de 6.

### TASK 5.6.4 — Mouvement bloc rigide

**Fichiers IN** :
- `src/engine/movement/path.ts`
- `src/engine/movement/range.ts`

**Fichiers OUT** :
- `src/engine/movement/multi-hex-move.ts` (NEW, `canMoveTo(unit, delta): boolean`, vérifie chaque hex de la forme après translation)
- `src/engine/movement/path.ts` (utilise pour multi-hex)
- Tests dédiés

Contenu :
- Translation = delta cubique appliqué à tous les hex
- Chaque hex destination doit être : dans le board, libre (sauf autres hex de la même unité), terrain franchissable
- Coût mvmt = coût max parmi tous les hex destination (le pire freine)

**Validation** : unité 3-hex se déplace en bloc, bloquée si 1 seul hex est bloqué.

### TASK 5.6.5 — Combat multi-hex

**Fichiers IN** : `src/engine/combat/v2/*`

**Fichiers OUT** :
- `src/engine/combat/v2/multi-hex.ts` (NEW, logique d'engagement par hex)
- Refactor `contact.ts`

Contenu :
- Engagement : compter les hex de A en contact avec hex de B (voisins)
- Effectif engagé = somme `effectiveShare` des hex en contact
- Bonus terrain : moyenne pondérée par effectif engagé
- Pertes : réparties au prorata `effectiveShare` sur les hex de l'unité

**Validation** : tests combat 2-hex vs 1-hex, 3-hex vs 3-hex côte à côte.

### TASK 5.6.6 — Render multi-hex

**Fichiers IN** :
- `src/render/units/UnitPlaceholder.tsx`
- `src/render/units/UnitHealthBar.tsx`

**Fichiers OUT** :
- `src/render/units/UnitFigurines.tsx` (NEW, N figurines instancées selon positions)
- `src/render/units/UnitHealthBar.tsx` (positionnée sur l'hex "principal" = centroïde)
- `src/render/units/UnitLabel.tsx` (1 label central pour le groupe)

**Validation** : visuel propre, figurines lerp en cohérence, label unique.

### TASK 5.6.7 — Sélection multi-hex

**Fichiers IN** : `src/hooks/useTacticalSelection.ts`

**Fichiers OUT** :
- `src/hooks/useTacticalSelection.ts` (clic sur n'importe quel hex → sélectionne toute l'unité)
- Tests dédiés

**Validation** : click 1 hex de l'unité, ring de sélection autour des N hex.

### TASK 5.6.8 — EF resolve_action multi-hex

**Fichiers IN** :
- `supabase/functions/resolve_action/index.ts`
- `supabase/functions/_shared/engine-port/`

**Fichiers OUT** :
- `supabase/functions/resolve_action/index.ts` (v24, mirror engine multi-hex)
- `supabase/functions/_shared/engine-port/movement/multi-hex-move.ts` (mirror)
- `supabase/functions/_shared/engine-port/combat/multi-hex.ts` (mirror)
- `supabase/functions/_shared/engine-port/zoc/zoc.ts` (mirror)

**Validation** : combat + mvmt fonctionnent 2 navigateurs sans desync.

### TASK 5.6.9 — IA multi-hex

**Fichiers IN** :
- `src/engine/sim/applyAction.ts`
- `src/engine/ai/scorer.ts`

**Fichiers OUT** :
- `src/engine/sim/applyAction.ts` (PUR refactor multi-hex)
- `src/engine/ai/scorer.ts` (heuristique : multi-hex unit traitée comme entité unique côté évaluation)

**Validation** : winrate test dormant relancé, hard ≥ 60% vs medium (légère régression tolérée).

### Critères fin Lot 5.6
- [ ] BDD `unit_positions` opérationnelle
- [ ] Engine multi-hex sur ZdC/mvmt/combat
- [ ] Render N figurines cohérent
- [ ] EFs déployées prod
- [ ] IA stable
- [ ] ≥ 100 nouveaux tests sur multi-hex
- [ ] Aucune régression sur unités 1-hex (compat MVP)

---

## 8. Critères de fin de Phase 5 (globaux)

- [ ] Tous lots 5.0 à 5.6 livrés
- [ ] Migrations 035-042 appliquées prod
- [ ] EFs `start_battle` v6, `resolve_action` v24, `start_combat` v1, `has_line_of_sight` v2 déployées
- [ ] Cartes 8×8 km (boardRadius 60-80) jouables à 30+ fps minimum
- [ ] 2 scenarios réels en BDD (1 plaine générique + 1 bataille historique)
- [ ] Mode déploiement opérationnel
- [ ] Bâtiments capturables avec bonus défensif
- [ ] Unités multi-hex jouables (sans formations typées)
- [ ] Tests Vitest ≥ 550 verts (vs 381 fin session 26)
- [ ] `tsc` 0 erreur, `build` PWA OK
- [ ] Game.tsx ≤ 500 lignes
- [ ] `dependency-map.md` mis à jour
- [ ] `WIP.md` mis à jour
- [ ] `PLAN-MASTER-CHECKLIST.md` mis à jour : Phase 5 ✅
- [ ] Tag git `phase-5-complete`

---

## 9. Mises à jour annexes nécessaires

### `PLAN-MASTER-CHECKLIST.md`
- Marquer Phase 5 🟡 puis ✅
- Remplacer ligne « Phase 5 ⬜ profondeur tactique » par décomposition Lot 5.0-5.6

### `docs/dependency-map.md`
- Nouvelle section § 13 : carte de dépendances Phase 5 (qui consomme `useTerrainTiles`, `useTerrainBuildings`, `useDeploymentState`)
- Pitfalls 34-40 ajoutés (cf. AUDIT § 5)

### `docs/WIP.md`
- Session 27 : Lot 5.0
- Session 28 : Lot 5.1
- etc.

---

## 10. Risques résiduels non couverts

1. **GLB bâtiments visuels qualité** : MVP en primitives Three.js. Pour visuels finaux qualité Phase 7+, prévoir budget asset.
2. **Sources DEM hors France** : OSM mondial, mais RGE Alti® IGN = France uniquement. Pour batailles hors France (Marignan, Austerlitz), utiliser Copernicus DEM 30 m.
3. **Performance multi-hex × IA minimax** : un bot hard avec 30 unités multi-hex 4-hex chacune = explosion combinatoire. À surveiller, fallback profondeur=2 si > 2 s.
4. **Migration unit_positions atomique** : la migration 042 doit être transactionnelle car backfill + suppression colonnes redondantes. Prévoir rollback testé en branch Supabase avant prod.
5. **Importeur OSM édge cases** : routes en boucle, ponts multi-niveaux, polygones invalides → ignorer avec warning, ne pas crash.

---

## 11. Démarrage : prochaine action concrète

**Session 27 — TASK 5.0.1** : Migration 035 (scenarios étendus).

Pré-flight :
1. ✅ `git status` : commit en cours propre, migrations 025-028 ajoutées
2. ✅ `git tag` : checker dernière tag pour rollback rapide si besoin
3. ✅ `supabase mcp list_projects` : confirmer projet TACTICA prod actif
4. ✅ Lire `AUDIT-PHASE-5.md` § 6 (décisions architecturales) une fois de plus
5. ✅ Décider `metersPerHex` cible Phase 5 (recommandation 50)

Lancement : `Agent` ou direct selon préférence user.
