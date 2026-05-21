# PHASE-5 — Sources cartographiques

> Bibliothèque de bbox + URLs pour reproduire des champs de bataille historiques via le pipeline DEM + OSM → BDD.
> Référencé par `scripts/build-scenario.ts` (TASK 5.1.2).

---

## Outils

### DEM (heightmap) — élévation par hex

- **Tangram Heightmapper** : https://tangrams.github.io/heightmapper/ — outil web ultra-simple, exporte PNG 16-bit jusqu'à 8192². Pour 8×8 km à 5 m/px → PNG 1600². Recommandé pour MVP.
- **IGN RGE Alti®** : https://geoservices.ign.fr/rgealti — résolution 1-5 m, France uniquement. Téléchargement par dalles. Pour batailles françaises haute précision.
- **Copernicus DEM (GLO-30)** : https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model — 30 m mondial, libre. Pour batailles hors France (Austerlitz, etc.).

### OSM (vectoriel) — biomes, routes, bâtiments, rivières

- **Overpass Turbo** : https://overpass-turbo.eu/ — interface web pour query Overpass API, exporte GeoJSON
- **Geofabrik downloads** : https://download.geofabrik.de/ — extracts régionaux .osm.pbf si besoin batch
- **CORINE Land Cover** (option Phase 5+) : https://land.copernicus.eu/pan-european/corine-land-cover — couverture du sol Europe 100 m, parfait pour biome dominant

### Bounding box (bbox) standard format

```
[lat_min, lon_min, lat_max, lon_max]   // Overpass / GeoJSON convention
```

---

## Batailles candidates Phase 5

### 1. Azincourt 1415 — bataille médiévale anglo-française

- **Centre** : 50.4628°N, 2.1397°E
- **bbox 4×4 km** : `[50.4448, 2.1117, 50.4808, 2.1677]`
- **Échelle conseillée** : 50 m/hex, board_radius 40
- **Terrain attendu** : champs labourés boueux (clé du désastre français), bois d'Azincourt (nord), bois de Tramecourt (sud), village d'Azincourt + château ruiné
- **Heightmap Tangram** : https://tangrams.github.io/heightmapper/#13.5/50.4628/2.1397
- **Overpass query** :
```overpass
[out:json][timeout:60][bbox:50.4448,2.1117,50.4808,2.1677];
(
  way["highway"];
  way["building"];
  way["landuse"~"forest|wood|farmland|meadow"];
  way["natural"~"wood|wetland"];
  way["waterway"];
);
out geom;
```

### 2. Bouvines 1214 — Philippe Auguste vs Otton IV

- **Centre** : 50.5908°N, 3.1900°E
- **bbox 5×5 km** : `[50.5683, 3.1550, 50.6133, 3.2250]`
- **Échelle conseillée** : 50 m/hex, board_radius 50
- **Terrain attendu** : plaine de la Marque (rivière), village de Bouvines, ponts/gués sur la Marque (manœuvre clé)
- **Heightmap Tangram** : https://tangrams.github.io/heightmapper/#13.5/50.5908/3.1900
- **Overpass query** : même structure qu'Azincourt avec bbox adaptée

### 3. Marignan 1515 — François Ier vs Confédération suisse

- **Centre** : 45.4200°N, 9.2000°E
- **bbox 6×6 km** : `[45.3930, 9.1620, 45.4470, 9.2380]`
- **Échelle conseillée** : 50 m/hex, board_radius 60
- **Terrain attendu** : plaine lombarde, canaux d'irrigation (bloqueurs LoS bas), village de Melegnano
- **Heightmap Tangram** : https://tangrams.github.io/heightmapper/#13/45.42/9.20
- **Note** : hors France, utiliser Copernicus DEM si Tangram insuffisant (Tangram OK pour MVP)

### 4. Austerlitz 1805 — Napoléon contre Russes/Autrichiens

- **Centre** : 49.1283°N, 16.7600°E (plateau de Pratzen)
- **bbox 10×10 km** : `[49.0833, 16.6900, 49.1733, 16.8300]`
- **Échelle conseillée** : 100 m/hex, board_radius 50
- **Terrain attendu** : plateau de Pratzen (clé tactique), villages multiples (Austerlitz, Sokolnitz, Telnitz), étangs gelés au sud (pièges historiques)
- **Heightmap Tangram** : https://tangrams.github.io/heightmapper/#12/49.13/16.76
- **Cap historique** : étangs reproduits avec biome `water` + zones `marsh` adjacentes

### 5. Verdun-Douaumont 1916 — secteur Fort de Douaumont

- **Centre** : 49.2117°N, 5.4350°E
- **bbox 8×8 km** : `[49.1757, 5.3830, 49.2477, 5.4870]`
- **Échelle conseillée** : 100 m/hex, board_radius 40
- **Terrain attendu** : reliefs accidentés (côte de Froideterre, fort de Vaux, fort de Douaumont), bois de Caures (nord), zones de cratères/tranchées (reproduction approximative via `urban` + `ruin`)
- **Heightmap Tangram** : https://tangrams.github.io/heightmapper/#12.5/49.21/5.43
- **Note historique** : OSM moderne ne reflète pas les tranchées de 1916. Compléter manuellement via paint mode admin si besoin.

