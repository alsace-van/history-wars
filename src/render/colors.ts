// v1.0 (09/05/2026) — Constantes couleur Three.js, synchro tokens Tailwind
// Tous les hex en notation 0xRRGGBB pour Three.js

export const COLORS = {
  // Equipes (synchro avec --tactica-blue / --tactica-red dans index.css)
  teamBlue: 0x185fa5,
  teamBlueBright: 0x378add,
  teamRed: 0xa32d2d,
  teamRedBright: 0xe24b4a,

  // Accent
  amber: 0xef9f27,

  // Hex tiles
  tileIdle: 0x1a2438,
  tileIdleEdge: 0x3a4a6e,
  tileHover: 0x2c3957,
  tileHoverEdge: 0xef9f27, // amber sur hover
  tileSelected: 0x3a4a6e,
  tileSelectedEdge: 0xef9f27,

  // Background scene
  sceneBg: 0x0f172a,
} as const
