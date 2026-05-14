-- 021_artillery_light_heavy.sql
-- Phase 3.3 (14/05/2026) — sépare l'artillerie en "légère" et "lourde" pour porter une vraie
-- distinction de portée. La portée optimale [minRange, 3] est partagée par les 2 sous-types ;
-- la portée max diffère :
--   - artillery_light : range 3, pas de falloff (max = optimal).
--   - artillery_heavy : range 6, falloff [3..6] vers 0.4 (tir long imprécis).
-- Voir src/engine/units/stats.ts pour le détail des stats.
--
-- Stratégie :
--   1. Étend le check constraint pour autoriser les 2 nouvelles valeurs.
--   2. UPDATE de toutes les unités existantes : sub_kind='artillery' → 'artillery_heavy'
--      (= comportement legacy préservé en passant par le sous-type lourd).
--   3. NULL sub_kind reste valide (resolveUnitStatsV2 fallback sur base = stats lourdes
--      par défaut, garantit rétrocompat des parties sans subKind explicite).
--
-- Idempotente : DROP + ADD du constraint dans tous les cas (le contenu peut différer entre
-- envs locaux et prod si le constraint est déjà étendu).

begin;

-- 1. Migrate legacy 'artillery' rows AVANT de durcir le constraint (sinon update bloqué).
update public.units
   set sub_kind = 'artillery_heavy'
 where sub_kind = 'artillery';

-- 2. Reconstruire le constraint sub_kind avec les nouvelles valeurs.
alter table public.units drop constraint if exists units_sub_kind_check;
alter table public.units
  add constraint units_sub_kind_check
  check (sub_kind in ('archer', 'artillery_light', 'artillery_heavy') or sub_kind is null);

commit;
