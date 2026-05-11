-- Migration 015 : Phase 2.5 balance — nerf charge cavalerie vs infanterie
--
-- Bug user 11/05/2026 : C 180 charge I 800 sur plaine = 0 mort cav, 100+ pertes
-- inf avec moral défenseur sous seuil routed (pas de riposte) = god mode cav.
--
-- Cause : matchup charge C→I = 1.5 combiné chargeMult 1.3-1.5 + cap 200 donnait
-- power - resistance ≈ 215 → 200+ pertes en 1 coup + chute moral → routed.
--
-- Fix : nerf matchup charge C→I de 1.5 à 1.2. La cav reste fortement avantagée
-- au choc (matchup 1.2 × chargeMult 1.4 = 1.68 effectif) mais le défenseur
-- garde une chance de riposter (moral chute moins brutalement).
--
-- Pas de migration BDD pour data — juste UPDATE du row combat_config existant.

UPDATE public.combat_config
SET config = jsonb_set(
  config,
  '{matchupMatrix,charge,C,I}',
  '1.2'::jsonb
),
version = version + 1
WHERE scale = 'tactical';

-- Note : si plusieurs rows existent (versionning futur), seul le row tactical
-- est ciblé. Le DEFAULT_COMBAT_CONFIG côté code (TS + Deno) est aligné.
