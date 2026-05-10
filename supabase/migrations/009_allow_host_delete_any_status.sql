-- ============================================================================
-- Migration 008 : permet a l'hote de dissoudre une partie a tout moment
-- Date : 09/05/2026
-- Contexte : bug L1C.2 — DELETE games_delete_host limite a status='lobby'
-- => en in_progress / finished / abandoned, DELETE echoue silencieusement
--    (RLS denie 0 rows, pas d'erreur SQL) => game zombie cote lobby host.
--
-- Decision : l'hote DOIT pouvoir dissoudre meme une partie en cours
-- (abandon, reset apres bug, etc). Le ON DELETE CASCADE de units +
-- game_actions + game_players nettoie tout proprement.
-- ============================================================================

drop policy if exists games_delete_host on public.games;

create policy games_delete_host
  on public.games
  for delete
  to authenticated
  using (created_by = auth.uid());
