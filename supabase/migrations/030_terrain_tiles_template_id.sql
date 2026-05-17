-- ============================================================================
-- Migration 030 : Phase 5 Lot B.1 — terrain_tiles.template_id
-- Date : 17/05/2026
-- Source : docs/PLAN-PHASE-5-LOT-B-EDITEUR-HEX.md § 3.3
--
-- Apporte : colonne template_id (uuid nullable) sur terrain_tiles pointant vers
-- hex_templates. Quand non-null -> render CustomHexMesh + assets 3D du template.
-- Quand null -> fallback comportement Lot 1 (decor fige par type).
--
-- RLS : pas de modif ici. INSERT/UPDATE/DELETE terrain_tiles restent service_role
-- only (cf. 013). La policy admin-update pour paint mode sera ajoutee en B.6.
-- ============================================================================

alter table public.terrain_tiles
  add column if not exists template_id uuid references public.hex_templates(id) on delete set null;

create index if not exists idx_terrain_tiles_template on public.terrain_tiles(template_id);
