-- Migration 024 : Phase 4-bis Lot 1 — fog of war server-side via RLS units
--
-- Objectif anti-cheat : un client ne peut plus SELECT les units ennemies hors
-- de son fog (vision allié + LoS Bresenham hex). Les EFs continuent d'utiliser
-- service_role (bypass RLS) → pas affectées.
--
-- Architecture :
--   1. Helpers SQL pure : cube_distance, cube_round, cube_lerp, cube_line_draw
--   2. has_line_of_sight (PL/pgSQL : itère cube line, check blockers units)
--   3. is_unit_visible (security definer : check vision + LoS via mes alliés)
--   4. Policy RESTRICTIVE units_select_fog : AND avec les PERMISSIVE existantes
--      (units_select_member + units_select_spectator), filtre les rows invisibles.
--
-- Spectateurs (NOT in game_players) : bypass fog → voient toutes les units
-- (vue "neutre" du match). Membres humains : fog appliqué. Bots : EF utilise admin.
--
-- Coût : ~O(N_observers × line_length) par row units lue. Indexes existants
-- (units_game_id_idx, units_team_idx) suffisent.

begin;

-- ----------------------------------------------------------------------------
-- 1. Helper : cube_distance (formule cubique).
-- ----------------------------------------------------------------------------
create or replace function public.cube_distance(
  q1 int, r1 int, s1 int,
  q2 int, r2 int, s2 int
) returns int language sql immutable parallel safe as $$
  select (abs(q1 - q2) + abs(r1 - r2) + abs(s1 - s2)) / 2
$$;

-- ----------------------------------------------------------------------------
-- 2. Helper : cube_round (snap fractionnaire → cube entier, préserve invariant).
-- Mirror de src/engine/hex/coordinates.ts cubeRound.
-- ----------------------------------------------------------------------------
create or replace function public.cube_round(
  qf float8, rf float8, sf float8,
  out q int, out r int, out s int
) language plpgsql immutable parallel safe as $$
declare
  q_diff float8;
  r_diff float8;
  s_diff float8;
begin
  q := round(qf)::int;
  r := round(rf)::int;
  s := round(sf)::int;
  q_diff := abs(q - qf);
  r_diff := abs(r - rf);
  s_diff := abs(s - sf);
  if q_diff > r_diff and q_diff > s_diff then
    q := -r - s;
  elsif r_diff > s_diff then
    r := -q - s;
  else
    s := -q - r;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. has_line_of_sight : itère cube line draw entre (a) et (b), retourne false
