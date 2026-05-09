// v1.0 (08/05/2026) — Types pour SCALE_CONFIG
import type { Scale } from '@/types/game'

/**
 * Contraintes de la camera orbitale Three.js, par echelle.
 * Angles en radians, distances en unites monde Three.js.
 */
export interface CameraConstraints {
  /** Distance minimale de la cible (zoom in max) */
  readonly minDistance: number
  /** Distance maximale de la cible (zoom out max) */
  readonly maxDistance: number
  /** Angle polaire minimum : 0 = vue zenithale stricte */
  readonly minPolarAngle: number
  /** Angle polaire maximum : pi/2 = horizon. Doit etre < pi/2 pour eviter de passer sous le sol. */
  readonly maxPolarAngle: number
}

/**
 * Profil complet d'une echelle de jeu.
 */
export interface ScaleProfile {
  /** Taille d'un hex en unites monde Three.js. Constante 1.0 a toutes les echelles
   *  pour simplifier la camera : c'est la semantique metrique qui change. */
  readonly hexSize: number
  /** Combien de metres reels represente 1 hex. */
  readonly metersPerHex: number
  /** Combien de minutes reelles represente 1 tour de jeu. */
  readonly minutesPerTurn: number
  /** Contraintes camera par defaut pour cette echelle. */
  readonly camera: CameraConstraints
}

/**
 * Map readonly Scale → ScaleProfile.
 */
export type ScaleConfigMap = Readonly<Record<Scale, ScaleProfile>>
