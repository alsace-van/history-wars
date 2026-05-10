-- ============================================================================
-- Migration 012 : Phase 2 — effectif elastique sur units
-- Date : 10/05/2026
-- Source : PLAN-PHASE-2-COMBAT-V2.md § 2B.1
--
-- Apporte :
--   1. units.effective              (hommes vivants combattants)
--   2. units.effective_max          (capacite plein regiment)
--   3. units.effective_min          (seuil disparition / fusion forcee)
--   4. units.killed                 (cumul morts pour stats fin partie)
--   5. units.sub_kind text          (NULL ou 'archer' | 'artillery')
--   6. units.regiment_id uuid NULL  (placeholder Phase 6 : regroupements)
--   7. units.formation text NULL    (placeholder Phase 5 : ligne, colonne, carre, ...)
--   8. units.last_move_path jsonb   (trajectoire ce tour, pour detection charge cav)
--
-- Mapping initial (backfill conservatif depuis UNIT_STATS_V2) :
--   I : effective = 800, effective_max = 800, effective_min = 100
--   C : effective = 180, effective_max = 180, effective_min = 25
--   A : effective = 120, effective_max = 120, effective_min = 30
--
-- Idempotent (ADD COLUMN IF NOT EXISTS).
-- Pas de drop sur hp/hp_max/wounded : conserves 1 phase pour retrocompat (drop Phase 4).
-- ============================================================================

-- 1. Ajout des colonnes en NULL (pour pouvoir backfill cas par cas)
alter table public.units
  add column if not exists effective int,
  add column if not exists effective_max int,
  add column if not exists effective_min int,
  add column if not exists killed int default 0 not null,
  add column if not exists sub_kind text,
  add column if not exists regiment_id uuid,
  add column if not exists formation text,
  add column if not exists last_move_path jsonb;

-- 2. Constraint sur sub_kind (separe de l'ADD COLUMN pour idempotence)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'units_sub_kind_check' and conrelid = 'public.units'::regclass
  ) then
    alter table public.units
      add constraint units_sub_kind_check
      check (sub_kind in ('archer', 'artillery') or sub_kind is null);
  end if;
end $$;

-- 3. Backfill : remplir effective / effective_max / effective_min selon kind
-- Mapping conservatif : pion plein si pas encore touche, sinon proportionnel a hp/hp_max.
update public.units
   set effective = case kind
         when 'I' then round(800 * (hp::numeric / nullif(hp_max, 0)))
         when 'C' then round(180 * (hp::numeric / nullif(hp_max, 0)))
         when 'A' then round(120 * (hp::numeric / nullif(hp_max, 0)))
       end::int
 where effective is null;

update public.units
   set effective_max = case kind
         when 'I' then 800
         when 'C' then 180
         when 'A' then 120
       end
 where effective_max is null;

update public.units
   set effective_min = case kind
         when 'I' then 100
         when 'C' then 25
         when 'A' then 30
       end
 where effective_min is null;

-- 4. Forcer NOT NULL apres backfill
alter table public.units
  alter column effective set not null,
  alter column effective_max set not null,
  alter column effective_min set not null;

-- 5. Defaults pour les futurs INSERT qui n'auraient pas explicitement les colonnes
alter table public.units
  alter column effective set default 100,
  alter column effective_max set default 100,
  alter column effective_min set default 10;

-- 6. Constraints d'invariants (effective >= 0, effective_max > 0, effective_min >= 0)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'units_effective_check' and conrelid = 'public.units'::regclass
  ) then
    alter table public.units
      add constraint units_effective_check check (effective >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'units_effective_max_check' and conrelid = 'public.units'::regclass
  ) then
    alter table public.units
      add constraint units_effective_max_check check (effective_max > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'units_effective_min_check' and conrelid = 'public.units'::regclass
  ) then
    alter table public.units
      add constraint units_effective_min_check check (effective_min >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'units_killed_check' and conrelid = 'public.units'::regclass
  ) then
    alter table public.units
      add constraint units_killed_check check (killed >= 0);
  end if;
end $$;

-- 7. Pas d'index sur les nouvelles colonnes : table petite (~12 lignes / game).
-- Le trigger set_updated_at (migration 007) couvre deja les nouveaux champs.
