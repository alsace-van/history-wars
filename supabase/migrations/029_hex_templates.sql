-- ============================================================================
-- Migration 029 : Phase 5 Lot B.1 — table hex_templates (editeur custom)
-- Date : 17/05/2026
-- Source : docs/PLAN-PHASE-5-LOT-B-EDITEUR-HEX.md § 3.1
--
-- Apporte :
--   1. table hex_templates { id, created_by, name, texture_url, texture_scale,
--      texture_mode, assets_3d JSONB, preview_url, created_at, updated_at }
--   2. RLS email-based : SELECT public auth, write reserve alsacevancreation@hotmail.com
--   3. Index par created_by + trigger updated_at (reutilise set_updated_at de 007)
--   4. Realtime publication + replica identity full
--
-- Permissions : seul l'user dont l'email JWT = alsacevancreation@hotmail.com peut
-- INSERT/UPDATE/DELETE. Tous les users authentifies lisent (pour render les
-- templates appliques sur la map via terrain_tiles.template_id).
-- ============================================================================

create table if not exists public.hex_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  texture_url text not null,
  texture_scale real not null default 1.0,
  texture_mode text not null default 'stretch' check (texture_mode in ('stretch', 'tile')),
  assets_3d jsonb not null default '[]'::jsonb,
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hex_templates_created_by on public.hex_templates(created_by);

-- ----------------------------------------------------------------------------
-- Trigger updated_at (reutilise public.set_updated_at() defini migration 007)
-- ----------------------------------------------------------------------------
drop trigger if exists hex_templates_set_updated_at on public.hex_templates;
create trigger hex_templates_set_updated_at
  before update on public.hex_templates
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.hex_templates enable row level security;

drop policy if exists hex_templates_select on public.hex_templates;
create policy hex_templates_select on public.hex_templates
  for select to authenticated
  using (true);

drop policy if exists hex_templates_insert on public.hex_templates;
create policy hex_templates_insert on public.hex_templates
  for insert to authenticated
  with check (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

drop policy if exists hex_templates_update on public.hex_templates;
create policy hex_templates_update on public.hex_templates
  for update to authenticated
  using (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com')
  with check (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

drop policy if exists hex_templates_delete on public.hex_templates;
create policy hex_templates_delete on public.hex_templates
  for delete to authenticated
  using (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

-- ----------------------------------------------------------------------------
-- Realtime publication
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='hex_templates'
  ) then
    alter publication supabase_realtime add table public.hex_templates;
  end if;
end $$;

-- REPLICA IDENTITY FULL pour Realtime filter (cf. piege #10 migration 010)
alter table public.hex_templates replica identity full;
