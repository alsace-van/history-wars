-- ============================================================================
-- Migration 004 : Fix recursion infinie sur RLS game_players
-- Date : 08/05/2026
-- Contexte : Phase 0, Lot 4 sous-lot 4C (correction migration 003)
-- ============================================================================
-- Cause : la policy game_players_select_visible faisait
--   EXISTS (SELECT FROM game_players gp2 WHERE ...)
-- Cette sous-requete re-declenche la meme policy → boucle infinie.
--
-- Fix : 3 fonctions SECURITY DEFINER qui contournent la RLS pour le check
-- booleen, et rewrite des policies concernees.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fonctions helpers SECURITY DEFINER
-- ----------------------------------------------------------------------------
-- Note securite : ces fonctions ne prennent pas user_id en parametre, elles
-- utilisent auth.uid() en interne. Pas de fuite vers d'autres comptes.

create or replace function public.is_player_in_game(_game_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.game_players
    where game_id = _game_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_game_host(_game_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.games
    where id = _game_id and created_by = auth.uid() and status = 'lobby'
  );
$$;

create or replace function public.is_game_public_lobby(_game_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.games
    where id = _game_id and status = 'lobby' and is_private = false
  );
$$;

-- Verrouille l'execution : pas de PUBLIC ni anon, juste authenticated
revoke execute on function public.is_player_in_game(uuid) from public, anon;
revoke execute on function public.is_game_host(uuid) from public, anon;
revoke execute on function public.is_game_public_lobby(uuid) from public, anon;

grant execute on function public.is_player_in_game(uuid) to authenticated;
grant execute on function public.is_game_host(uuid) to authenticated;
grant execute on function public.is_game_public_lobby(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Rewrite policies recursives
-- ----------------------------------------------------------------------------

-- games : voir les parties auxquelles je participe
drop policy if exists games_select_member on public.games;
create policy games_select_member on public.games for select to authenticated
  using (public.is_player_in_game(id));

-- game_players : voir les slots des parties (les miennes ou publiques en lobby)
drop policy if exists game_players_select_visible on public.game_players;
create policy game_players_select_visible on public.game_players for select to authenticated
  using (
    public.is_player_in_game(game_id)
    or public.is_game_public_lobby(game_id)
  );

-- game_players : l'hote peut kick
drop policy if exists game_players_delete_host on public.game_players;
create policy game_players_delete_host on public.game_players for delete to authenticated
  using (public.is_game_host(game_id));

-- ============================================================================
-- Fin migration 004
-- ============================================================================
