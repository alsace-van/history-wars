// v1.2 (10/05/2026) — P1-L1C4-04 : ajout tileDangerous/Edge (orange-warning, ZoC ennemie)
// v1.1 (09/05/2026) — L1C.3 : ajout tileReachable/Edge (cyan) + tileTargetable/Edge (rouge) + unitSelectedRing (amber)
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
  // L1C.3 : reachable = cyan amorti
  tileReachable: 0x1f4a5a,
  tileReachableEdge: 0x4ec0e8,
  // L1C.4 : targetable = rouge amorti (preparation, utilise au prochain lot)
  tileTargetable: 0x5a1f1f,
  tileTargetableEdge: 0xff6b6b,
  // L1C.4 : dangerous = orange amorti (ZoC ennemie, traversee couteuse)
  tileDangerous: 0x5a3514,
  tileDangerousEdge: 0xfb923c,
  // Phase 2 2D.6 : split-target = ambre lumineux (case adjacente libre pour scinder une unite)
  tileSplitTarget: 0x4a3a14,
  tileSplitTargetEdge: 0xfacc15,

  // Unit highlights
  unitSelectedRing: 0xef9f27, // amber autour cylindre selectionne
  unitTargetableHalo: 0xff6b6b, // halo rouge si cible (L1C.4)

  // Background scene
  sceneBg: 0x0f172a,
} as const
