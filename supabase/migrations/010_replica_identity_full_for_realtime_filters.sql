-- ============================================================================
-- Migration 010 : REPLICA IDENTITY FULL pour Realtime DELETE filter
-- Date : 09/05/2026 (version repo : 10/05/2026)
-- Contexte : appliquee en prod 09/05/2026 mais absente du repo. Piege #43.
--
-- Sans REPLICA IDENTITY FULL, le payload OLD d'un DELETE realtime ne contient
-- que la PK. Tout filter sur une colonne non-PK (ex: game_id) rate, le client
-- ne recoit jamais l'event => UI desynchronisee (ex: dissolution game zombie).
--
-- Trade-off : payload realtime plus gros (ligne entiere). Acceptable pour les
-- 4 tables ci-dessous (volumes faibles + on a besoin du filter game_id partout).
-- ============================================================================

alter table public.games           replica identity full;
alter table public.game_players    replica identity full;
alter table public.units           replica identity full;
alter table public.game_actions    replica identity full;
