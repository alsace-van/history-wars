// v1.1 (14/05/2026) — Phase 3.3-bis : ajout 'always' (Toujours) + 'camp' (Camper)
// v1.0 (13/05/2026) — Phase 3.2 Vague C2 : labels FR pour ordres conditionnels
import type { OrderActionKindUI, OrderTriggerKindUI } from '@hooks/usePreOrders'

export const TRIGGER_LABEL: Record<OrderTriggerKindUI, string> = {
  on_attacked: 'Si attaquée',
  enemy_in_range: 'Si ennemi à portée',
  cohesion_broken: 'Si Brisée',
  enemy_los: 'Si ennemi visible',
  always: 'Toujours',
}

export const ACTION_LABEL: Record<OrderActionKindUI, string> = {
  charge: 'Charger',
  fire: 'Tirer',
  retreat: 'Replier',
  hold: 'Tenir position',
  camp: 'Camper (repos)',
}

export const SKIP_LABEL: Record<string, string> = {
  broken: 'Brisée (offensif bloqué)',
  has_moved: 'Déjà bougé',
  has_attacked: 'Déjà attaqué',
  no_target: 'Aucune cible',
  routed: 'En déroute',
}

/** Texte humanisé "Si X → Y" pour une posture. */
export function describePosture(
  triggerKind: OrderTriggerKindUI,
  actionKind: OrderActionKindUI,
  range?: number,
): string {
  let trig = TRIGGER_LABEL[triggerKind]
  if (triggerKind === 'enemy_in_range' && range !== undefined) {
    trig = `Si ennemi à portée ${range}`
  }
  return `${trig} → ${ACTION_LABEL[actionKind]}`
}
