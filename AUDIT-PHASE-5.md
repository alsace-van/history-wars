# AUDIT — Phase 5 (Relief, Terrain Riche, Multi-Hex)

> Lecture réelle du code livré au 21/05/2026 (post-session 26).
> Objectif : recenser fondations utilisables, dette, pièges anticipés AVANT de produire `PLAN-PHASE-5.md`.

---

## 0. TL;DR

L'engine TACTICA est déjà fortement préparé pour la Phase 5 :

- 15 sous-modules `engine/` dont `terrain/` actif (6 types, contactCap, defBonus)
- Table `terrain_tiles` en BDD depuis migration 013, étendue par `hex_templates` (029) et `hex_assets` (032-034)
- A*/BFS acceptent déjà un `costPerHex?: (c: Cube) => number`
- `has_line_of_sight` PL/pgSQL prend `blocker_keys text[]` (migration 024)
- `UnitState.formation` placeholder déjà présent (préparation explicite Phase 5)
- `HexTile` supporte `getElevation?: (c: Cube) => number` (non câblé)

Phase 5 = **étendre, ne pas recréer**. 4 risques majeurs à anticiper :

1. **Perf rendu** : HexGrid en 1 mesh/hex. Inviable à 5 000+ hex sans `InstancedMesh`.
2. **`metersPerHex` placeholder** : actuellement 10 m/hex côté MVP. Bataille de 4 000 hommes implique 50-100 m/hex. Décision à figer en début de phase.
3. **Multi-hex unit** = refonte concept `UnitState.position` (1 cube → N cubes). Touche ZdC, combat, mouvement, LoS, render, BDD. Lot dédié 5.6 en fin de phase.
4. **Game.tsx 863 lignes** (cap 600 violé). À refactorer avant d'ajouter des hooks Phase 5.

---

## 1. État du code livré (factuel)

### 1.1 Engine

Sous-dossiers `src/engine/` :

```
ai/         cohesion/   combat/v2/   engagement/   hex/
los/        morale/     movement/    orders/       scales/
sim/        terrain/    units/       vision/       zoc/
```

#### `engine/units/types.ts` (lignes 54-90)

```ts
export interface UnitState {
  readonly id: string;
  readonly kind: UnitKind;
  readonly subKind?: 'archer' | 'artillery_light' | 'artillery_heavy';
  readonly team: 'blue' | 'red';
  readonly position: Cube;            // ← 1 hex unique aujourd'hui
  readonly hp: number;
  readonly hpMax: number;
  readonly wounded: number;
  readonly morale: number;
  readonly moraleMax: number;
  readonly effective: number;
  readonly effectiveMax: number;
  readonly effectiveMin: number;
  readonly killed: number;
  readonly hasMoved: boolean;
  readonly hasAttacked: boolean;
  readonly routed: boolean;
  readonly lastMovePath?: Cube[];
  readonly regimentId?: string;       // placeholder Phase 6
  readonly formation?: string;        // placeholder Phase 5 ← inutilisé
}
```

Implication : la migration vers multi-hex devra **remplacer** `position: Cube` par `positions: Cube[]` (ou table de jonction).

#### `engine/terrain/types.ts` (lignes 18-51)

6 types actuels : `plaine_ouverte`, `plaine_standard`, `bosquet`, `foret`, `pont`, `breche`.

Chaque type a `TerrainCaps` :
- `contactCap` (saturation hommes au contact)
- `defBonus` (bonus défensif %)
- `atkPenalty` (malus offensif %)
- `cavMovementPenalty` (multiplicateur coût cavalerie)
- `chargeAllowed` (bool)

Manque pour Phase 5 :
- `elevation_m` (altitude relative)
- `losBlockPct` (opacité 0-100)
- `movementCostFactor` infanterie générique
- Edges (ponts/murs/rivières linéaires entre 2 hex)
- Distinction biome cosmétique vs effet gameplay

### 1.2 BDD — terrain et hex

Migrations pertinentes :

