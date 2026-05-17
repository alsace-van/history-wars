-- ============================================================================
-- Migration 028 : Phase 2.6 — fog of war : alliés ne bloquent plus la LoS
-- Date : 2026-05-16
-- Source : feedback user — quand la cav charge en avant, elle bloque la LoS
--          de l'infanterie/artillerie derrière → les ennemis restants
--          deviennent 'hidden' et disparaissent visuellement.
--
-- Avant : v_blocker_keys = toutes les units du game (alliés + ennemies)
--          excluant uniquement la cible.
-- Après : v_blocker_keys = uniquement les units ENNEMIES (team != viewer_team)
--          excluant la cible. Les alliés de la viewer team ne sont plus
--          considérés comme bloqueurs.
--
-- Rationale : tes propres troupes coordonnent / communiquent, elles n'obstruent
-- pas la perception collective de l'équipe. Les enemies en revanche bloquent
-- toujours la LoS (front-line bloque l'arrière, comme avant).
--
-- Note : has_line_of_sight() reste générique (les autres usages — combat
-- ranged, auto-position art — passent leur propre blocker set incluant tout).
-- Seul is_unit_visible() est modifié.
--
-- Idempotente via CREATE OR REPLACE.
-- ============================================================================

create or replace function public.is_unit_visible(p_unit_id uuid, p_viewer_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_game_id uuid;
  v_unit_team text;
  v_unit_q int;
  v_unit_r int;
  v_unit_s int;
  v_viewer_team text;
  v_observer record;
  v_vision int;
  v_dist int;
  v_blocker_keys text[];
begin
  select game_id, team, q, r, (-q - r) as s
    into v_game_id, v_unit_team, v_unit_q, v_unit_r, v_unit_s
  from public.units
  where id = p_unit_id;
  if v_game_id is null then
    return false;
  end if;

  select team into v_viewer_team
  from public.game_players
  where game_id = v_game_id and user_id = p_viewer_uid;

  if v_viewer_team is null then
    return false;
  end if;

  -- Allié visible par défaut (pas de check fog pour propres troupes).
  if v_unit_team = v_viewer_team then
    return true;
  end if;

  -- v028 : blockers = uniquement les units ENNEMIES (team != viewer_team)
  -- excluant la cible. Les alliés ne bloquent plus la LoS.
  select coalesce(array_agg(u.q::text || ',' || u.r::text), '{}')
    into v_blocker_keys
  from public.units u
  where u.game_id = v_game_id
    and u.id <> p_unit_id
    and u.team <> v_viewer_team;

  for v_observer in
    select id, kind, sub_kind, q, r
    from public.units
    where game_id = v_game_id
      and team = v_viewer_team
      and routed = false
  loop
    v_vision := case v_observer.kind
      when 'I' then 3
      when 'C' then 5
      when 'A' then 4
      else 0
    end;
    if v_vision <= 0 then
      continue;
    end if;
    v_dist := public.cube_distance(
      v_observer.q, v_observer.r, -v_observer.q - v_observer.r,
      v_unit_q, v_unit_r, v_unit_s
    );
    if v_dist > v_vision then
      continue;
    end if;
    if public.has_line_of_sight(
      v_observer.q, v_observer.r, -v_observer.q - v_observer.r,
      v_unit_q, v_unit_r, v_unit_s,
      v_blocker_keys
    ) then
      return true;
    end if;
  end loop;

  return false;
end;
$function$;
