// v1.2 (14/05/2026) — Phase 3.3 : getKindLabel accepte subKind (artillerie légère/lourde, archerie)
// v1.1 (13/05/2026) — Phase 3.2-bis : helper kindLabel pour toasts ticks engagement
// v1.0 (12/05/2026) — QW1 : labels statiques pour Game.tsx (scale + status)
import type { Game } from '@/types/game'
import type { UnitSubKind } from '@engine/units'

export function getKindLabel(kind: 'I' | 'C' | 'A', subKind?: UnitSubKind): string {
  if (kind === 'I') return 'Infanterie'
  if (kind === 'C') return 'Cavalerie'
  // Kind A : différencie selon subKind (Phase 3.3).
  if (subKind === 'archer') return 'Archerie'
  if (subKind === 'artillery_light') return 'Artillerie légère'
  if (subKind === 'artillery_heavy') return 'Artillerie lourde'
  return 'Artillerie'
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
