-- ============================================================================
-- Migration 025 : Phase 2.6 — menu cavalerie post-charge (Rester / Replier)
-- Date : 2026-05-16
-- Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 4 + docs/BACKLOG.md ligne 28
--
-- Apporte :
--   1. units.pending_post_charge_target_id : UUID nullable → defender_unit_id.
--      Quand non-null, signale qu'une cavalerie attend la décision du joueur
--      (Rester en mêlée OU Replier 1 hex) suite à une charge réussie où le
--      défenseur a survécu. Bloque la fin de tour côté client tant qu'il y a
--      un pending. Auto-reset à 'stay' en début de tour adverse (failsafe EF).
--
--   2. engagements.from_charge : flag pour appliquer les malus de l'option
--      "Rester en mêlée" (cavalerie pénalisée car non préparée au combat de
--      ligne) :
--        - defense ×0.8 côté cavalerie
--        - attrition ×1.3 côté cavalerie
--      Appliqués dans engine/engagement/tick.ts.
--
-- Idempotente. Pas de RLS change : les colonnes héritent des policies existantes
-- de units et engagements (cf. migrations 007 + 017 + 024).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. units.pending_post_charge_target_id
-- ----------------------------------------------------------------------------
alter table public.units
  add column if not exists pending_post_charge_target_id uuid
    references public.units(id) on delete set null;

-- Index partiel : très peu de rows ont la colonne non-null (1 cavalerie en
-- attente max par game). Lookup rapide côté client + EF.
create index if not exists units_pending_post_charge_idx
  on public.units(game_id)
  where pending_post_charge_target_id is not null;

comment on column public.units.pending_post_charge_target_id is
  'Phase 2.6 : si non-null, cavalerie en attente de choix Rester/Replier suite à charge réussie. Pointe vers defender_unit_id. Reset à null par handleChargeStay ou handleChargeRetreat.';

-- ----------------------------------------------------------------------------
-- 2. engagements.from_charge
-- ----------------------------------------------------------------------------
alter table public.engagements
  add column if not exists from_charge boolean not null default false;

comment on column public.engagements.from_charge is
  'Phase 2.6 : true si engagement créé via "Rester en mêlée" après charge cav. Active malus defense ×0.8 + attrition ×1.3 côté cavalerie dans engine/engagement/tick.ts. Le flag pointe sur l''engagement entier ; le code applique le malus sur le side dont kind===C.';
