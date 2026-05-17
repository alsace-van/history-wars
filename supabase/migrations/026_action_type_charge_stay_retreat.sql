-- ============================================================================
-- Migration 026 : Phase 2.6 — autoriser action_type 'charge_stay' + 'charge_retreat'
-- Date : 2026-05-16
-- Source : nouveau handlers EF handleChargeStay.ts + handleChargeRetreat.ts
--          (menu post-charge cavalerie Rester / Replier).
--
-- Symptôme sans cette migration :
--   handleChargeStay/Retreat INSERT game_actions échoue silencieusement
--   (console.warn only côté EF, idempotence cassée, snapshot D13 perdu pour
--   replay).
--
-- Pattern strict miroir 020 : DROP + CREATE avec liste complète.
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
    -- Phase 2.6 (menu post-charge cavalerie)
    'charge_stay',
    'charge_retreat',
    -- Phase 3.2 (ordres conditionnels déclenchés en début de tour)
    'order_triggered'
  ));
