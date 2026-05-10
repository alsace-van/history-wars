-- ============================================================================
-- Migration 013 : Phase 2 — table terrain_tiles
-- Date : 10/05/2026
-- Source : PLAN-PHASE-2-COMBAT-V2.md § 2B.2
--
-- Apporte :
--   1. table terrain_tiles { game_id, q, r, type }
--   2. RLS active : SELECT pour membres de la partie, INSERT/UPDATE/DELETE service_role
--   3. Index pour queries rapides par game
--   4. Realtime activee
--
-- Type de terrain MVP Phase 2 : 6 valeurs (cf. engine/terrain/types.ts).
-- Seed depuis scenario JSONB lors de start_battle (defaut : plaine_standard).
-- ============================================================================

create table if not exists public.terrain_tiles (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  q int not null,
  r int not null,
  type text not null check (type in (
    'plaine_ouverte',
    'plaine_standard',
    'bosquet',
    'foret',
    'pont',
    'breche'
  )),
  created_at timestamptz not null default now(),
  unique (game_id, q, r)
);

create index if not exists idx_terrain_tiles_game on public.terrain_tiles(game_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.terrain_tiles enable row level security;

drop policy if exists terrain_tiles_select on public.terrain_tiles;
create policy terrain_tiles_select on public.terrain_tiles
  for select to authenticated
  using (public.is_player_in_game(game_id));

-- INSERT/UPDATE/DELETE : aucune policy → service_role only (Edge Functions).

-- ----------------------------------------------------------------------------
-- Realtime publication
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='terrain_tiles'
  ) then
    alter publication supabase_realtime add table public.terrain_tiles;
  end if;
end $$;

-- REPLICA IDENTITY FULL pour Realtime filter par game_id (cf. piege #10 migration 010)
alter table public.terrain_tiles replica identity full;
