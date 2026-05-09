// v1.0 (08/05/2026) — Types Cube et Axial pour les coordonnees hex

/**
 * Coordonnees cubiques. Invariant strict : q + r + s === 0.
 * Toujours readonly : un Cube est une valeur, pas un etat mutable.
 */
export interface Cube {
  readonly q: number
  readonly r: number
  readonly s: number
}

/**
 * Coordonnees axiales (cube sans s). Utiles pour la BDD : 2 colonnes au lieu de 3.
 * Conversion triviale via cubeToAxial / axialToCube.
 */
export interface Axial {
  readonly q: number
  readonly r: number
}
