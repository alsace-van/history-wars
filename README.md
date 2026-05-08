# TACTICA

Wargame hex tactique sur les batailles de France, du Moyen Age a la Premiere Guerre mondiale.

## Demarrage

```bash
npm install
npm run dev
```

Ouvre `http://localhost:5173`.

## Stack

- React 18 + TypeScript strict + Vite
- Three.js + @react-three/fiber + @react-three/drei
- Tailwind CSS + Radix UI
- Supabase (auth, BDD, Realtime, Edge Functions)

## Architecture 3 niveaux

Toute l'architecture est preparee pour 3 echelles : `tactical`, `operational`, `strategic`. En MVP (Phases 1-7), seul `tactical` est implemente. Les composants R3F et la logique de coordonnees sont parametres par echelle des Phase 0 pour ne pas avoir a refactoriser plus tard.

## Structure

```
src/
  engine/      Logique pure, pas de React
    hex/       Coordonnees cubiques, parametrees par hexSize
    scales/    Config par echelle (SCALE_CONFIG)
    ai/        Phase 2+
    combat/    Phase 1+
  render/      Composants R3F
    scenes/    TacticalScene, OperationalScene, StrategicScene
    shared/    HexGrid, HexTile, CameraController (parametres par scale)
    effects/   Phase 5-6
  ui/          Composants UI 2D
    pages/     Home, Login, Lobby, Game
    components/
    layout/
  hooks/       useAuth, useGames, useGameScale, useRealtime
  lib/         supabase client, validation env
  types/       database types generes
  styles/      design tokens
```

## Conventions code

Voir `docs/CLAUDE.md`.

## Phases

Voir le plan master du projet (hors repo).
