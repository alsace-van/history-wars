-- ============================================================================
-- Migration 037 : Phase 5 Lot 5.0 TASK 5.0.1 — Etend hex_maps pour Phase 5
-- Date : 21/05/2026
--
-- Apporte :
--   meters_per_hex int  : echelle metrique d'un hex (50 medieval / 100 moderne)
--   bbox jsonb          : bounds geo lat/lon si importe DEM/OSM (NULL sinon)
--   source_label text   : libelle humain UI (ex : "Azincourt 1415")
--
-- Note : la colonne radius existait deja (default 7). Phase 5 monte ce default
-- a 40 pour les nouvelles cartes 5x5 km a 50 m/hex. Les hex_maps existants
-- (1 seul : "waterloo" radius=7) ne sont pas touches.
--
-- Note BIS : la colonne games.hex_map_id sera ajoutee dans une migration
-- separee (038) pour bien lier les parties aux cartes. Pour l'instant
-- games.scenario_id text reste legacy.
--
-- RLS : aucune modification (heritee de hex_maps existante : SELECT public,
-- INSERT/UPDATE/DELETE admin par email).
-- ============================================================================

ALTER TABLE public.hex_maps
  ADD COLUMN IF NOT EXISTS meters_per_hex int NOT NULL DEFAULT 50
    CHECK (meters_per_hex BETWEEN 10 AND 500),
  ADD COLUMN IF NOT EXISTS bbox jsonb,
  ADD COLUMN IF NOT EXISTS source_label text;

-- Reborner radius pour Phase 5 (accepter cartes 8x8 km, soit ~80 hex de rayon)
ALTER TABLE public.hex_maps
  DROP CONSTRAINT IF EXISTS hex_maps_radius_check;

ALTER TABLE public.hex_maps
  ADD CONSTRAINT hex_maps_radius_check
    CHECK (radius BETWEEN 3 AND 120);

-- Index sur source_label pour recherche bibliotheque bataille historique
CREATE INDEX IF NOT EXISTS idx_hex_maps_source_label
  ON public.hex_maps (source_label)
  WHERE source_label IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN public.hex_maps.meters_per_hex IS
  'Echelle metrique. 50 = medieval serre, 100 = Napoleonien/1GM. Override SCALE_CONFIG.tactical.';

COMMENT ON COLUMN public.hex_maps.bbox IS
  'Bounds geo {lat_min, lat_max, lon_min, lon_max} si carte importee DEM/OSM. NULL pour fictif.';

COMMENT ON COLUMN public.hex_maps.source_label IS
  'Libelle humain UI distinct du name. Ex: "Azincourt 1415", "Plaine generique 8x8 km".';

COMMENT ON COLUMN public.hex_maps.radius IS
  'Rayon spirale hex centree (0,0). MVP=7 (~200 hex), Phase 5 typique=40-80 (4x4 a 8x8 km).';
