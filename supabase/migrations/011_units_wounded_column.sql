-- ============================================================================
-- Migration 011 : ajout colonne units.wounded — Phase 1.5 polish
-- Date : 10/05/2026
-- Contexte : introduction du modele wounded distinct de killed.
--
-- Convention :
--   - hp           = soldats actifs (combattent, recoivent les coups, ZoC)
--   - wounded      = soldats blesses (ne combattent plus, soignables Phase 3
--                    par une future unite Infirmier)
--   - hp_max - hp - wounded = morts cumules (calcule, non stocke)
--
-- A chaque hit de damage D :
--   killed     = round(D * 0.6)   -> hp -= D (perte definitive)
--   wounded_add = D - killed       -> wounded += wounded_add (recoverable)
--
-- L'invariant hp + wounded <= hp_max est gere par l'EF (clamp), PAS par un
-- check SQL — pour ne pas bloquer un UPDATE atomique sur edge case race.
-- ============================================================================

alter table public.units
  add column if not exists wounded integer not null default 0
  check (wounded >= 0);

-- Pas d'index : scan unit-par-unit suffit, table petite (~12 lignes par game).
-- Pas de migration de donnees : default 0 valide pour toutes les rows existantes.
