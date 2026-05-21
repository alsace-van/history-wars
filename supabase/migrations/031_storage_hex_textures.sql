-- ============================================================================
-- Migration 031 : Phase 5 Lot B.1 — bucket Storage hex-textures
-- Date : 17/05/2026
-- Source : docs/PLAN-PHASE-5-LOT-B-EDITEUR-HEX.md § 3.4
--
-- Apporte :
--   1. bucket public hex-textures (URLs accessibles direct, pas de signed URL)
--   2. 4 policies storage.objects : SELECT public, INSERT/UPDATE/DELETE admin
--
-- Path pattern : hex-textures/{user_id}/{template_id}.{jpg|png}
-- Permissions : seul l'email alsacevancreation@hotmail.com peut ecrire.
-- SELECT en `to public` car le bucket est public (URLs CDN directes ouvertes
-- a tout le monde, anonymes inclus pour ne pas bloquer le render Three.js).
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('hex-textures', 'hex-textures', true)
  on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Policies storage.objects pour bucket hex-textures
-- ----------------------------------------------------------------------------

drop policy if exists hex_textures_select on storage.objects;
create policy hex_textures_select on storage.objects
  for select to public
  using (bucket_id = 'hex-textures');

drop policy if exists hex_textures_insert on storage.objects;
create policy hex_textures_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hex-textures'
    and (auth.jwt() ->> 'email') = 'alsacevancreation@hotmail.com'
  );

drop policy if exists hex_textures_update on storage.objects;
create policy hex_textures_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'hex-textures'
    and (auth.jwt() ->> 'email') = 'alsacevancreation@hotmail.com'
  )
  with check (
    bucket_id = 'hex-textures'
    and (auth.jwt() ->> 'email') = 'alsacevancreation@hotmail.com'
  );

drop policy if exists hex_textures_delete on storage.objects;
create policy hex_textures_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hex-textures'
    and (auth.jwt() ->> 'email') = 'alsacevancreation@hotmail.com'
  );
