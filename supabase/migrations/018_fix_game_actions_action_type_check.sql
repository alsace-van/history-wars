-- ============================================================================
-- Migration 018 : Fix CHECK constraint game_actions.action_type
-- Date : 11/05/2026
-- Source : bug session 18 — CHECK constraint migration 007 incomplète bloque
--          tous les action_types Phase 2.0+ (split, merge, retreat, surrender,
--          suicide_attack, break_combat).
--
-- Symptômes constatés en prod :
--   ERROR: new row for relation "game_actions" violates check constraint
--          "game_actions_action_type_check"
--   → INSERT game_actions silencieusement perdu côté EF (console.warn only)
--   → snapshot D13 manquant pour ces actions (replay cassé)
--   → idempotence cassée (pas de cache result si INSERT échoue)
--
-- Action types ajoutés :
--   - Phase 2 (migration manquante) : split_unit, merge_unit
--   - Phase 2.5 : retreat, surrender, suicide_attack
--   - Phase 2.6 : break_combat
--
-- Idempotente : DROP + CREATE conditionnel.
-- ============================================================================

alter table public.game_actions
  drop constraint if exists game_actions_action_type_check;

alter table public.game_actions
  add constraint game_actions_action_type_check
  check (action_type in (
    -- Phase 1
    'move',
    'attack_ranged',
    'attack_melee',
    'end_turn',
    'start_battle',
    -- Phase 2 (sizing)
    'split_unit',
    'merge_unit',
    -- Phase 2.5 (cohésion / actions critiques unité Brisée)
    'retreat',
    'surrender',
    'suicide_attack',
    -- Phase 2.6 (engagement persistant)
    'break_combat'
  ));