| Migration | Apport |
|---|---|
| **013** | Table `terrain_tiles(id, game_id, q, r, type, template_id, created_at)`, UNIQUE `(game_id, q, r)`. Type = enum 6 valeurs. |
| **024** | `has_line_of_sight(aq, ar, as_, bq, br, bs, blocker_keys text[])` SECURITY DEFINER. Bresenham PL/pgSQL avec epsilon shift. |
| **029-030** | `hex_templates` table + `terrain_tiles.template_id` FK. Templates personnalisés par admin. |
| **031-034** | Storage buckets `hex-textures` + `hex-assets` + admin paint mode. |

À ajouter Phase 5 :
- `scenarios.meters_per_hex int`, `scenarios.board_radius int`, `scenarios.bbox jsonb` (traçabilité géo)
- `terrain_tiles.elevation_m smallint`, `terrain_tiles.los_block_pct smallint`, `terrain_tiles.defense_modifier numeric`, `terrain_tiles.movement_cost numeric`
- `terrain_edges(game_id, q1, r1, q2, r2, edge_kind)` table — bridges, walls, hedges, river_blocks
- `terrain_buildings(game_id, q, r, kind, garrison_unit_id, captured_by)` — bâtiments interactifs

### 1.3 BoardRadius / SCALE_CONFIG

Hardcodes actuels :

```ts
// src/ui/pages/Game.tsx:68
const DEFAULT_TACTICAL_RADIUS = 7;

// src/ui/pages/Game.tsx:210
const boardRadius = tactical?.boardRadius ?? DEFAULT_TACTICAL_RADIUS;

// src/ui/editor/MapsList.tsx
radius: 7
```

`SCALE_CONFIG` dans `src/engine/scales/config.ts:19-53` :

```ts
tactical: {
  hexSize: 1.0,
  metersPerHex: 10,           // ← placeholder MVP, à monter
  minutesPerTurn: 1,
  ...
}
operational: { metersPerHex: 500 }
strategic:   { metersPerHex: 5000 }
```

→ Phase 5 doit :
- Permettre `boardRadius` variable par scenario (lu depuis BDD, plus de DEFAULT_TACTICAL_RADIUS)
- Permettre `metersPerHex` variable par scenario (override de SCALE_CONFIG)
- Décider de la **valeur cible MVP** : proposition **50 m/hex** pour batailles médiévales serrées, **100 m/hex** pour batailles modernes.

### 1.4 Mouvement et LoS

`src/engine/movement/path.ts` (A*) et `range.ts` (BFS) acceptent déjà :

```ts
function aStar(from: Cube, to: Cube, opts: {
  costPerHex?: (c: Cube) => number;     // ← câbler ici le coût terrain
  blockedKeys?: Set<string>;
  maxCost?: number;
}): Cube[] | null
```

Par défaut `costPerHex = () => 1`. Phase 5 = injecter un closure qui lit `terrain_tiles`.

`src/engine/hex/line.ts:26-49` :

```ts
export function cubeLineDraw(a: Cube, b: Cube): Cube[]
```

Pas de gestion bloqueurs côté engine pur. Le wrapper LoS gameplay (`engine/los/`) calcule les bloqueurs séparément. Phase 5 doit étendre pour cumuler `los_block_pct` au lieu de booléen "bloque / ne bloque pas".

### 1.5 Render

