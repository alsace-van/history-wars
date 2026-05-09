-- ============================================================================
-- Migration 006 : Ajout colonne id PK sur game_players
-- ============================================================================
-- La PK initiale (game_id, user_id) empechait de DELETE par id (kick).
-- On ajoute une colonne `id uuid PK` (default gen_random_uuid pour les rows
-- existantes) et la contrainte UNIQUE (game_id, user_id) reste via
-- game_players_unique_user_per_game (migration 003).
-- ============================================================================

alter table public.game_players add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'game_players_pkey' and conrelid = 'public.game_players'::regclass) then
    alter table public.game_players drop constraint game_players_pkey;
  end if;
end $$;

alter table public.game_players add constraint game_players_pkey primary key (id);
