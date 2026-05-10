-- ============================================================================
-- Migration 008 : Fix advisor lint 0011 — function_search_path_mutable
-- Date : 09/05/2026 (version repo : 10/05/2026)
-- Contexte : appliquee en prod 09/05/2026 mais absente du repo.
-- Lint Supabase advisor signalait public.set_updated_at sans search_path fige.
-- Risque : function pouvait etre detournee si un schema malveillant etait
-- prepende au search_path. Fix : set search_path = public en attribut de fonction.
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
