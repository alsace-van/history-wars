-- ============================================================================
-- Migration 033 : Phase 5 Lot B.4-bis — bucket Storage hex-assets (GLB customs)
-- Date : 17/05/2026
--
-- Bucket public hex-assets pour stocker les GLB uploades par l'admin.
-- Path pattern : hex-assets/{user_id}/{asset_id}.glb
-- Policies storage.objects : SELECT public (URLs CDN ouvertes), write admin uniquement.
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('hex-assets', 'hex-assets', true)
  on conflict (id) do nothing;

drop policy if exists hex_assets_storage_select on storage.objects;
create policy hex_assets_storage_select on storage.objects
  for select to public
  using (bucket_id = 'hex-assets');

drop policy if exists hex_assets_storage_insert on storage.objects;
create policy hex_assets_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hex-assets'
    and (auth.jwt() ->> 'email') = 'alsacevancreation@hotmail.com'
  );

drop policy if exists hex_assets_storage_update on storage.objects;
create policy hex_assets_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'hex-assets'
    and (auth.jwt() ->> 'email') = 'alsacevancreation@hotmail.com'
  )
  with check (
    bucket_id = 'hex-assets'
    and (auth.jwt() ->> 'email') = 'alsacevancreation@hotmail.com'
  );

drop policy if exists hex_assets_storage_delete on storage.objects;
create policy hex_assets_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hex-assets'
    and (auth.jwt() ->> 'email') = 'alsacevancreation@hotmail.com'
  );
