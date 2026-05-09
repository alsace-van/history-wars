// v1.0 (09/05/2026) — Phase 1 L1A.3 : ligne de vue
// Source : PLAN-PHASE-1.md § 2.2 (engine/los/los.ts)
// Contrat : la fonction est agnostique de team. Le caller decide quels hex bloquent.
// Convention Phase 1 : alliees ET ennemies bloquent (pas de tir a travers les corps).

import { cubeLineDraw, cubeKey } from '../hex'
import type { Cube } from '../hex'

/**
 * Trace la ligne entre from et to, ignore les extremites,
 * verifie qu'aucun hex intermediaire n'est dans blockers.
 *
 * Cas piege #16 : distance 1 → line.length=2, aucun intermediaire → toujours true.
 */
export function hasLineOfSight(
  from: Cube,
  to: Cube,
  blockers: ReadonlySet<string>,
): boolean {
  const line = cubeLineDraw(from, to)
  // exclure from (index 0) et to (dernier)
  for (let i = 1; i < line.length - 1; i++) {
    if (blockers.has(cubeKey(line[i]))) return false
  }
  return true
}