`src/render/hex/HexGrid.tsx` :
- 1 `<HexTile>` par cube (pas d'InstancedMesh)
- Chaque tile = `<group>` contenant 3 mesh (sol cliquable, overlay flat, bordures)
- Prop `getElevation?: (c: Cube) => number` → position Y du group (ligne 117)
- Hex actuel max ≈ 200 hex (rayon 7) → trivial. Phase 5 cible 5 000+.

`src/render/hex/HexTile.tsx` : matériau plat couleur uniforme + overlay tile state. Aucune notion de biome/texture/asset dynamique.

### 1.6 Game.tsx

863 lignes — cap 600 violé.

Sections principales :
1. Imports (1-41)
2. Hooks (84-148)
3. Calculs combat / unitStates / tileStates (150-400)
4. Effets Realtime / bot / phase transitions (400-650)
5. JSX render (652-828)

**Candidat extractions** :
- `useTacticalRenderState` (calcul tileStates/unitStates) → hook séparé
- `BattleLayout.tsx` (assemblage GameTopBar/Sidebar/HUD/Scene) → composant
- Cible : Game.tsx ≤ 400 lignes après Phase 5 Lot 5.0

---

## 2. Synergies avec phases précédentes

| Phase précédente | Apport réutilisable Phase 5 |
|---|---|
| Phase 1 (engine combat) | `costPerHex` paramètre BFS/A* prêt à recevoir terrain |
| Phase 2 (terrain typé) | 6 types existants + `TerrainCaps` → étendre à 8-10 types avec elevation/LoS/buildings |
| Phase 3.1 (fog client) | LoS calc côté client réutilisable, juste les bloqueurs à enrichir |
| Phase 4-bis Lot 1 (fog serveur RLS) | `has_line_of_sight` PL/pgSQL extensible avec `los_block_pct` |
| Phase 4-bis Lot 2 (IA minimax) | `applyAction` PUR → l'évaluation IA bénéficiera du nouveau terrain sans refactor IA |
| Migrations 029-034 (hex_templates/assets) | Paint mode admin déjà en place → réutiliser pour scenarios custom |

---

## 3. Pièges anticipés Phase 5

### 3.1 Performance rendu (CRITIQUE)

**Symptôme prévu** : 5 000 hex → 5 000 mesh + 5 000 LineSegments + 5 000 overlay = ~15 000 objets dans la scène. FPS effondrés.

**Mitigation** :
- HexGrid → `InstancedMesh` (1 draw call sol + 1 draw call bordures)
- Tile states (sélection, reachable, targetable, dangerous) → overlay séparé en `InstancedMesh` avec mutation `instanceColor`
- Bâtiments → 1 `InstancedMesh` par type (`farm`, `church`, `castle`)
- Cull frustum activé (drei `<PerformanceMonitor>` pour mesurer)

**Test perf à réaliser dès Lot 5.0** : générer un scenario à `boardRadius=80` (~19 200 hex), mesurer FPS. Cible 60 fps en idle, ≥ 30 fps en bataille active.

### 3.2 Cohérence `metersPerHex`

Pitfall potentiel : changer SCALE_CONFIG.tactical de 10 à 50 casse silencieusement des hypothèses ailleurs.

À auditer en Lot 5.0 :
- Distances ranged unit stats (un `range: 6` à 10 m/hex = 60 m, à 50 m/hex = 300 m → impact balance)
- Vision unit stats (idem)
- Animations lerp `SECONDS_PER_HEX` côté render

→ **Décision attendue en Lot 5.0** : soit (A) on garde `metersPerHex=10` côté SCALE_CONFIG et on override par scenario, soit (B) on monte SCALE_CONFIG.tactical à 50 m/hex et on rebalance toutes les stats. Recommandation : (A) plus sûr, plus rapide.

### 3.3 Multi-hex unit — refonte transversale

Refonte BDD `units.position: Cube → positions: Cube[]` touche :

- `engine/zoc/zoc.ts` (ZdC = union des voisins de tous les hex de l'unité)
- `engine/combat/v2/*` (chaque hex en contact résout son propre combat ? ou unité agrégée ?)
- `engine/movement/path.ts` (déplacement = la forme se translate en bloc, vérifier collisions sur chaque hex de la destination)
- `engine/los/*` (chaque hex de l'unité a sa propre LoS)
- `engine/sim/applyAction.ts` (simulation IA → impact perf important)
- `render/units/UnitPlaceholder.tsx` (N figurines au lieu de 1, lerp coordonné)
- BDD `units` table (refonte schéma — migration importante)
- EFs `resolve_action`, `run_bot_turn`, `start_battle` (toutes touchées)

**Décision Lot 5.6** : introduire le concept **sans** typer la formation (carré/ligne/colonne). L'unité a juste N hex contigus. Mouvement = bloc rigide. Formation = Phase 6.

### 3.4 LoS opacité partielle

Aujourd'hui : `blocker_keys text[]` → booléen "bloqué / pas bloqué" PL/pgSQL.

Cible Phase 5 : cumul `los_block_pct` le long du chemin, bloqué si somme ≥ 100. Forêt légère 30%, forêt dense 60%, bâtiment 100%.

→ Modification PL/pgSQL `has_line_of_sight` + cohérence client engine. Pitfall : oublier de répliquer la nouvelle logique sur le mirror client.

### 3.5 Edges (ponts, rivières, murs)

Aujourd'hui : tout l'effet terrain est **par hex**. Mais une rivière coule **entre** des hex, un pont franchit **entre** 2 hex.

Solution proposée : table `terrain_edges(q1, r1, q2, r2, edge_kind)` avec contrainte d'ordre canonique (q1, r1) < (q2, r2) pour unicité.

Pitfall : oublier de checker l'edge dans BFS/A*. Le mvmt de A vers B doit consulter à la fois `terrain_tiles[B]` ET `terrain_edges[A → B]`.

### 3.6 Source de vérité hex_templates vs nouveau schéma

Migrations 029-030 ont introduit `hex_templates` et `terrain_tiles.template_id`. Phase 5 introduit `elevation_m`, `los_block_pct`, etc. directement sur `terrain_tiles`.

→ Question : `hex_templates` définit le **type** (forêt dense, plaine, marais) avec ses propriétés par défaut, et `terrain_tiles` instancie ce template à une position avec override possible ?

**Décision attendue Lot 5.0** : oui, conserver `hex_templates` comme dictionnaire de types + ajouter colonnes effet directement sur templates (pas sur tiles, sauf override).

### 3.7 Importeur DEM/OSM = code en dehors du jeu

Script Node `scripts/build-scenario.ts` ne tourne ni dans React ni dans Deno. Pitfall : tenter d'importer des modules engine ESM avec config Vite → fail. Solution : utiliser `tsx` (ou `ts-node`) en standalone, dupliquer le minimum nécessaire (`cubeDistance`, conversions hex/world).

### 3.8 Cumul `boardRadius` × multi-hex × InstancedMesh

Risque combinatoire : si on attaque les 3 en parallèle, on ne saura pas quoi déboguer en cas de crash. **Ordre obligatoire** :

1. InstancedMesh d'abord (perf seule)
2. boardRadius variable ensuite (taille seule)
3. Multi-hex en dernier (sémantique seule)

---

## 4. Hypothèses de design à figer en Lot 5.0

| Question | Proposition | Décision attendue |
|---|---|---|
| `metersPerHex` cible MVP Phase 5 | 50 m/hex (médiéval) avec override scenario 100 m/hex (moderne) | Lot 5.0 |
| `boardRadius` MVP Phase 5 | 40-60 (carte 4×4 à 6×6 km à 50 m/hex) | Lot 5.0 |
| Bâtiments — capture | 1 unité par bâtiment, garnison limitée à effectif réduit (max 800 hommes) | Lot 5.5 |
| Mode déploiement | Phase intermédiaire `deploying` entre `lobby` et `in_progress`, drag&drop unités dans zone définie | Lot 5.4 |
| Multi-hex — règle contiguïté | Tous les hex de l'unité doivent former une zone connexe (BFS de validation) | Lot 5.6 |
| Multi-hex — taille max | Variable selon effectif : 1 hex pour ≤ 1 000 h, jusqu'à 10 hex pour 10 000 h | Lot 5.6 |
| Formations typées (carré, ligne, colonne) | REPOUSSÉ Phase 6 | Phase 6 |

---

## 5. Pièges connus (cumul + Phase 5)

Pitfalls existants pertinents : #4 (`hexSize` hardcode), #7 (EF par échelle), #11 (PWA prompt), #20 (lerp via useFrame direct), #22 (REPLICA IDENTITY FULL), #30 (mirror engine ↔ EF), #33 (Game.tsx > 600 lignes).

Nouveaux pitfalls anticipés Phase 5 :

**#34 (anticipé)** — `HexGrid` non-instancé scale-fail au-delà de 1 000 hex. Migrer vers `InstancedMesh` dès Lot 5.0.

**#35 (anticipé)** — Changer `SCALE_CONFIG.tactical.metersPerHex` casse les balances range/vision sans alerte TS. Tests à écrire en garde-fou.

**#36 (anticipé)** — `terrain_edges` non checké dans BFS = unité traverse une rivière à pied. Test régression obligatoire dès Lot 5.2.

**#37 (anticipé)** — Multi-hex unit déplacée hors-zone : si 1 seul hex de la forme sort du board, l'unité entière doit être bloquée. Validation `aStar` doit checker chaque hex de la forme à la destination.

**#38 (anticipé)** — `applyAction` (sim IA) explose en complexité avec multi-hex. La simulation 3-ply hard avec beam=5 doit rester < 3,5 s deadline. Optim possible : multi-hex unit traitée comme entité unique côté IA (heuristique pas de feature combat granulaire).

**#39 (anticipé)** — Importeur OSM/DEM produit un terrain "valide géographiquement" mais injouable (ex : 90 % marais infranchissable). Garde-fou : audit auto post-import (% hex praticables, nb chemins distincts entre les 2 zones de déploiement).

**#40 (anticipé)** — `hex_templates` migration 029-030 est un fond stable, mais les tests Vitest peuvent ne pas couvrir les overrides à la tile. Couverture explicite en Lot 5.2.

---

## 6. Décisions architecturales clés

### 6.1 Représentation BDD du terrain

**Option A — Tout sur `terrain_tiles`** (override complet)
- Simple, 1 table à query
- Redondant (1 forêt = mêmes valeurs répétées 100 fois)

**Option B — `hex_templates` (dictionnaire) + `terrain_tiles.template_id` (instances)** ← retenu
- Dénormalisé propre, déjà en place (migration 030)
- Templates = source de vérité des règles (defense_modifier, los_block_pct, movement_cost)
- Tiles = juste la position + référence template
- Override possible par tile via colonne `overrides jsonb` si besoin Phase 5+

### 6.2 Représentation BDD multi-hex unit

**Option A — `units.positions jsonb` array de cubes**
- Simple, lecture unique
- Sérialisation/désérialisation côté code
- Difficile à indexer par position

**Option B — Table `unit_positions(unit_id, q, r)` jointure** ← retenu
- 1 row par hex occupé, indexable par (game_id, q, r)
- ZdC, target check, LoS plus naturels
- Légère complexité INSERT (1 unit → N rows)

### 6.3 Représentation BDD bâtiments

**Option** — Table dédiée `terrain_buildings(game_id, q, r, kind, capacity, garrison_unit_id, captured_by_team)`.

Indépendante de `terrain_tiles` pour permettre :
- Bâtiment sur n'importe quel type d'hex (village dans plaine, ferme à flanc de colline)
- Capture/garnison dynamique
- Suppression d'un bâtiment (destruction par artillerie Phase 8+)

---

## 7. Estimation effort Phase 5

| Lot | Sessions estimées | Risque |
|---|---|---|
| 5.0 Fondations BDD + perf | 1.5 | Moyen (InstancedMesh = inconnu) |
| 5.1 Importeur DEM/OSM | 1.5 | Moyen (script standalone + sources externes) |
| 5.2 Engine terrain | 1.5 | Faible (architecture prête) |
| 5.3 Render terrain | 1.5 | Moyen (visuels + biomes + bâtiments) |
| 5.4 Mode déploiement | 1.5 | Moyen (UX nouvelle) |
| 5.5 Bâtiments interactifs | 1.5 | Moyen (capture + garnison + UI) |
| 5.6 Multi-hex foundation | 2.5 | Élevé (transversal, beaucoup de modules) |
| **Total Phase 5** | **~12 sessions** | |

À +1-2 sessions de buffer pour bugfix et polish post-livraison de chaque lot.

---

## 8. Suite

Voir `PLAN-PHASE-5.md` pour le découpage en tâches atomiques (Fichiers IN / Fichiers OUT / critères validation).
