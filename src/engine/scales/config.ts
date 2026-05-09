// v1.0 (08/05/2026) — SCALE_CONFIG, source unique de verite pour les 3 echelles
import type { ScaleConfigMap } from './types'

const degToRad = (deg: number) => (deg * Math.PI) / 180

/**
 * Configuration des 3 echelles de jeu.
 *
 * - hexSize est volontairement constant a 1.0 : l'unite monde Three.js ne
 *   change pas entre les echelles, c'est la semantique metrique
 *   (metersPerHex) qui change. Simplifie le passage tactique↔operationnel
 *   en Phase 8.
 * - Les contraintes camera sont les valeurs par defaut, le CameraController
 *   du Lot 6 peut les surcharger temporairement (ex : cinematique fin de tour).
 *
 * En MVP (Phases 0-7) seule `tactical` est instanciee. `operational` et
 * `strategic` sont presents pour eviter la refonte en Phase 8-9.
 */
export const SCALE_CONFIG: ScaleConfigMap = {
  tactical: {
    hexSize: 1.0,
    metersPerHex: 10,
    minutesPerTurn: 1,
    camera: {
      minDistance: 3,
      maxDistance: 25,
      minPolarAngle: degToRad(15),  // pas vue plongee stricte
      maxPolarAngle: degToRad(80),  // pas sous l'horizon
    },
  },
  operational: {
    hexSize: 1.0,
    metersPerHex: 500,
    minutesPerTurn: 30,
    camera: {
      minDistance: 5,
      maxDistance: 50,
      minPolarAngle: degToRad(20),
      maxPolarAngle: degToRad(75),
    },
  },
  strategic: {
    hexSize: 1.0,
    metersPerHex: 5000,
    minutesPerTurn: 1440, // 24 h
    camera: {
      minDistance: 10,
      maxDistance: 200,
      minPolarAngle: degToRad(25),
      maxPolarAngle: degToRad(70),
    },
  },
}
