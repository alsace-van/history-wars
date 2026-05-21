-- ============================================================================
-- Migration 034 : Phase 5 Lot B.6 — UPDATE terrain_tiles pour admin (paint mode)
-- Date : 17/05/2026
-- Source : docs/PLAN-PHASE-5-LOT-B-EDITEUR-HEX.md § 4 B.6
--
-- Permet a l'admin (alsacevancreation@hotmail.com) de UPDATE template_id sur
-- terrain_tiles directement depuis le client (paint mode), sans passer par une
-- Edge Function service_role.
--
-- Limite : la policy autorise tout UPDATE par l'admin. Le client paint mode ne
-- modifie en pratique que template_id ; les autres colonnes (type, q, r) ne sont
-- pas exposees a l'UI. Accepte ce risque pour rester simple.
--
-- Les INSERT/DELETE restent service_role only (start_battle EF gere les tiles).
-- ============================================================================

drop policy if exists terrain_tiles_update_admin on public.terrain_tiles;
create policy terrain_tiles_update_admin on public.terrain_tiles
  for update to authenticated
  using (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com')
  with check (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');
