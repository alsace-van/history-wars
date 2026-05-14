-- Migration 022 : Phase 4 IA solo — autorise user_id NULL pour les bots
-- + policy RLS host peut INSERT/DELETE rows is_bot=true.
--
-- Postgres traite multiple NULL ≠ NULL dans les unique constraints donc
-- (game_id, user_id) unique ne bloque pas plusieurs bots dans le même game.

begin;

-- 1. Relâcher NOT NULL sur user_id (si présent).
alter table public.game_players alter column user_id drop not null;

-- 2. Check : si is_bot=false, user_id obligatoire.
alter table public.game_players drop constraint if exists game_players_user_id_required_for_humans;
alter table public.game_players add constraint game_players_user_id_required_for_humans
  check ((is_bot = true) or (user_id is not null));

-- 3. RLS : host peut INSERT is_bot=true.
drop policy if exists game_players_insert_bot on public.game_players;
create policy game_players_insert_bot
  on public.game_players for insert to authenticated
  with check (
    is_bot = true
    and public.is_game_host(game_id)
    and bot_difficulty in ('easy', 'medium', 'hard')
  );

-- 4. RLS : host peut DELETE bot row.
drop policy if exists game_players_delete_bot on public.game_players;
create policy game_players_delete_bot
  on public.game_players for delete to authenticated
  using (is_bot = true and public.is_game_host(game_id));

commit;
