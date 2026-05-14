// v1.3 (14/05/2026) — Phase 4 : getUnitShortLabel (I1/C1/AO1/AC1/AR1) pour journal combat
// v1.2 (14/05/2026) — Phase 3.3 : getKindLabel accepte subKind (artillerie légère/lourde, archerie)
// v1.1 (13/05/2026) — Phase 3.2-bis : helper kindLabel pour toasts ticks engagement
// v1.0 (12/05/2026) — QW1 : labels statiques pour Game.tsx (scale + status)
import type { Game } from '@/types/game'
import type { UnitSubKind, UnitState } from '@engine/units'

export function getKindLabel(kind: 'I' | 'C' | 'A', subKind?: UnitSubKind): string {
  if (kind === 'I') return 'Infanterie'
  if (kind === 'C') return 'Cavalerie'
  // Kind A : différencie selon subKind (Phase 3.3).
  if (subKind === 'archer') return 'Archerie'
  if (subKind === 'artillery_light') return 'Artillerie légère'
  if (subKind === 'artillery_heavy') return 'Artillerie lourde'
  return 'Artillerie'
}

/** Préfixe court : I (infanterie), C (cavalerie), AO (obusier), AC (canon), AR (archer), A (générique). */
export function getKindAbbrev(kind: 'I' | 'C' | 'A', subKind?: UnitSubKind | null): string {
  if (kind === 'I') return 'I'
  if (kind === 'C') return 'C'
  if (subKind === 'archer') return 'AR'
  if (subKind === 'artillery_light') return 'AO'
  if (subKind === 'artillery_heavy') return 'AC'
  return 'A'
}

/**
 * Label court d'une unité dans son camp : "I1", "I2", "AO1", "AC2"…
 * Numérotation = rang dans (team, kind, subKind) trié par id ASC. Stable tant que les units existent.
 * Si l'unité n'est pas trouvée dans allUnits (DELETE déjà arrivé), retourne juste l'abbrev sans numéro.
 */
export function getUnitShortLabel(
  unit: { id: string; team: 'blue' | 'red'; kind: 'I' | 'C' | 'A'; subKind?: UnitSubKind | null },
  allUnits: ReadonlyArray<UnitState>,
): string {
  const abbrev = getKindAbbrev(unit.kind, unit.subKind)
  const peers = allUnits
    .filter(u => u.team === unit.team && u.kind === unit.kind && (u.subKind ?? null) === (unit.subKind ?? null))
    .sort((a, b) => a.id.localeCompare(b.id))
  const idx = peers.findIndex(u => u.id === unit.id)
  if (idx < 0) return abbrev
  return `${abbrev}${idx + 1}`
}

export function getScaleLabel(scale: Game['current_scale']): string {
  if (scale === 'tactical') return 'Échelle tactique'
  if (scale === 'operational') return 'Échelle opérationnelle'
  return 'Échelle stratégique'
}

export function getStatusLabel(status: Game['status']): string {
  switch (status) {
    case 'lobby': return 'En attente'
    case 'briefing': return 'Briefing'
    case 'in_progress': return 'Bataille en cours'
    case 'finished': return 'Bataille achevée'
    default: return status
  }
}
