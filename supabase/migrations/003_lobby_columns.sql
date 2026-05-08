-- ============================================================================
-- Migration 003 : Lobby columns + RLS + Realtime publication
-- Date : 08/05/2026
-- Contexte : Phase 0, Lot 4 (sous-tâches 0.5 + 0.11)
-- ============================================================================
-- Idempotente : peut être réexécutée sans casser l'état existant.
--   - colonnes : ADD COLUMN IF NOT EXISTS
--   - contraintes : DROP CONSTRAINT IF EXISTS puis ADD CONSTRAINT
--   - policies : DROP POLICY IF EXISTS puis CREATE POLICY
--   - publication realtime : check via pg_publication_tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. games : compléter avec colonnes lobby + futures phases
-- ----------------------------------------------------------------------------
alter table public.games
  add column if not exists turn_number     int          not null default 0,
  add column if not exists mode            text         not null default 'casual',
  add column if not exists is_private      boolean      not null default false,
  add column if not exists invite_code     text,
  add column if not exists last_action_at  timestamptz  not null default now(),
  add column if not exists max_players     int          not null default 4,
  add column if not exists scenario_id     text;

-- check : mode dans liste blanche
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'games_mode_check'
  ) then
    alter table public.games
      add constraint games_mode_check
      check (mode in ('casual', 'ranked'));
  end if;
end $$;

-- check : status dans liste blanche (étend la valeur existante)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'games_status_check'
  ) then
    alter table public.games
      add constraint games_status_check
      check (status in ('lobby', 'briefing', 'in_progress', 'finished', 'abandoned'));
  end if;
end $$;

-- check : max_players dans plage raisonnable
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'games_max_players_check'
  ) then
    alter table public.games
      add constraint games_max_players_check
      check (max_players between 2 and 8);
  end if;
end $$;

-- index unique sur invite_code (partial : seulement quand non null)
create unique index if not exists games_invite_code_key
  on public.games (invite_code)
  where invite_code is not null;

-- ----------------------------------------------------------------------------
-- 2. game_players : compléter avec colonnes lobby + futures phases
-- ----------------------------------------------------------------------------
alter table public.game_players
  add column if not exists team             text,
  add column if not exists role             text     not null default 'commander',
  add column if not exists slot_index       int,
  add column if not exists is_bot           boolean  not null default false,
  add column if not exists bot_difficulty   text;

-- check : team dans liste blanche
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'game_players_team_check'
  ) then
    alter table public.game_players
      add constraint game_players_team_check
      check (team is null or team in ('blue', 'red'));
  end if;
end $$;

-- check : role dans liste blanche
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'game_players_role_check'
  ) then
    alter table public.game_players
      add constraint game_players_role_check
      check (role in ('general', 'commander'));
  end if;
end $$;

-- check : bot_difficulty dans liste blanche (ou null)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'game_players_bot_difficulty_check'
  ) then
    alter table public.game_players
      add constraint game_players_bot_difficulty_check
      check (bot_difficulty is null or bot_difficulty in ('easy', 'medium', 'hard'));
  end if;
end $$;

-- contrainte : pas 2 fois le même user dans la même partie
alter table public.game_players
  drop constraint if exists game_players_unique_user_per_game;
alter table public.game_players
  add constraint game_players_unique_user_per_game
  unique (game_id, user_id);

-- contrainte : un slot ne peut pas être pris 2 fois dans la même partie
alter table public.game_players
  drop constraint if exists game_players_unique_slot_per_game;
alter table public.game_players
  add constraint game_players_unique_slot_per_game
  unique (game_id, slot_index);

-- ----------------------------------------------------------------------------
-- 3. RLS policies — games
-- ----------------------------------------------------------------------------
-- Sécurité : on droppe puis recrée pour rester idempotent.
-- (CREATE POLICY IF NOT EXISTS n'existe pas avant Postgres 17.)

-- Lecture : parties publiques en lobby
drop policy if exists games_select_lobby_public on public.games;
create policy games_select_lobby_public
  on public.games
  for select
  to authenticated
  using (status = 'lobby' and is_private = false);

-- Lecture : parties auxquelles je participe (via game_players)
drop policy if exists games_select_member on public.games;
create policy games_select_member
  on public.games
  for select
  to authenticated
  using (
    id in (
      select game_id from public.game_players where user_id = auth.uid()
    )
  );

-- Insertion : un user authentifié crée une partie où il est created_by
drop policy if exists games_insert_self on public.games;
create policy games_insert_self
  on public.games
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- Update : seulement l'hôte, et seulement tant que la partie n'est pas finie
drop policy if exists games_update_host on public.games;
create policy games_update_host
  on public.games
  for update
  to authenticated
  using (created_by = auth.uid() and status in ('lobby', 'briefing', 'in_progress'))
  with check (created_by = auth.uid());

-- Delete : seulement l'hôte, et seulement en lobby
drop policy if exists games_delete_host on public.games;
create policy games_delete_host
  on public.games
  for delete
  to authenticated
  using (created_by = auth.uid() and status = 'lobby');

-- ----------------------------------------------------------------------------
-- 4. RLS policies — game_players
-- ----------------------------------------------------------------------------

-- Lecture : slots des parties visibles (publiques en lobby OU mes parties)
-- Note : on évite la récursion via games en utilisant le statut + visibilité directement.
drop policy if exists game_players_select_visible on public.game_players;
create policy game_players_select_visible
  on public.game_players
  for select
  to authenticated
  using (
    -- je vois les slots si je suis moi-même dans la partie
    exists (
      select 1 from public.game_players gp2
      where gp2.game_id = game_players.game_id
        and gp2.user_id = auth.uid()
    )
    or
    -- ou si la partie est publique en lobby
    exists (
      select 1 from public.games g
      where g.id = game_players.game_id
        and g.status = 'lobby'
        and g.is_private = false
    )
  );

-- Insertion : un user s'ajoute lui-même comme humain dans une partie en lobby
drop policy if exists game_players_insert_self on public.game_players;
create policy game_players_insert_self
  on public.game_players
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_bot = false
    and exists (
      select 1 from public.games g
      where g.id = game_players.game_id
        and g.status = 'lobby'
    )
  );

-- Suppression : un user se retire lui-même
drop policy if exists game_players_delete_self on public.game_players;
create policy game_players_delete_self
  on public.game_players
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Suppression : l'hôte peut kick un autre joueur tant que la partie est en lobby
drop policy if exists game_players_delete_host on public.game_players;
create policy game_players_delete_host
  on public.game_players
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_players.game_id
        and g.created_by = auth.uid()
        and g.status = 'lobby'
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Publication Realtime (sync postgres_changes)
-- ----------------------------------------------------------------------------
-- Active la publication uniquement si pas déjà fait.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_players'
  ) then
    alter publication supabase_realtime add table public.game_players;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Index utiles
-- ----------------------------------------------------------------------------
create index if not exists games_status_idx
  on public.games (status)
  where status = 'lobby';

create index if not exists games_created_by_idx
  on public.games (created_by);

create index if not exists game_players_game_id_idx
  on public.game_players (game_id);

create index if not exists game_players_user_id_idx
  on public.game_players (user_id);

-- ============================================================================
-- Fin migration 003
-- ============================================================================
