// v1.1 (13/05/2026) — Phase 3.2-bis : helper kindLabel pour toasts ticks engagement
// v1.0 (12/05/2026) — QW1 : labels statiques pour Game.tsx (scale + status)
import type { Game } from '@/types/game'

export function getKindLabel(kind: 'I' | 'C' | 'A'): string {
  if (kind === 'I') return 'Infanterie'
  if (kind === 'C') return 'Cavalerie'
  return 'Archers'
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
