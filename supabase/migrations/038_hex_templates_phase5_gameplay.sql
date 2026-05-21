-- ============================================================================
-- Migration 038 : Phase 5 Lot 5.0 TASK 5.0.2 — hex_templates enrichi gameplay
-- Date : 21/05/2026
--
-- hex_templates etait jusqu'ici purement cosmetique (texture + assets_3d).
-- Phase 5 introduit la couche gameplay : un template porte aussi ses regles
-- d'effet sur le moteur (mouvement, LoS, defense, elevation, categorie biome).
--
-- Apporte :
--   biome text             : categorie gameplay (plain/forest/hill/marsh/water/urban/road)
--   elevation_m smallint   : altitude relative en metres (0 = ras-du-sol, jusqu'a +/- 30m)
--   los_block_pct smallint : opacite ligne de vue 0-100 (cumule sur le chemin, bloque si somme >= 100)
--   defense_modifier num   : bonus defense -50% a +100% (vs combat de plaine)
--   movement_cost num      : multiplicateur cout BFS/A* (0.5=route, 1.0=plaine, 2.0=foret, 4.0=marais)
--
-- Templates existants : tous defaultes a biome='plain' (terrain neutre).
-- L'editeur paint mode (Lot 5.0+ post-migration) permettra a l'admin d'editer
-- ces valeurs sur chaque template existant.
--
-- RLS : inchangee (SELECT public, INSERT/UPDATE/DELETE admin par email).
-- ============================================================================

ALTER TABLE public.hex_templates
  ADD COLUMN IF NOT EXISTS biome text NOT NULL DEFAULT 'plain'
    CHECK (biome IN ('plain', 'forest', 'hill', 'marsh', 'water', 'urban', 'road')),
  ADD COLUMN IF NOT EXISTS elevation_m smallint NOT NULL DEFAULT 0
    CHECK (elevation_m BETWEEN -50 AND 200),
  ADD COLUMN IF NOT EXISTS los_block_pct smallint NOT NULL DEFAULT 0
    CHECK (los_block_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS defense_modifier numeric(3,2) NOT NULL DEFAULT 0
    CHECK (defense_modifier BETWEEN -0.50 AND 1.00),
  ADD COLUMN IF NOT EXISTS movement_cost numeric(3,1) NOT NULL DEFAULT 1.0
    CHECK (movement_cost BETWEEN 0.5 AND 10.0);

-- Index sur biome pour query "tous les hex de tel type"
CREATE INDEX IF NOT EXISTS idx_hex_templates_biome
  ON public.hex_templates (biome);

-- Commentaires explicatifs
COMMENT ON COLUMN public.hex_templates.biome IS
  'Categorie gameplay terrain. plain (defaut), forest, hill, marsh, water, urban, road.';

COMMENT ON COLUMN public.hex_templates.elevation_m IS
  'Altitude relative en metres (-50 a +200). Impact LoS (haut voit loin) + charge cavalerie + render Z.';

COMMENT ON COLUMN public.hex_templates.los_block_pct IS
  'Opacite ligne de vue 0-100. Cumule sur le chemin hex. Bloque si somme >= 100. plain=0, forest=30-60, urban=100.';

COMMENT ON COLUMN public.hex_templates.defense_modifier IS
  'Bonus defensif relatif. -0.50 a +1.00. plain=0, forest=+0.25, hill=+0.15, urban=+0.50.';

COMMENT ON COLUMN public.hex_templates.movement_cost IS
  'Multiplicateur cout BFS/A*. 0.5=route, 1.0=plaine, 1.5=hill, 2.0=forest, 2.5=marsh, 10.0=infranchissable.';
