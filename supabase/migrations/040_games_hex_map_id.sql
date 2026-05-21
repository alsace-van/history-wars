-- ============================================================================
-- Migration 040 : Phase 5 Lot 5.0 TASK 5.0.4 prerequis — games.hex_map_id
-- Date : 21/05/2026
--
-- Lie une partie au template de carte hex_maps qu'elle utilise. Avant Phase 5,
-- games.scenario_id text legacy etait la seule reference (string libre style
-- "mvp_v1"). Phase 5 ajoute le lien BDD propre vers hex_maps.
--
-- NULL admis pour compat MVP : si hex_map_id IS NULL, le code retombe sur le
-- comportement legacy (DEFAULT_TACTICAL_RADIUS=7, metersPerHex=SCALE_CONFIG.tactical).
--
-- RLS : inchangee (games conserve ses policies).
-- ============================================================================

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS hex_map_id uuid REFERENCES public.hex_maps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_games_hex_map_id
  ON public.games (hex_map_id) WHERE hex_map_id IS NOT NULL;

COMMENT ON COLUMN public.games.hex_map_id IS
  'Reference vers le template de carte hex_maps. NULL pour scenarios legacy MVP (fallback DEFAULT_TACTICAL_RADIUS=7).';
