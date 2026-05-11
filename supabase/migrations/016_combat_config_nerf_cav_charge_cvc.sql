-- Migration 016 : Phase 2.5 balance v2 — nerf charge cavalerie vs cavalerie
--
-- Bug user 11/05/2026 (post-migration 015) : C 180 charge C 180 → one-shot
-- défenseur en variance haute.
-- Calcul : power = 180 × 1.1 × 1.1 (matchup C→C charge) × 1.4 (chargeMult)
-- = 305, resistance = 162 → 143 pertes avg, variance 121-164.
-- Si variance haute : 164 pertes → 16 hommes restants < effectiveMin (25) =
-- dissolution = one-shot.
--
-- Fix : matchup charge C→C 1.1 → 0.9. Cav vs cav qui se chargent : les chevaux
-- s'entrechoquent / esquivent, l'impact n'est pas décisif comme une charge
-- contre une ligne d'infanterie statique.
--
-- Nouveau calibrage estimé :
--   power = 180 × 1.1 × 0.9 × 1.4 = 249
--   resistance = 162
--   damage = 87 × variance → 74-100 pertes (50% du précédent)
--   effective restant = 180 - 90 = 90 (jamais dissolution)

UPDATE public.combat_config
SET config = jsonb_set(
  config,
  '{matchupMatrix,charge,C,C}',
  '0.9'::jsonb
),
version = version + 1
WHERE scale = 'tactical';
