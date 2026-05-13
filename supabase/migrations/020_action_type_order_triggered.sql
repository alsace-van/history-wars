-- ============================================================================
-- Migration 020 : Phase 3.2 Vague B4 — autoriser action_type='order_triggered'
-- Date : 13/05/2026
-- Source : docs/PLAN-PHASE-3-2.md + plan on-demarre-la-phase-silly-reddy.md.
--
-- Apporte :
--   - action_type 'order_triggered' (Phase 3.2 — ordres conditionnels résolus
--     automatiquement par resolve_turn en début de tour entrant).
--
-- Pattern strict miroir 018 : DROP + CREATE avec liste complète.
-- Idempotente.
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
    'break_combat',
    -- Phase 3.2 (ordres conditionnels résolus automatiquement)
    'order_triggered'
  ));
