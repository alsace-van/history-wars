# Phase 5 Lot B — Éditeur de hex personnalisés

> **Plan complet pour démarrer dans une session clear.**
> Lire en premier après `CLAUDE.md`. Puis attaquer B.1 → B.6 dans l'ordre.

---

## 1. Contexte (état avant Lot B)

### Ce qui a été fait (Phase 5 Lot 1 — session 26 prolongée)

- Hook [`useTerrainTiles`](../src/hooks/useTerrainTiles.ts) — fetch + Realtime de `terrain_tiles` (Map cubeKey → TerrainType)
- Composant [`HexGrassMesh`](../src/render/decor/HexGrassMesh.tsx) v1.4 — charge GLB hex herbe avec 6 variantes (`grass`, `dirt`, `flowers_mid`, `flowers_half`, `flowers_two_thirds`, `flowers`)
- Composant [`PineTreeMesh`](../src/render/decor/PineTreeMesh.tsx) — sapin stylisé Blender (4 cônes étagés + cylindre tronc, 7.7 KB)
- Composant [`TerrainDecor`](../src/render/decor/TerrainDecor.tsx) v1.1 — itère terrainMap et place hex herbe + arbres pour `bosquet`/`foret`
- `HexTile.tsx` v1.6 — bords (lineSegments) opacity 0.15 en idle, overlay illuminations au-dessus de la texture
- Assets dans `public/models/decor/` : 7 GLB (6 variantes herbe + pine_tree)

### Limites actuelles
- Seuls 6 types de terrain figés (`plaine_ouverte`, `plaine_standard`, `bosquet`, `foret`, `pont`, `breche`)
- Aucun moyen pour l'utilisateur de créer ses propres terrains (textures custom, positions custom d'assets)
- Aucun moyen pour éditer la map (peindre des hex avec un type donné)
- Pas d'éditeur Storage pour uploader des textures custom

### Vision Lot B
Permettre à l'utilisateur (et lui seul, par sécurité) de :
1. Créer une **bibliothèque persistante de "hex templates"** : chaque template = une texture custom + paramètres de tiling + assets 3D positionnés
2. **Peindre la map** : sélectionner un template, cliquer sur les hex pour l'appliquer

---

## 2. Décisions validées avec l'user (à respecter strictement)

| Sujet | Décision |
|---|---|
| **Permissions** | Email-based — seul l'user dont `auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com'` peut INSERT/UPDATE/DELETE les hex_templates. SELECT public (autres voient les templates appliqués mais ne peuvent pas en créer). |
| **Storage** | Bucket **public** `hex-textures` — URLs accessibles directement. Pas de signed URL. |
| **Assets 3D dans palette** | sapin (existant) + rochers + buissons + arbres feuillus + tronc couché + mur + tranchée + eau |
| **Lot B avant Lot A** | Pas de paint type-based intermédiaire. L'éditeur custom est livré AVANT toute possibilité de painter avec les types existants. Raisonnement user : "pas envie d'appliquer des textures que je vais remplacer". |
| **Ordre des sous-lots** | B.1 (fondations BDD) → B.2 (CustomHexMesh) → B.3 (UI éditeur) → B.4 (assets 3D in editor) → B.5 (intégration terrain_tiles) → B.6 (paint mode) |

---

## 3. Architecture cible

### 3.1 Stockage BDD (table `hex_templates`)

```sql
create table public.hex_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  texture_url text not null,           -- URL Supabase Storage publique
  texture_scale real not null default 1.0,  -- multiplicateur UV (1=stretch, >1=tile N×N)
  texture_mode text not null default 'stretch' check (texture_mode in ('stretch', 'tile')),
  assets_3d jsonb not null default '[]'::jsonb,  -- voir 3.2 ci-dessous
  preview_url text,                    -- thumbnail (optional, Lot B.3)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_hex_templates_created_by on public.hex_templates(created_by);
```

**RLS** :
- SELECT : `to authenticated` USING (true) — tout le monde voit
- INSERT/UPDATE/DELETE : `to authenticated` USING (`auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com'`)

**Realtime** : oui, pour que la bibliothèque se mette à jour en live.

### 3.2 Format `assets_3d` JSONB