--    si un blocker (cubeKey "q,r" dans blocker_keys array) est sur un hex
--    intermédiaire (exclut from + to). Mirror de src/engine/los/los.ts.
--
--    blocker_keys est format axial "q,r" comme cubeKey() côté TS (cf piège #13).
-- ----------------------------------------------------------------------------
create or replace function public.has_line_of_sight(
  aq int, ar int, as_ int,
  bq int, br int, bs int,
  blocker_keys text[]
) returns boolean language plpgsql immutable parallel safe as $$
declare
  n int;
  i int;
  t float8;
  -- Epsilon shift (cf src/engine/hex/line.ts cubeLineDraw)
  a_q float8 := aq + 1e-6;
  a_r float8 := ar + 1e-6;
  a_s float8 := as_ - 2e-6;
  b_q float8 := bq + 1e-6;
  b_r float8 := br + 1e-6;
  b_s float8 := bs - 2e-6;
  lerp_q float8;
  lerp_r float8;
  lerp_s float8;
  rounded record;
  step_key text;
begin
  n := public.cube_distance(aq, ar, as_, bq, br, bs);
  if n <= 1 then
    -- Distance 0 ou 1 : aucun intermédiaire → toujours visible.
    return true;
  end if;
  -- i in 1..n-1 (intermédiaires uniquement, pas from/to)
  for i in 1..n-1 loop
    t := i::float8 / n::float8;
    lerp_q := a_q + (b_q - a_q) * t;
    lerp_r := a_r + (b_r - a_r) * t;
    lerp_s := a_s + (b_s - a_s) * t;
    select * into rounded from public.cube_round(lerp_q, lerp_r, lerp_s);
    step_key := rounded.q::text || ',' || rounded.r::text;
    if step_key = any(blocker_keys) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. is_unit_visible : pour un viewer humain donné, est-ce que `unit_id` est
--    visible ? Logique :
--    - Spectateur (pas dans game_players) → true (bypass fog)
--    - Bot (viewer null) → ne devrait pas arriver via auth.uid (bot = service_role)
--    - Mes propres units → true
--    - Sinon → check vision : ∃ ally observer non-routed tel que
--        cube_distance(obs, unit) ≤ obs.vision (du UNIT_STATS_V2)
--        ET has_line_of_sight(obs.pos, unit.pos, blockers=other units)
--
--    SECURITY DEFINER pour bypasser la RLS en interne (sinon récursion infinie).
-- ----------------------------------------------------------------------------
create or replace function public.is_unit_visible(
  p_unit_id uuid,
  p_viewer_uid uuid
) returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
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
  -- Charger l'unit cible
  select game_id, team, q, r, (-q - r) as s
    into v_game_id, v_unit_team, v_unit_q, v_unit_r, v_unit_s
  from public.units
  where id = p_unit_id;
  if v_game_id is null then
    return false;
  end if;

  -- Viewer team (NULL si pas dans game_players → spectateur OU bot)
  select team into v_viewer_team
  from public.game_players
  where game_id = v_game_id and user_id = p_viewer_uid;

  -- Spectateur : on laisse la policy spectator faire son job (cf RLS plus bas).
  -- Cette function retourne false pour spectateur ; le spectateur passe via
  -- la branche NOT EXISTS de units_select_fog.
  if v_viewer_team is null then
    return false;
  end if;

  -- Mes propres units : toujours visibles
  if v_unit_team = v_viewer_team then
    return true;
  end if;

  -- Build blocker keys : toutes les units sauf l'observateur courant et la cible.
  -- Optimisation : on construit le set une fois pour toutes les itérations.
  -- (Approche naïve : on pourrait passer par observateur mais ça multiplie les requêtes.)
  -- Note : on inclut l'unit cible dans les blockers, on l'exclut dans la boucle ci-dessous.
  select coalesce(array_agg(u.q::text || ',' || u.r::text), '{}')
    into v_blocker_keys
  from public.units u
  where u.game_id = v_game_id
    and u.id <> p_unit_id;

  -- Itère mes observateurs alliés non-routed
  for v_observer in
    select id, kind, sub_kind, q, r
    from public.units
    where game_id = v_game_id
      and team = v_viewer_team
      and routed = false
  loop
    -- Vision selon kind (mirror UNIT_STATS_V2 vision : I=3, C=5, A=4)
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
    -- LoS : on retire l'observateur de la liste de blockers (lui-même n'est pas un blocker)
    if public.has_line_of_sight(
      v_observer.q, v_observer.r, -v_observer.q - v_observer.r,
      v_unit_q, v_unit_r, v_unit_s,
      array_remove(v_blocker_keys, v_observer.q::text || ',' || v_observer.r::text)
    ) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

revoke execute on function public.is_unit_visible(uuid, uuid) from public, anon;
grant execute on function public.is_unit_visible(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Policy RESTRICTIVE units_select_fog : AND avec toutes les PERMISSIVE.
--    - Spectateur (pas dans game_players) : bypass fog (true)
--    - Membre game : check is_unit_visible
-- ----------------------------------------------------------------------------
drop policy if exists units_select_fog on public.units;
create policy units_select_fog on public.units
  as restrictive
  for select to authenticated
  using (
    -- Spectateur OU member visible
    not exists (
      select 1 from public.game_players gp
      where gp.game_id = units.game_id and gp.user_id = auth.uid()
    )
    or
    public.is_unit_visible(units.id, auth.uid())
  );

commit;
