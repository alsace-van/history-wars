// v1.2 (13/05/2026) — Phase 3.2 : exports neighbor, ring, spiral (utilises par vision/orders)
// v1.1 (09/05/2026) — Phase 1 L1B.4a : exports cubeRound, cubeLerp, cubeLineDraw
// v1.0 (09/05/2026) — Phase 1 L1B.3 : barrel hex Deno
export type { Cube, Axial } from './types.ts'
export { cube, cubesEqual, cubeRound } from './coordinates.ts'
export { cubeDistance } from './distance.ts'
export { HEX_DIRECTIONS, neighbor, neighbors, ring, spiral } from './neighbors.ts'
export { cubeKey, parseCubeKey } from './key.ts'
export { cubeLerp, cubeLineDraw } from './line.ts'
