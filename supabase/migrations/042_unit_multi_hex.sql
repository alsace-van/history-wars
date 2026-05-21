-- Migration 042 — Phase 5 Lot 5.6 TASK 5.6.1
-- Track B : Multi-Hex Foundation.
--
-- Crée la table unit_positions : 1 unité = N hex contigus (Phase 5+).
-- Backfill : pour chaque unit existante, 1 row dans unit_positions avec
-- effective_share = effective (toute l'unité sur 1 hex en compat MVP).
--
-- Les colonnes units.q / units.r restent en place pour compat 1-hex tant
-- que toutes les consommatrices n'ont pas migré vers positions[]. Elles
-- seront marquées DEPRECATED puis supprimées en Phase 5+ après stabilisation.
--
-- RLS :
--   - SELECT : hérite de la RLS units (EXISTS units ⇒ RLS units évaluée → fog).
--   - INSERT/UPDATE/DELETE : aucune policy ⇒ service_role only (jamais client).
--
-- REPLICA IDENTITY FULL : nécessaire pour propager UPDATE par hex via Realtime
-- (déplacement multi-hex en bloc rigide).

-- 1. Table
CREATE TABLE IF NOT EXISTS public.unit_positions (
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  q int NOT NULL,
  r int NOT NULL,
  effective_share int NOT NULL CHECK (effective_share >= 0),
  PRIMARY KEY (unit_id, q, r)
);

-- 2. Index secondaire (q, r) pour query "qui occupe cet hex ?" rapide
CREATE INDEX IF NOT EXISTS idx_unit_positions_qr
  ON public.unit_positions (q, r);

-- 3. Backfill : 1 row par unit existante (idempotent via NOT EXISTS).
INSERT INTO public.unit_positions (unit_id, q, r, effective_share)
SELECT u.id, u.q, u.r, u.effective
FROM public.units u
WHERE NOT EXISTS (
  SELECT 1 FROM public.unit_positions p WHERE p.unit_id = u.id
);

-- 4. RLS
ALTER TABLE public.unit_positions ENABLE ROW LEVEL SECURITY;

-- 4a. SELECT : hérite cascade de la RLS units (fog server-side migration 024).
--     EXISTS units force l'évaluation de toutes les policies units, donc :
--       - membres du game voient leurs propres unités (+ alliés)
--       - membres du game voient les ennemis visibles uniquement (LoS + vision)
--       - spectateurs voient tout (status='in_progress')
DROP POLICY IF EXISTS unit_positions_select ON public.unit_positions;
CREATE POLICY unit_positions_select
  ON public.unit_positions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = unit_positions.unit_id
    )
  );

-- 4b. Pas de policy INSERT/UPDATE/DELETE → bloqué par défaut.
--     service_role (EFs) bypass RLS pour les writes.

-- 5. REPLICA IDENTITY FULL pour Realtime (UPDATE par hex)
ALTER TABLE public.unit_positions REPLICA IDENTITY FULL;

-- 6. Ajout à la publication Realtime (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'unit_positions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_positions;
  END IF;
END $$;

-- 7. Commentaires explicatifs
COMMENT ON TABLE public.unit_positions IS
  'Phase 5 Lot 5.6 — 1 unité = N hex contigus. Backfilled depuis units.q/r en MVP (1 row par unit).';
COMMENT ON COLUMN public.unit_positions.effective_share IS
  'Part de l''effectif total de l''unité présente sur cet hex. Somme(effective_share) = units.effective.';
