-- ============================================================================
-- Migration 032 : Phase 5 Lot B.4-bis — table hex_assets (GLB customs)
-- Date : 17/05/2026
-- Source : extension docs/PLAN-PHASE-5-LOT-B-EDITEUR-HEX.md § 4 B.4 (custom uploads)
--
-- Apporte :
--   1. table hex_assets { id, created_by, name, url, category, created_at, updated_at }
--      stocke les meta des GLB uploades par l'admin pour remplacer les meshes builtin "Minecraft".
--   2. RLS email-based identique a hex_templates : SELECT public auth, write admin uniquement.
--   3. Trigger updated_at (reutilise public.set_updated_at()).
--   4. Realtime publication + replica identity full.
--
-- Permissions : seul l'user alsacevancreation@hotmail.com peut INSERT/UPDATE/DELETE.
-- ============================================================================

create table if not exists public.hex_assets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  url text not null,
  category text not null default 'custom',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hex_assets_created_by on public.hex_assets(created_by);

drop trigger if exists hex_assets_set_updated_at on public.hex_assets;
create trigger hex_assets_set_updated_at
  before update on public.hex_assets
  for each row execute function public.set_updated_at();

alter table public.hex_assets enable row level security;

drop policy if exists hex_assets_select on public.hex_assets;
create policy hex_assets_select on public.hex_assets
  for select to authenticated
  using (true);

drop policy if exists hex_assets_insert on public.hex_assets;
create policy hex_assets_insert on public.hex_assets
  for insert to authenticated
  with check (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

drop policy if exists hex_assets_update on public.hex_assets;
create policy hex_assets_update on public.hex_assets
  for update to authenticated
  using (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com')
  with check (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

drop policy if exists hex_assets_delete on public.hex_assets;
create policy hex_assets_delete on public.hex_assets
  for delete to authenticated
  using (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='hex_assets'
  ) then
    alter publication supabase_realtime add table public.hex_assets;
  end if;
end $$;

alter table public.hex_assets replica identity full;
