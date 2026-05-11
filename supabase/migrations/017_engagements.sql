-- ============================================================================
-- Migration 017 : Phase 2.6 — table engagements (combat persistant)
-- Date : 11/05/2026
-- Source : docs/PLAN-ENGAGEMENT-PERSISTENT.md § 1, 9 B.1
--
-- Apporte :
--   1. table engagements { id, game_id, unit_a_id, unit_b_id, started_turn, created_at }
--   2. Contrainte d'unicité d'une paire (unit_a_id, unit_b_id) par game
--      (normalisée : on stocke toujours unit_a_id < unit_b_id alphabétiquement)
--   3. RLS SELECT membre via is_player_in_game (cf. piège #8 / migration 004)
--   4. Index par game_id et par unit ids pour lookup rapide
--   5. Publication realtime
--   6. ON DELETE CASCADE : si une unité est supprimée (dissolution), ses
--      engagements sont auto-supprimés.
--
-- Idempotente.
-- ============================================================================

create table if not exists public.engagements (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  unit_a_id uuid not null references public.units(id) on delete cascade,
  unit_b_id uuid not null references public.units(id) on delete cascade,
  started_turn int not null check (started_turn > 0),
  created_at timestamptz not null default now(),
  -- Invariant : une paire ne se duplique pas (a, b) vs (b, a) en stockant
  -- toujours en ordre lexicographique (a < b textuel sur uuid).
  constraint engagements_pair_order check (unit_a_id < unit_b_id),
  constraint engagements_no_self check (unit_a_id <> unit_b_id)
);

-- ----------------------------------------------------------------------------
-- Index
-- ----------------------------------------------------------------------------
create index if not exists engagements_game_id_idx on public.engagements(game_id);
create index if not exists engagements_unit_a_idx on public.engagements(unit_a_id);
create index if not exists engagements_unit_b_idx on public.engagements(unit_b_id);

-- Unicité de la paire par game (peu importe l'ordre car contraint plus haut).
create unique index if not exists engagements_unique_pair
  on public.engagements(game_id, unit_a_id, unit_b_id);

-- ----------------------------------------------------------------------------
-- RLS — SELECT visible aux joueurs de la partie. INSERT/UPDATE/DELETE :
--       aucune policy → service_role only (Edge Functions).
-- Réutilise public.is_player_in_game(uuid) SECURITY DEFINER de la migration 004.
-- ----------------------------------------------------------------------------
alter table public.engagements enable row level security;

drop policy if exists engagements_select_member on public.engagements;
create policy engagements_select_member on public.engagements
  for select to authenticated
  using (public.is_player_in_game(game_id));

-- ----------------------------------------------------------------------------
-- Realtime publication (les clients voient apparaître/disparaître les engagements)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='engagements'
  ) then
    alter publication supabase_realtime add table public.engagements;
  end if;
end $$;

-- REPLICA IDENTITY FULL pour que les DELETE soient propagés avec leur payload
-- complet via Realtime (cf. piège analogue migration 010 sur units).
alter table public.engagements replica identity full;