```ts
type AssetKind =
  | 'pine_tree' | 'leaf_tree' | 'log' | 'rock' | 'bush'
  | 'wall' | 'trench' | 'water'

interface PlacedAsset {
  kind: AssetKind
  /** Position locale dans l'hex (centre = 0,0). Coordonnées normalisées hexSize (rayon 1). */
  dx: number  // [-1, 1]
  dz: number  // [-1, 1]
  /** Scale relatif (1 = scale normal). */
  scale: number
  /** Rotation Y en radians. */
  rotationY: number
}

type Assets3D = PlacedAsset[]
```

### 3.3 Extension `terrain_tiles`

```sql
alter table public.terrain_tiles
  add column template_id uuid references public.hex_templates(id) on delete set null;
```

Quand `template_id` est non-null : on render le `CustomHexMesh` du template (au lieu du sol natif + sol herbe via type).
Quand `template_id` est null : comportement actuel (type → décor figé).

### 3.4 Bucket Storage `hex-textures`

- Public
- Path pattern : `hex-textures/{user_id}/{template_id}.{jpg|png}`
- Upload via supabase-js `storage.from('hex-textures').upload()`
- URL via `storage.from('hex-textures').getPublicUrl()`

### 3.5 Composants React

```
src/render/decor/
├── CustomHexMesh.tsx          # NOUVEAU — mesh hex dynamique (texture loadée à la volée)
├── HexGrassMesh.tsx            # existant (Lot 1)
├── PineTreeMesh.tsx            # existant (Lot 1)
├── assets/                     # NOUVEAU — meshes assets 3D
│   ├── LeafTreeMesh.tsx        # arbre feuillu
│   ├── LogMesh.tsx             # tronc couché
│   ├── RockMesh.tsx            # rocher
│   ├── BushMesh.tsx            # buisson
│   ├── WallMesh.tsx            # mur
│   ├── TrenchMesh.tsx          # tranchée
│   └── WaterMesh.tsx           # plan d'eau animé
├── TerrainDecor.tsx            # existant, étendre pour template_id
└── AssetRenderer.tsx           # NOUVEAU — dispatch AssetKind → Mesh

src/ui/editor/                  # NOUVEAU
├── HexTemplateLibrary.tsx      # page/panneau : liste templates + créer/éditer
├── HexTemplateEditor.tsx       # modal édition d'un template
├── HexPreview3D.tsx            # preview Three.js dans la modal
├── TexturePicker.tsx           # input + upload Storage
├── AssetPalette.tsx            # liste cliquable des AssetKind
└── PaintModePanel.tsx          # B.6 — panel pour appliquer un template aux hex

src/hooks/
├── useTerrainTiles.ts          # existant, étendre pour lire template_id
├── useHexTemplates.ts          # NOUVEAU — CRUD + Realtime sur hex_templates
└── usePaintMode.ts             # NOUVEAU — state (active + selected template_id)
```

---

## 4. Sous-lots (à exécuter dans l'ordre)

### B.1 — Fondations BDD + Storage (~1h)

**Livrables** :
- `supabase/migrations/029_hex_templates.sql` :
  - Table `hex_templates`
  - RLS email-based
  - Index + Realtime publication
- `supabase/migrations/030_terrain_tiles_template_id.sql` :
  - ALTER TABLE terrain_tiles ADD COLUMN template_id
- Bucket Storage `hex-textures` :
  - Création manuelle via Supabase Dashboard OU script SQL :
    ```sql
    insert into storage.buckets (id, name, public) values ('hex-textures', 'hex-textures', true);
    -- policies storage.objects pour INSERT/UPDATE/DELETE limité à l'user email
    ```
- Types TypeScript regénérés : `npm run gen-types` (ou manuel dans `src/types/db.ts`)

**Notes** :
- Le classifier auto a déjà bloqué une modification RLS terrain_tiles. Préparer explicitement la demande user pour appliquer ces migrations en debrief.
- Tester la RLS avec un second compte (le second compte doit SELECT mais pas INSERT).

**Vérifications** :
- `npx supabase db push` OK
- INSERT test depuis Supabase Studio en tant qu'utilisateur autorisé → OK
- INSERT depuis un autre user → 403

---

### B.2 — Composant CustomHexMesh dynamique (~1h)

**Livrable** : `src/render/decor/CustomHexMesh.tsx`

**Specs** :
```tsx
interface CustomHexMeshProps {
  textureUrl: string
  textureScale: number  // 1 = stretch, 2 = 2x tile, 3 = 3x tile
  textureMode: 'stretch' | 'tile'
  hexSize: number
  rotationY?: number
}
```

