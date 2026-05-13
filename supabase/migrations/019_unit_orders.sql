-- ============================================================================
-- Migration 019 : Phase 3.2 Vague B1 — table unit_orders (pré-postures conditionnelles)
-- Date : 13/05/2026
-- Source : docs/PLAN-PHASE-3-2.md (à créer) + plan on-demarre-la-phase-silly-reddy.md.
--
-- Apporte :
--   1. table unit_orders { id, game_id, unit_id, owner_user_id, priority, trigger jsonb, action jsonb, active, created_at }
--   2. Contrainte unique (unit_id, priority) — un seul ordre par priorité par unité.
--   3. Limite max 3 ordres par unité (check priority between 1 and 3).
--   4. RLS owner-only (les ordres sont privés au joueur jusqu'à déclenchement).
--   5. Pas dans supabase_realtime (privacy gameplay — UI fetch + invalidate local).
--   6. ON DELETE CASCADE : si une unité disparaît (mort/fusion), ses ordres aussi.
--
-- Idempotente.
-- ============================================================================

create table if not exists public.unit_orders (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  priority int not null check (priority between 1 and 3),
  trigger jsonb not null,
  action jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Index
-- ----------------------------------------------------------------------------
create index if not exists unit_orders_game_id_idx on public.unit_orders(game_id);
create index if not exists unit_orders_unit_id_idx on public.unit_orders(unit_id);
create index if not exists unit_orders_owner_idx on public.unit_orders(owner_user_id);

-- Unicité de (unit_id, priority) — un seul ordre par slot de priorité par unité.
create unique index if not exists unit_orders_unit_priority_unique
  on public.unit_orders(unit_id, priority);

-- ----------------------------------------------------------------------------
-- RLS — accès owner-only (le joueur ne voit / modifie que SES ordres pour SES
-- unités). Privacy gameplay : l'adversaire ne doit pas pouvoir lire les ordres.
-- ----------------------------------------------------------------------------
alter table public.unit_orders enable row level security;

drop policy if exists unit_orders_select_owner on public.unit_orders;
create policy unit_orders_select_owner on public.unit_orders
  for select to authenticated
  using (auth.uid() = owner_user_id);

drop policy if exists unit_orders_insert_owner on public.unit_orders;
create policy unit_orders_insert_owner on public.unit_orders
  for insert to authenticated
  with check (auth.uid() = owner_user_id and public.is_player_in_game(game_id));

drop policy if exists unit_orders_update_owner on public.unit_orders;
create policy unit_orders_update_owner on public.unit_orders
  for update to authenticated
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists unit_orders_delete_owner on public.unit_orders;
create policy unit_orders_delete_owner on public.unit_orders
  for delete to authenticated
  using (auth.uid() = owner_user_id);

-- ----------------------------------------------------------------------------
-- PAS de publication supabase_realtime (privacy : RLS owner-only suffit, et
-- la UI rafraîchit en local après chaque mutation EF — pas besoin de pousser).
-- ----------------------------------------------------------------------------
