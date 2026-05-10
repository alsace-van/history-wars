-- ============================================================================
-- Migration 014 : Phase 2 — table combat_config + seed JSONB initial
-- Date : 10/05/2026
-- Source : PLAN-PHASE-2-COMBAT-V2.md § 2B.3
--
-- Apporte :
--   1. table combat_config { scale, version, config jsonb }
--   2. Seed initial pour scale='tactical' version 1 (mirror DEFAULT_COMBAT_CONFIG)
--   3. RLS : SELECT public authenticated, INSERT/UPDATE/DELETE service_role
--
-- Permet edition runtime des coefs combat sans redeploy (preparation Phase 15
-- moddabilite). L'EF resolve_action lit cette table au demarrage de chaque
-- invocation.
-- ============================================================================

create table if not exists public.combat_config (
  id uuid primary key default gen_random_uuid(),
  scale text not null check (scale in ('tactical', 'operational', 'strategic')),
  version int not null default 1,
  config jsonb not null,
  created_at timestamptz not null default now(),
  unique (scale, version)
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.combat_config enable row level security;

drop policy if exists combat_config_select on public.combat_config;
create policy combat_config_select on public.combat_config
  for select to authenticated
  using (true);

-- INSERT/UPDATE/DELETE : aucune policy → service_role only.

-- ----------------------------------------------------------------------------
-- Seed initial Phase 2 (mirror DEFAULT_COMBAT_CONFIG dans engine/combat/v2/types.ts)
-- ----------------------------------------------------------------------------
insert into public.combat_config (scale, version, config) values (
  'tactical',
  1,
  '{
    "diceVariance": { "low": 0.85, "range": 0.30 },
    "chargeMultipliers": { "two": 1.3, "three": 1.4, "fourPlus": 1.5 },
    "moraleThresholds": { "rout": 25, "test": 30 },
    "matchupMatrix": {
      "melee": {
        "I": { "I": 1.0, "C": 1.1, "A": 1.5 },
        "C": { "I": 0.9, "C": 1.0, "A": 1.5 },
        "A": { "I": 0.5, "C": 0.5, "A": 1.0 }
      },
      "ranged": {
        "I": { "I": 0.8, "C": 0.7, "A": 0.9 },
        "C": { "I": 0.5, "C": 0.5, "A": 0.5 },
        "A": { "I": 1.0, "C": 0.7, "A": 1.5 }
      },
      "charge": {
        "I": { "I": 1.0, "C": 1.0, "A": 1.0 },
        "C": { "I": 1.5, "C": 1.1, "A": 1.5 },
        "A": { "I": 1.0, "C": 1.0, "A": 1.0 }
      }
    },
    "stats": {
      "I": { "effectiveMax": 800, "effectiveMin": 100, "attack": 1.0, "defense": 1.0, "rangedPower": 0, "range": 1, "minRange": 0, "movement": 3, "moraleMax": 100 },
      "C": { "effectiveMax": 180, "effectiveMin":  25, "attack": 1.5, "defense": 0.7, "rangedPower": 0, "range": 1, "minRange": 0, "movement": 6, "moraleMax": 100 },
      "A": { "effectiveMax": 120, "effectiveMin":  30, "attack": 0.5, "defense": 0.3, "rangedPower": 4.0, "range": 7, "minRange": 2, "movement": 2, "moraleMax": 100, "archerOverride": { "range": 4, "minRange": 0, "rangedPower": 2.5 } }
    },
    "terrainCaps": {
      "plaine_ouverte":  { "contactCap": 300, "defBonus": 1.0, "atkPenalty": 1.0, "cavMovementPenalty": 1.0, "chargeAllowed": true },
      "plaine_standard": { "contactCap": 200, "defBonus": 1.0, "atkPenalty": 1.0, "cavMovementPenalty": 1.0, "chargeAllowed": true },
      "bosquet":         { "contactCap": 150, "defBonus": 1.2, "atkPenalty": 0.9, "cavMovementPenalty": 0.7, "chargeAllowed": false },
      "foret":           { "contactCap": 100, "defBonus": 1.5, "atkPenalty": 0.8, "cavMovementPenalty": 0.4, "chargeAllowed": false },
      "pont":            { "contactCap":  80, "defBonus": 1.3, "atkPenalty": 1.0, "cavMovementPenalty": 0.5, "chargeAllowed": false },
      "breche":          { "contactCap":  50, "defBonus": 1.5, "atkPenalty": 1.0, "cavMovementPenalty": 0.0, "chargeAllowed": false }
    }
  }'::jsonb
)
on conflict (scale, version) do nothing;
