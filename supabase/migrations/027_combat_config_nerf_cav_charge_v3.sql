-- ============================================================================
-- Migration 027 : Phase 2.6 — nerf chargeMultipliers v3 → v4 (post-charge testable)
-- Date : 2026-05-16
-- Source : feedback user — cav one-shot l'infanterie même 800h avec bonus 1.3-1.5,
--          le mécanisme post-charge (stay/retreat) ne se déclenche jamais car
--          le défenseur meurt toujours.
--
-- Avant (v3) : chargeMultipliers = { two: 1.3, three: 1.4, fourPlus: 1.5 }
-- Après (v4) : chargeMultipliers = { two: 1.15, three: 1.20, fourPlus: 1.25 }
--
-- Préserve tout le reste (stats, terrainCaps, matchupMatrix, etc.) en clonant
-- la config v3 et patchant uniquement le champ chargeMultipliers via jsonb_set.
-- Idempotente via ON CONFLICT.
-- ============================================================================

insert into public.combat_config (scale, version, config)
select
  'tactical',
  4,
  jsonb_set(
    config,
    '{chargeMultipliers}',
    '{"two": 1.15, "three": 1.20, "fourPlus": 1.25}'::jsonb,
    true
  )
from public.combat_config
where scale='tactical' and version=3
on conflict (scale, version) do update set config = excluded.config;
