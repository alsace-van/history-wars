-- ============================================================================
-- Migration 039 : Phase 5 Lot 5.0 TASK 5.0.3 — Edges + Buildings statiques
-- Date : 21/05/2026
--
-- Architecture statique/runtime :
--   hex_map_edges    : ponts, murs, rivieres, haies entre 2 hex, defini par
--                      le template de carte. Statique.
--   hex_map_buildings : villages, fermes, chateaux poses sur un hex, defini
--                      par le template. Statique.
--   (Lot 5.5)        : terrain_buildings = clone runtime avec etat capture
--                      / garnison, instancie au start_battle.
--   (Phase 6+)       : terrain_edges runtime pour ponts detruits.
--
-- Ordre canonique edges : (q1, r1) < (q2, r2) lexicographiquement pour unicite
-- (un edge entre A et B = un edge entre B et A, on stocke une seule fois).
--
-- RLS : SELECT public (cohérent hex_maps), INSERT/UPDATE/DELETE admin email.
-- ============================================================================

-- =========================================================================
-- 1. hex_map_edges
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.hex_map_edges (
  hex_map_id uuid NOT NULL REFERENCES public.hex_maps(id) ON DELETE CASCADE,
  q1 int NOT NULL,
  r1 int NOT NULL,
  q2 int NOT NULL,
  r2 int NOT NULL,
  edge_kind text NOT NULL
    CHECK (edge_kind IN ('wall', 'hedge', 'bridge', 'ford', 'river_block')),
  -- Ordre canonique : (q1, r1) lex < (q2, r2)
  CHECK ((q1, r1) < (q2, r2)),
  -- Hex doivent etre adjacents (cube_distance = 1)
  -- On ne peut pas appeler cube_distance dans CHECK (function call), on laisse
  -- la validation au code applicatif (engine + EF) en defensive insert.
  PRIMARY KEY (hex_map_id, q1, r1, q2, r2)
);

CREATE INDEX IF NOT EXISTS idx_hex_map_edges_kind
  ON public.hex_map_edges (hex_map_id, edge_kind);

ALTER TABLE public.hex_map_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hex_map_edges_select ON public.hex_map_edges;
CREATE POLICY hex_map_edges_select ON public.hex_map_edges
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS hex_map_edges_insert ON public.hex_map_edges;
CREATE POLICY hex_map_edges_insert ON public.hex_map_edges
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

DROP POLICY IF EXISTS hex_map_edges_update ON public.hex_map_edges;
CREATE POLICY hex_map_edges_update ON public.hex_map_edges
  FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

DROP POLICY IF EXISTS hex_map_edges_delete ON public.hex_map_edges;
CREATE POLICY hex_map_edges_delete ON public.hex_map_edges
  FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

-- =========================================================================
-- 2. hex_map_buildings
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.hex_map_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hex_map_id uuid NOT NULL REFERENCES public.hex_maps(id) ON DELETE CASCADE,
  q int NOT NULL,
  r int NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('farm', 'hamlet', 'church', 'castle', 'windmill', 'bridge_tower', 'ruin')),
  capacity_max int NOT NULL DEFAULT 800
    CHECK (capacity_max BETWEEN 50 AND 5000),
  label text,
  rotation_y real NOT NULL DEFAULT 0,
  scale real NOT NULL DEFAULT 1.0
    CHECK (scale BETWEEN 0.5 AND 3.0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hex_map_id, q, r)
);

CREATE INDEX IF NOT EXISTS idx_hex_map_buildings_kind
  ON public.hex_map_buildings (hex_map_id, kind);

ALTER TABLE public.hex_map_buildings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hex_map_buildings_select ON public.hex_map_buildings;
CREATE POLICY hex_map_buildings_select ON public.hex_map_buildings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS hex_map_buildings_insert ON public.hex_map_buildings;
CREATE POLICY hex_map_buildings_insert ON public.hex_map_buildings
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

DROP POLICY IF EXISTS hex_map_buildings_update ON public.hex_map_buildings;
CREATE POLICY hex_map_buildings_update ON public.hex_map_buildings
  FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

DROP POLICY IF EXISTS hex_map_buildings_delete ON public.hex_map_buildings;
CREATE POLICY hex_map_buildings_delete ON public.hex_map_buildings
  FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

-- =========================================================================
-- 3. Commentaires
-- =========================================================================

COMMENT ON TABLE public.hex_map_edges IS
  'Edges statiques (ponts, murs, haies, rivieres) entre 2 hex adjacents, defini par template hex_map. Ordre canonique (q1,r1) lex < (q2,r2).';

COMMENT ON TABLE public.hex_map_buildings IS
  'Batiments statiques (village, ferme, chateau) places sur un hex, defini par template. Capture/garnison runtime en terrain_buildings (Lot 5.5).';

COMMENT ON COLUMN public.hex_map_buildings.capacity_max IS
  'Effectif max d''une garnison occupant le batiment. 50-5000 hommes. Defaut 800 (1 bataillon).';

COMMENT ON COLUMN public.hex_map_buildings.kind IS
  'Type de batiment. farm/hamlet/church/castle/windmill/bridge_tower/ruin. Determine modele 3D + bonus defensif amplifie.';
