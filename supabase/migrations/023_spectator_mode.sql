-- Migration 023 : Phase 4 — mode spectateur pour parties in_progress
-- Tout user authentifié peut SELECT les données publiques d'une partie EN COURS,
-- sans avoir besoin d'être dans game_players. INSERT/UPDATE/DELETE restent
-- réservés aux membres (cf. policies existantes, additives OR).
--
-- Phase 4-bis (fog server-side RLS) restreindra ensuite la visibilité des
-- units par LoS server-side ; pour l'instant fog client-side suffisant.

begin;

-- games : visible si in_progress (en + de lobby public + membre)
drop policy if exists games_select_in_progress_public on public.games;
create policy games_select_in_progress_public
  on public.games for select to authenticated
  using (status = 'in_progress');

-- units : visible si la game est in_progress
drop policy if exists units_select_spectator on public.units;
create policy units_select_spectator on public.units
  for select to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = units.game_id and g.status = 'in_progress'
    )
  );

-- game_actions : idem
drop policy if exists game_actions_select_spectator on public.game_actions;
create policy game_actions_select_spectator on public.game_actions
  for select to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_actions.game_id and g.status = 'in_progress'
    )
  );

-- game_players : visible si game in_progress (spectateurs voient les slots)
drop policy if exists game_players_select_spectator on public.game_players;
create policy game_players_select_spectator on public.game_players
  for select to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_players.game_id and g.status = 'in_progress'
    )
  );

-- terrain_tiles : idem
drop policy if exists terrain_tiles_select_spectator on public.terrain_tiles;
create policy terrain_tiles_select_spectator on public.terrain_tiles
  for select to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = terrain_tiles.game_id and g.status = 'in_progress'
    )
  );

-- engagements : idem
drop policy if exists engagements_select_spectator on public.engagements;
create policy engagements_select_spectator on public.engagements
  for select to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = engagements.game_id and g.status = 'in_progress'
    )
  );

commit;