**Implémentation** :
- Crée un mesh hex flat (réutiliser HEX_FLAT_GEOMETRY de HexTile)
- `THREE.TextureLoader().load(textureUrl)` (memoized par URL)
- Si mode='tile', `texture.wrapS = wrapT = THREE.RepeatWrapping; texture.repeat.set(textureScale, textureScale)`
- Si mode='stretch', `texture.repeat.set(1, 1)`, ignore textureScale
- `meshStandardMaterial` avec map = texture, roughness 0.9

**Test** :
- Importer dans un composant test, render avec une texture URL d'un GLB existant
- Vérifier tiling visible avec scale=3

---

### B.3 — UI éditeur : liste + upload + preview (~2h)

**Livrables** :

1. **`src/hooks/useHexTemplates.ts`** :
   - `list(): HexTemplate[]` (avec Realtime)
   - `create(template: Omit<HexTemplate, 'id'|'created_at'|'updated_at'>): Promise<HexTemplate>`
   - `update(id, patch)`, `delete(id)`
   - Upload texture : `uploadTexture(file: File, userId: string, templateId: string): Promise<string>` → renvoie URL

2. **`src/ui/editor/HexTemplateLibrary.tsx`** (page ou modal) :
   - Route `/editor/hex-templates` (à ajouter dans `App.tsx`)
   - Grid des templates existants (thumbnail + nom + boutons éditer/dupliquer/supprimer)
   - Bouton "+ Nouveau template" → ouvre HexTemplateEditor en mode création

3. **`src/ui/editor/HexTemplateEditor.tsx`** :
   - Champs : nom, texture (upload via input file), scale (slider 1-10), mode (radio)
   - Preview 3D live à droite (`HexPreview3D`)
   - Bouton "Sauvegarder" → upload texture vers Storage si nouveau fichier, puis upsert template

