-- ============================================================================
-- Migration 005 : Drop policies legacy de la migration 001 qui causent recursion
-- Date : 08/05/2026
-- Contexte : Phase 0, Lot 4 sous-lot 4C
-- ============================================================================
-- Postgres combine TOUTES les policies PERMISSIVE en OR. Les policies
-- ecrites en francais dans la migration 001 font des EXISTS croises sans
-- SECURITY DEFINER, donc elles declenchent la recursion meme avec nos
-- nouvelles policies SECURITY DEFINER de la migration 004.
--
-- On les supprime : les nouvelles policies des migrations 003 + 004
-- couvrent exactement les memes besoins (et plus, avec en plus la securite
-- "hote uniquement peut update sa partie", "delete only en lobby", etc).
-- ============================================================================

drop policy if exists "Voir parties en lobby ou auxquelles on participe" on public.games;
drop policy if exists "Creer une partie" on public.games;
drop policy if exists "Modifier sa partie" on public.games;

drop policy if exists "Voir les joueurs des parties accessibles" on public.game_players;
drop policy if exists "Rejoindre une partie" on public.game_players;
drop policy if exists "Quitter une partie" on public.game_players;

-- ============================================================================
-- Fin migration 005
-- ============================================================================
