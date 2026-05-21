// v1.0 (21/05/2026) — Phase 5 Lot 5.6 : Billboard label central (extrait de UnitPlaceholder pour multi-hex)
// Frontière render/ : zéro Supabase, zéro hooks data.

import { Billboard, Text } from '@react-three/drei'
import type { UnitInstance } from '../types'
import {
  resolveAttackIconColor,
  resolveMoveIconColor,
  resolveActiveOrderIcon,
} from './UnitPlaceholder'

interface UnitLabelProps {
  unit: UnitInstance
  /**
   * Position Y du centre du Billboard (au-dessus du sommet du mesh principal).
   * Calculé par le parent : `soldierScale * MESH_TOP_HEIGHT_BY_KIND[kind] + 0.3`.
   */
  yOffset: number
  /** Affiche les icônes d'état d'ordres (⚔ / ⬢) + healthbar count. Réservé aux unités du viewer. */
  showHealthBar: boolean
  /** Mode silhouette (ennemi repéré non identifié) — masque tous les détails. */
  silhouette: boolean
}

/**
 * Label central d'une unité (mono ou multi-hex). Affiche :
 *  - kind / ordinal (I.1, C.2, AO.3…)
 *  - icône ⚔ (attaque dispo) + ⬢ (mouvement dispo)
 *  - icône d'ordre conditionnel actif (♞ charge / ⚔ fire / ↩ retreat / 🛡 hold / ⛺ camp)
 *  - effectif chiffre (own only via showHealthBar)
 *  - "?" en mode silhouette
 *
 * Pour 1-hex : utilisé in-place dans UnitPlaceholder (rendu identique au legacy).
 * Pour multi-hex : utilisé par UnitFigurines au centroïde de l'unité.
 */
export function UnitLabel({ unit, yOffset, showHealthBar, silhouette }: UnitLabelProps) {
  const labelText = silhouette ? '?' : (unit.ordinalLabel ?? unit.kind)
  // Calque le calcul d'iconOffsetX de UnitPlaceholder v2.11 (anti-chevauchement).
  const iconOffsetX = labelText.length * 0.09 + 0.50
  const orderIcon = !silhouette && showHealthBar ? resolveActiveOrderIcon(unit.activeOrder) : null

  return (
    <Billboard position={[0, yOffset, 0]} follow lockX={false} lockY={false} lockZ={false}>
      <Text fontSize={0.32} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.025} outlineColor="#000000">
        {labelText}
      </Text>
      {orderIcon && (
        <Text
          position={[0, -0.62, 0]}
          fontSize={0.24}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#000000"
          color={orderIcon.color}
        >
          {orderIcon.char}
        </Text>
      )}
      {!silhouette && showHealthBar && (
        <>
          <Text
            position={[-iconOffsetX, 0.02, 0]}
            fontSize={0.28}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.028}
            outlineColor="#000000"
            color={resolveAttackIconColor(unit)}
          >
            ⚔
          </Text>
          <Text
            position={[iconOffsetX, 0.02, 0]}
            fontSize={0.28}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.028}
            outlineColor="#000000"
            color={resolveMoveIconColor(unit)}
          >
            ⬢
          </Text>
        </>
      )}
      {!silhouette && showHealthBar && unit.count !== undefined && (
        <Text position={[0, -0.32, 0]} fontSize={0.18} color="#e2e8f0" anchorX="center" anchorY="middle" outlineWidth={0.018} outlineColor="#000000">
          {unit.count}
        </Text>
      )}
    </Billboard>
  )
}