4. **`src/ui/editor/TexturePicker.tsx`** :
   - Input type=file (accept image/*)
   - Drag-and-drop area
   - Preview de l'image avant upload
   - Validation taille (max 4 MB ? Power of two recommandé ?)

5. **`src/ui/editor/HexPreview3D.tsx`** :
   - Mini Canvas R3F (300×300px)
   - Caméra fixe vue 3/4
   - Render le CustomHexMesh avec les paramètres en cours

**Restriction** : la route `/editor/hex-templates` n'est accessible que si user.email === 'alsacevancreation@hotmail.com'. Sinon redirect.

**Vérifications** :
- Créer un template, sauvegarder, refresh → toujours là
- Uploader une texture → visible sur le preview
- Tester slider scale en live → tiling change immédiatement
- Tenter d'éditer depuis un autre user → bouton désactivé / 403

---

### B.4 — Assets 3D dans l'éditeur (~1.5h)

**Livrables** :

1. **Meshes assets manquants** (générés en Blender via MCP) :
   - `public/models/decor/rock.glb` — icosaèdre déformé gris (~30 min)
   - `public/models/decor/bush.glb` — 2-3 sphères vert sombre (~15 min)
   - `public/models/decor/leaf_tree.glb` — cylindre tronc + grande sphère verte (~20 min)
   - `public/models/decor/log.glb` — cylindre marron couché (~5 min)
   - `public/models/decor/wall.glb` — barre BoxGeometry pierre (~10 min)
   - `public/models/decor/trench.glb` — fente creusée (BoxGeometry inversé) (~10 min)
   - `public/models/decor/water.glb` — plan bleu (sans texture pour l'instant, on ajoutera shader plus tard) (~5 min)

2. **`src/render/decor/assets/`** : 1 composant `<XxxMesh>` par asset, suivant le pattern `PineTreeMesh.tsx`

3. **`src/render/decor/AssetRenderer.tsx`** :
   ```tsx
   const ASSET_MESH = {
     pine_tree: PineTreeMesh,
     leaf_tree: LeafTreeMesh,
     log: LogMesh,
     rock: RockMesh,
     bush: BushMesh,
     wall: WallMesh,
     trench: TrenchMesh,
     water: WaterMesh,
   }
   export function AssetRenderer({ kind, scale = 1 }: { kind: AssetKind; scale?: number }) {
     const Mesh = ASSET_MESH[kind]
     return <Mesh scale={scale} />
   }
   ```

4. **`src/ui/editor/AssetPalette.tsx`** :
   - Liste cliquable des AssetKind avec preview icon (thumbnails statiques ou mini-preview Canvas)
   - Sélection d'un asset → mode "placement" actif

5. **Extension `HexTemplateEditor`** :
   - Section "Assets 3D" : palette + liste des placed assets
   - Clic sur preview hex (en mode placement) → ajoute un placed asset au pointeur souris (converti dx/dz)
   - Liste des assets placés : éditer scale, rotation, supprimer
   - Sauvegarder écrit `assets_3d` JSONB

**Convention asset 3D** :
- Tous les meshes face naturelle +Z (convention Three.js), hauteur native 1m, base au sol Y=0

---

### B.5 — Intégration avec terrain_tiles (~1h)

**Livrables** :

1. **`useTerrainTiles.ts`** : étendre pour fetch aussi `template_id` :
   ```ts
   export interface TerrainTileRow {
     game_id: string
     q: number
     r: number
     type: TerrainType
     template_id?: string | null
   }
   ```

2. **`TerrainDecor.tsx`** :
   - Si `template_id` présent ET template trouvé en cache → render `<CustomHexMesh>` + AssetRenderer pour chaque placed asset
   - Sinon fallback comportement actuel (type → grass + arbres figés)
   - Hook `useHexTemplates` doit fournir un lookup `Map<templateId, HexTemplate>` pour résolution rapide

3. **Préchargement** : tous les templates avec textures chargés en parallèle via `useGLTF.preload` ou TextureLoader au mount.

**Vérifications** :
- Manuellement définir un `template_id` sur un hex via Supabase Studio → recharger app → l'hex affiche le template au lieu du décor figé
- Mix hex template + hex sans template dans la même map → coexistence OK

---

### B.6 — Paint mode (~1h)

**Livrables** :

1. **`src/hooks/usePaintMode.ts`** :
   - State : `{ active: boolean; selectedTemplateId: string | null }`
   - Méthodes : `activate(templateId)`, `deactivate()`, `apply(cube): Promise<void>` (UPSERT terrain_tiles)

2. **`src/ui/editor/PaintModePanel.tsx`** :
   - Flottant dans Game.tsx (visible uniquement si user.email === alsacevancreation)
   - Affiche la bibliothèque de templates (mini)
   - Clic sur un template → active paint mode
   - Bouton "désactiver"
   - Bouton "Effacer template" (set template_id = null sur hex cliqué)

3. **Game.tsx — intercepter onTileClick** :
   ```tsx
   const handleTileClick = (cube) => {
     if (paintMode.active) {
       void paintMode.apply(cube)
       return  // bypass logique gameplay normale
     }
     // logique existante
   }
   ```

**Vérifications** :
- Activer paint, sélectionner template A, cliquer 3 hex → les 3 affichent template A
- Sélectionner template B, cliquer 2 hex → les 2 affichent template B
- Mode "effacer" → hex reviennent au décor par défaut
- Désactiver paint → clic hex redevient logique gameplay (sélection unité, etc.)

---

## 5. Convention Mesh & Naming

| Convention | Détail |
|---|---|
| Face avant mesh | +Z naturel (Three.js standard, vérifié via `?axes=1` toggle de session précédente) |
| Échelle native | 1m (1 Blender unit = 1m) |
| Position de base | Y=0 (au sol) |
| Naming GLB | snake_case, suffixe optionnel pour variantes |
| Naming composant React | PascalCase + suffixe `Mesh` |
| Headers fichiers | `// vX.Y (DATE) — description` 4 entrées max (cf. CLAUDE.md règle 2) |

---

## 6. Pièges à éviter (rappels Lot 1)

- **Convention spawn** : blue à gauche (-X), red à droite (+X). `initialFacingY` = π/2 pour blue, -π/2 pour red (cf. UnitPlaceholder v2.27)
- **Cube hex** : `cubeKey` = `"q,r"` (axial, 2 comp). Toujours utiliser `parseCubeKey` (pitfall #13)
- **Sandbox Blender macOS** : impossible de lire/écrire dans `Desktop/`. Copier les fichiers vers `/tmp/` avant.
- **Migrations RLS** : le classifier auto bloque par défaut. Préparer l'explication user en amont.
- **Texture étirée** : la texture occupe le bounding box carré de l'hex → coins coupés. Mettre le détail au centre.
- **Tile mode** : nécessite texture seamless sinon coutures visibles.

---

## 7. Fichiers à créer/modifier (récap)

### Nouveaux fichiers
- `supabase/migrations/029_hex_templates.sql`
- `supabase/migrations/030_terrain_tiles_template_id.sql`
- `src/render/decor/CustomHexMesh.tsx`
- `src/render/decor/AssetRenderer.tsx`
- `src/render/decor/assets/LeafTreeMesh.tsx`
- `src/render/decor/assets/LogMesh.tsx`
- `src/render/decor/assets/RockMesh.tsx`
- `src/render/decor/assets/BushMesh.tsx`
- `src/render/decor/assets/WallMesh.tsx`
- `src/render/decor/assets/TrenchMesh.tsx`
- `src/render/decor/assets/WaterMesh.tsx`
- `src/ui/editor/HexTemplateLibrary.tsx`
- `src/ui/editor/HexTemplateEditor.tsx`
- `src/ui/editor/HexPreview3D.tsx`
- `src/ui/editor/TexturePicker.tsx`
- `src/ui/editor/AssetPalette.tsx`
- `src/ui/editor/PaintModePanel.tsx`
- `src/hooks/useHexTemplates.ts`
- `src/hooks/usePaintMode.ts`
- `public/models/decor/{rock,bush,leaf_tree,log,wall,trench,water}.glb` (7 GLB nouveaux)

### Fichiers modifiés
- `src/hooks/useTerrainTiles.ts` — ajouter `template_id` dans le row
- `src/render/decor/TerrainDecor.tsx` — render CustomHexMesh si template_id présent
- `src/ui/pages/Game.tsx` — intercepter onTileClick si paint mode actif, monter PaintModePanel
- `src/App.tsx` — route `/editor/hex-templates`

---

## 8. Vérifications globales fin de Lot B

- [ ] `npx tsc --noEmit` 0 erreur
- [ ] `npx vitest run` 381+/381+ verts (pas de régression Lot 1)
- [ ] `npm run build` PWA OK
- [ ] Migrations 029 + 030 appliquées prod (`supabase db push --project-ref abhbkdyoknrsdavimbpr`)
- [ ] Bucket Storage `hex-textures` créé et accessible
- [ ] Test manuel : créer 3 templates différents, peindre 10 hex, recharger → tout persiste
- [ ] Test sécurité : depuis un compte qui n'est pas alsacevancreation@hotmail.com, tenter de créer un template → 403
- [ ] WIP.md session N+ : ajouter récap Lot B complet
- [ ] CLAUDE.md § 7 : mettre à jour avec Lot B livré

---

## 9. Hors scope (Lot C ultérieur)

- Partage public/privé de templates entre users
- Import/export JSON de templates
- Duplication de templates
- Presets historiques pré-livrés (Forêt Austerlitz, Marais de Pripyat, etc.)
- Annotations textuelles sur hex (noms de villages, repères)
- Animation des textures (eau qui bouge, herbe qui ondule au vent)

---

## 10. Note pour la session qui reprend

Démarre par :

1. **Lire** ce fichier en entier + `CLAUDE.md`
2. **Confirmer les décisions** : email = `alsacevancreation@hotmail.com`, bucket public, assets list complète
3. **Demander à l'user son user_id Supabase** s'il préfère UUID en dur plutôt qu'email-based (au cas où il aurait changé d'avis)
4. **Attaquer B.1** : migration BDD + Storage. Anticiper que le classifier auto va probablement bloquer la migration RLS — expliquer le contexte à l'user en amont (cf. § 6 piège classifier)
5. **Avant chaque sous-lot** : update TodoWrite, vérifier sans interruption qu'on suit l'ordre B.1 → B.6

Fichiers de référence à lire avant d'attaquer (déjà existants Lot 1) :
- `src/render/decor/HexGrassMesh.tsx` (pattern de chargement GLB)
- `src/render/decor/PineTreeMesh.tsx` (pattern minimal)
- `src/render/decor/TerrainDecor.tsx` (intégration scene)
- `src/hooks/useTerrainTiles.ts` (pattern fetch + Realtime)
- `src/hooks/useEngagement.ts` (pattern CRUD complet avec INSERT/UPDATE/DELETE Realtime)
- `supabase/migrations/013_terrain_tiles.sql` (RLS existante terrain_tiles)
