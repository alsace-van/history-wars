-- ============================================================================
-- Migration 007 : Phase 1 — units + game_actions + state JSONB
-- Date : 09/05/2026
-- Contexte : Phase 1 sous-lot 1B.1 — combat MVP tactique
-- ============================================================================
-- Apporte :
--   1. games.state jsonb (D1, D11) — sous-phases tour + meta scenario
--   2. table units — figurines tactiques (D10 hp_max + morale_max)
--   3. table game_actions — journal complet (D4, D12 idempotence, D13 snapshot)
--   4. RLS SELECT pour les joueurs de la partie. service_role ecrit (EF only).
--   5. Publication realtime sur units + game_actions.
--
-- Helpers reutilises (migration 004) :
--   - public.is_player_in_game(uuid) SECURITY DEFINER
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. games.state jsonb (D1, D11)
-- ----------------------------------------------------------------------------
-- Forme initialisee par start_battle :
--   { "version": 1, "tactical": { phase, boardRadius, currentTurn, activeTeam, scenarioId } }
-- Lectures EF avec defaults `?? value` pour robustesse (D11).

alter table public.games
  add column if not exists state jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. Table units
-- ----------------------------------------------------------------------------
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  team text not null check (team in ('blue', 'red')),
  kind text not null check (kind in ('I', 'C', 'A')),
  -- position cubique : axial suffit, s = -q-r deduit cote client
  q int not null,
  r int not null,
  -- stats vivantes ET max (D10) → robuste aux rebalances futurs
  hp int not null check (hp >= 0),
  hp_max int not null check (hp_max > 0),
  morale int not null default 100 check (morale >= 0),
  morale_max int not null default 100 check (morale_max > 0),
  routed boolean not null default false,
  has_moved boolean not null default false,
  has_attacked boolean not null default false,
  -- audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists units_game_id_idx on public.units(game_id);
create index if not exists units_team_idx on public.units(game_id, team);
-- 1 seule unite par hex et par game (pas de stacking Phase 1)
-- Note piege #18 : pour swap d'unites en Phase 3+, passer en DEFERRABLE INITIALLY DEFERRED.
create unique index if not exists units_position_per_game on public.units(game_id, q, r);

-- ----------------------------------------------------------------------------
-- 3. RLS units
-- ----------------------------------------------------------------------------
-- SELECT : visible aux joueurs de la partie.
-- INSERT/UPDATE/DELETE : aucune policy → seul service_role (Edge Functions).

alter table public.units enable row level security;

drop policy if exists units_select_member on public.units;
create policy units_select_member on public.units
  for select to authenticated
  using (public.is_player_in_game(game_id));

-- ----------------------------------------------------------------------------
-- 4. Table game_actions (D4, D12 idempotence, D13 snapshot)
-- ----------------------------------------------------------------------------
create table if not exists public.game_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  turn int not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type text not null check (action_type in (
    'move', 'attack_ranged', 'attack_melee', 'end_turn', 'start_battle'
  )),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  seed bigint not null,
  client_action_id text,
  resolved_at timestamptz not null default now()
);

create index if not exists game_actions_game_turn_idx on public.game_actions(game_id, turn);
create index if not exists game_actions_actor_idx on public.game_actions(actor_user_id);

-- D12 : idempotence cote serveur. Si deux requetes arrivent avec le meme
-- client_action_id, la 2e leve une violation unique → l'EF retourne le
-- result deja calcule (200 idempotent).
create unique index if not exists game_actions_client_unique
  on public.game_actions(game_id, client_action_id)
  where client_action_id is not null;

-- ----------------------------------------------------------------------------
-- 5. RLS game_actions
-- ----------------------------------------------------------------------------
alter table public.game_actions enable row level security;

drop policy if exists game_actions_select_member on public.game_actions;
create policy game_actions_select_member on public.game_actions
  for select to authenticated
  using (public.is_player_in_game(game_id));

-- ----------------------------------------------------------------------------
-- 6. Publication realtime
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='units'
  ) then
    alter publication supabase_realtime add table public.units;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='game_actions'
  ) then
    alter publication supabase_realtime add table public.game_actions;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Trigger updated_at sur units (utile pour debug + futurs replays)
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();
