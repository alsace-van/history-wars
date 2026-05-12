// v1.0 (12/05/2026) — QW1 : labels statiques pour Game.tsx (scale + status)
import type { Game } from '@/types/game'

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
