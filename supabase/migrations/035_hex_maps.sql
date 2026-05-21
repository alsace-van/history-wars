-- ============================================================================
-- Migration 035 : hex_maps (editeur Phase 5 paint mode)
-- Date applique prod : 17/05/2026
-- Source : recuperee depuis schema_migrations prod 21/05/2026, fichier local manquant
--
-- Apporte : table hex_maps stockant les cartes editees via le paint mode admin.
-- tiles JSONB = dictionnaire {q,r} -> { type, template_id, ... }
-- props JSONB ajoute par migration 036.
--
-- RLS : tous authentifies peuvent SELECT (lecture publique pour bibliotheque
-- de cartes), INSERT/UPDATE/DELETE restreints a l'admin par email.
-- ============================================================================

create table if not exists public.hex_maps (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  radius int not null default 7,
  tiles jsonb not null default '{}'::jsonb,
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hex_maps_created_by on public.hex_maps(created_by);

drop trigger if exists hex_maps_set_updated_at on public.hex_maps;
create trigger hex_maps_set_updated_at
  before update on public.hex_maps
  for each row execute function public.set_updated_at();

alter table public.hex_maps enable row level security;

drop policy if exists hex_maps_select on public.hex_maps;
create policy hex_maps_select on public.hex_maps
  for select to authenticated
  using (true);

drop policy if exists hex_maps_insert on public.hex_maps;
create policy hex_maps_insert on public.hex_maps
  for insert to authenticated
  with check (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

drop policy if exists hex_maps_update on public.hex_maps;
create policy hex_maps_update on public.hex_maps
  for update to authenticated
  using (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com')
  with check (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

drop policy if exists hex_maps_delete on public.hex_maps;
create policy hex_maps_delete on public.hex_maps
  for delete to authenticated
  using (auth.jwt() ->> 'email' = 'alsacevancreation@hotmail.com');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='hex_maps'
  ) then
    alter publication supabase_realtime add table public.hex_maps;
  end if;
end $$;

alter table public.hex_maps replica identity full;