### 6. Plaine générique 8×8 km — terrain de test fictif

- **Centre** : 47.0000°N, 2.5000°E (centre géographique France, plaine du Berry)
- **bbox 8×8 km** : `[46.9640, 2.4470, 47.0360, 2.5530]`
- **Échelle conseillée** : 50 m/hex, board_radius 80
- **Terrain attendu** : plaine large, quelques forêts éparses, 1-2 hameaux, 1 ruisseau central avec ponts, 1 route principale
- **Usage** : 1er scenario importé (TASK 5.1.3) pour valider le pipeline avant batailles historiques

---

## Convention bbox dans `hex_maps.bbox`

JSONB structure :
```json
{
  "lat_min": 50.4448,
  "lat_max": 50.4808,
  "lon_min": 2.1117,
  "lon_max": 2.1677,
  "epsg": 4326
}
```

Format aligné GeoJSON (WGS84 par défaut). `epsg` optionnel pour cas non-4326.

---

## Mapping biomes OSM → hex_templates

| Tag OSM | Biome cible | los_block_pct | defense_mod | movement_cost |
|---|---|---|---|---|
| `landuse=forest` ou `natural=wood` (dense) | `forest` | 60 | +0.25 | 2.0 |
| `landuse=meadow|grass` ou rien | `plain` | 0 | 0 | 1.0 |
| `natural=wetland` ou `landuse=basin` | `marsh` | 0 | 0 | 2.5 |
| `waterway=river|stream` (zone polygon) | `water` | 0 | 0 | 99 (infranchissable) |
| `highway=*` (linéaire → marquage hex) | `road` | 0 | 0 | 0.5 |
| `landuse=residential|industrial|commercial` ou `building=*` cluster | `urban` | 100 | +0.50 | 1.5 |
| Élévation +10 m au-dessus médiane | `hill` (override) | 0 | +0.15 | 1.3 |

### Mapping bâtiments OSM → hex_map_buildings

| Tag OSM | building_kind cible | capacity_max |
|---|---|---|
| `building=house` isolée | `farm` | 200 |
| `building=*` cluster < 5 (hameau) | `hamlet` | 600 |
| `amenity=place_of_worship` ou `building=church` | `church` | 400 |
| `historic=castle` ou `building=castle` | `castle` | 2000 |
| `man_made=windmill` ou `building=mill` | `windmill` | 50 |
| Pont nommé fortifié | `bridge_tower` | 100 |

Les clusters de bâtiments (> 5 dans un cercle ~50 m) ne sont pas instanciés individuellement mais converti en biome `urban` sur les hex correspondants.

---

## Audit post-import

Le script `build-scenario.ts` produit un audit auto en fin de génération :

```
=== AUDIT SCENARIO "Azincourt 1415" ===
- Total hex : 4 921 (board_radius=40)
- Praticables (movement_cost < 99) : 4 712 (95.8%)
- Bâtiments : 23 (12 farms, 8 hamlets, 2 churches, 1 castle)
- Edges : 18 (12 bridges, 4 fords, 2 walls)
- Chemins distincts entre zones déploiement nord/sud : 4
- Altitude min/max : -3 / +47 m (var. 50 m)
```

Critères validation MVP :
- ≥ 60% hex praticables (sinon trop d'eau/marais → injouable)
- ≥ 3 chemins distincts entre zones de déploiement (sinon stratégies réduites)
- Bâtiments existent (≥ 1 par scenario, sinon pas de couvert)

---

## Workflow concret (≈ 20 min par bataille)

1. Ouvrir Tangram Heightmapper, paramétrer le centre + bbox, exporter PNG → `data/heightmaps/{slug}.png`
2. Ouvrir Overpass Turbo, coller la query bbox, exécuter, exporter GeoJSON → `data/osm/{slug}.geojson`
3. Lancer le script :
   ```bash
   npx tsx scripts/build-scenario.ts \
     --heightmap data/heightmaps/azincourt.png \
     --osm data/osm/azincourt.geojson \
     --slug azincourt-1415 \
     --label "Azincourt 1415" \
     --meters-per-hex 50 \
     --board-radius 40 \
     --bbox "50.4448,2.1117,50.4808,2.1677" \
     --output supabase/migrations/0XX_scenario_azincourt.sql
   ```
4. Lire le rapport d'audit affiché, valider critères
5. Appliquer migration prod via MCP Supabase ou `psql`
6. Vérifier visuellement dans `MapEditor` (le scenario apparaît dans la liste hex_maps)

---

## Suite

- TASK 5.1.2 : implémentation du script `build-scenario.ts`
- TASK 5.1.3 : 1er scenario ingéré (plaine générique 8×8 km recommandée pour MVP)
