-- ============================================================================
-- Migration 036 : hex_maps.props
-- Date applique prod : 17/05/2026
-- Source : recuperee depuis schema_migrations prod 21/05/2026, fichier local manquant
--
-- Apporte : colonne props JSONB sur hex_maps pour stocker les objets decoratifs
-- (assets 3D places sur la carte editee : arbres, batiments, rochers).
-- ============================================================================

alter table public.hex_maps
  add column if not exists props jsonb not null default '[]'::jsonb;
