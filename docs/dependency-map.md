# dependency-map.md — TACTICA

> Mise à jour : 10/05/2026 (clôture Phase 1 — L1A + L1B + L1C complets, migrations 007-010).
> Source : analyse statique automatique de `src/` (~85 fichiers, ~180 imports internes).
> Format : `cible <- dépendant`. Indique l'impact d'une modif sur la cible.

## ⚠ Nouveaux composants Phase 1 fin (session 12)

- `src/hooks/useTacticalSelection.ts` v1.1 — hook clé : selection + reachable + targetable + dangerousZocKeys + tileStates. Consommé par Game.tsx.
- `src/ui/game/BattleSidebar.tsx` v1.0 — panneau latéral en bataille (extrait de Game.tsx).
- `src/ui/game/GameHUD.tsx` v1.0 — bandeau bas Engager / Fin de tour / Quitter.
- `src/ui/game/EndGameModal.tsx` v1.0 — Radix Dialog victoire + stats `game_actions`.
- `src/ui/game/CombatPreviewTooltip.tsx` v1.0 — tooltip DOM ancré souris, `previewMelee/previewRanged`.
- `src/render/types.ts` v1.1 — `HexTileState` étendu avec `'dangerous'`.
- `src/render/colors.ts` v1.2 — clés `tileDangerous` + `tileDangerousEdge`.
- `src/render/hex/HexTile.tsx` v1.2 — case `'dangerous'` dans le switch.
- `src/render/units/UnitPlaceholder.tsx` v1.6 — glow naturel 3 halos additifs + breathing pulse.

---

## 1. Architecture en couches

```
┌────────────────────────────────────────────────────────────────────┐
│ src/lib/        env, supabase, cn, uuid                            │
│   ↑                                                                │
│ src/types/game.ts  (PIVOT : 18 dépendants — le plus partagé)       │
│   ↑                                                                │
│ src/engine/     hex, scales, units, movement, zoc, los, morale,    │
│                 combat (PUR : zéro Three, zéro Supabase, zéro UI)  │
│   ↑                                                                │
│ src/render/     hex, units, scenes, camera, lighting, _data        │
│                 (Three.js + drei, importe engine + types, jamais   │
│                  hooks ni ui)                                      │
│   ↑                                                                │
│ src/hooks/      useAuth, useGames, useGame, useRealtime,           │
│                 useBattleUnits, useCombatActions, useGameRealtime  │
│                 (Supabase + React, importe types + lib)            │
│   ↑                                                                │
│ src/ui/         components, pages, lobby, game, layout, auth       │
│                 (importe tout le reste via barrels)                │
│   ↑                                                                │
│ src/App.tsx → src/main.tsx                                         │
└────────────────────────────────────────────────────────────────────┘
```

**Règle inviolable** (skill `tactica` § 3) : pas d'import de `ui/` ou `hooks/` dans `engine/` ou `render/`. Aucun cycle.

---

## 2. Top fichiers les plus importés (impact analysis)

| Cible | # importeurs | Risque modif |
|---|---|---|
| `src/types/game.ts` | 18 | 🔴 critique — toucher = build cassé partout |
| `src/engine/hex` (barrel) | 12 | 🔴 critique — engine + render + EFs (port) |
| `src/lib/cn` | 9 | 🟡 modéré — utilitaire UI partagé |
| `src/render/types` | 8 | 🟡 modéré — types render |
| `src/lib/supabase` | 7 | 🟡 modéré — singleton client |
| `src/engine/units/types` | 7 | 🟡 modéré — UnitState |
| `src/engine/hex/types` | 6 | 🟡 modéré — Cube, Axial |
| `src/hooks/useRealtime` | 4 | 🟢 limité |
| `src/engine/combat/types` | 4 | 🟢 limité |
| `src/engine/units/stats` | 4 | 🟢 limité |
| `src/engine/morale/morale` | 4 | 🟢 limité |
| `src/render/colors` | 4 | 🟢 limité |

---

## 3. Dépendants des fichiers touchés en Phase 1 fin

À consulter AVANT de modifier un fichier ci-dessous : tous les dépendants sont à re-vérifier après modif.

### `src/ui/pages/Game.tsx` (568 lignes, refactor à venir)
```
<- src/App.tsx (router)
```
Aucun composant n'en dépend en lecture (page leaf). Refactor sécurisé tant que les imports nommés depuis `App.tsx` restent stables (`Game`).

### `src/render/units/UnitPlaceholder.tsx` (cible FIX-01 si option B)
```
<- src/render/index.ts (barrel)
<- src/render/scenes/TacticalScene.tsx
```
Modif sûre : le barrel ré-exporte, TacticalScene importe direct.

### `src/render/hex/HexTile.tsx` (cible L1C4-04 : ajout state `dangerous`)
```
<- src/render/hex/HexGrid.tsx
<- src/render/index.ts
```

### `src/render/colors.ts` (cible L1C4-04 : ajout couleurs ZoC)
```
<- src/render/hex/HexTile.tsx
<- src/render/units/SoldierMesh.tsx
<- src/render/units/UnitPlaceholder.tsx
<- src/render/index.ts
```
Ajouter des clés est sûr (additif). Renommer/supprimer = casse plusieurs fichiers.

### `src/render/types.ts` (cible L1C4-04 : ajout `'dangerous'` au type union)
```
<- src/render/_data/mvpUnitPlacement.ts
<- src/render/_data/unitAdapter.ts
<- src/render/hex/HexGrid.tsx
<- src/render/hex/HexTile.tsx
<- src/render/scenes/TacticalScene.tsx
<- src/render/units/UnitPlaceholder.tsx
<- src/render/index.ts
<- src/ui/pages/Game.tsx
```
Le type `HexTileState` est utilisé partout. Ajout d'un membre = OK (tous switch/case doivent gérer le nouveau cas, le compilo TS strict le détectera).

### `src/render/scenes/TacticalScene.tsx` (cible L1C4-03 : ajout callback hover screen)
```
<- src/render/index.ts
```
1 dépendant via barrel. Ajout de prop optionnelle = compatible.

### `src/hooks/useCombatActions.ts` (utilisé par L1C5-03 pour endTurn)
```
<- src/ui/pages/Game.tsx
```

### `src/hooks/useBattleUnits.ts`
```
<- src/ui/pages/Game.tsx
```

### `src/hooks/useGameRealtime.ts` ⚠️
```
(aucun dépendant interne)
```
Hook créé en L1C.1 mais **non câblé** dans Game.tsx (qui utilise `useRealtime` direct). Dette technique — décision Phase 2 : brancher proprement OU supprimer (cf BACKLOG).

### `src/hooks/useTacticalSelection.ts` (NEW Phase 1 fin)
```
<- src/ui/pages/Game.tsx
```
Hook pivot tactique : centralise selection/reachable/targetable/dangerousZocKeys/tileStates/exhaustedUnitIds/handleUnitClick. Consommé uniquement par Game.tsx. Toute évolution (Phase 3 fatigue, Phase 4 fog of war) passera par ce hook plutôt que de remettre la logique inline.

### `src/engine/combat/preview.ts` (utilisé par L1C4-01)
```
<- src/engine/combat/index.ts (barrel)
```
Importé via `@engine/combat` dans le futur `CombatPreviewTooltip.tsx`.

### `src/engine/units/stats.ts` (cible L1C4-02 pour calcul targetable)
```
<- src/engine/combat/melee.ts
<- src/engine/combat/preview.ts
<- src/engine/combat/ranged.ts
<- src/engine/units/index.ts
```

### `src/engine/zoc/zoc.ts` (cible L1C4-02 pour `dangerousZocKeys`)
```
<- src/engine/zoc/index.ts (barrel)
```

### `src/engine/los/los.ts` (cible L1C4-02 pour LoS check targetable)
```
<- src/engine/los/index.ts (barrel)
```

### `src/engine/movement/range.ts` & `path.ts`
```
<- src/engine/movement/index.ts (barrel)
```

---

## 4. Nouveaux fichiers Phase 1 fin — graphe d'import prévu

```
src/ui/game/BattleSidebar.tsx          [P1-REFACTOR-01]
  → src/ui/game/UnitInspector.tsx
  → src/ui/game/TeamPanel.tsx
  → src/types/game.ts
  → src/engine/units/index.ts (UnitState)
  ← src/ui/pages/Game.tsx

src/ui/game/GameHUD.tsx                [P1-L1C5-01]
  → src/lib/cn.ts
  → src/types/game.ts
  ← src/ui/pages/Game.tsx

src/ui/game/EndGameModal.tsx           [P1-L1C5-02]
  → @radix-ui/react-dialog
  → src/lib/supabase.ts (fetch game_actions)
  → src/types/game.ts
  → src/lib/cn.ts
  ← src/ui/pages/Game.tsx

src/ui/game/CombatPreviewTooltip.tsx   [P1-L1C4-01]
  → src/engine/combat/preview.ts (previewMelee, previewRanged)
  → src/engine/combat/types.ts (CombatModifiers)
  → src/engine/units/types.ts (UnitState)
  → src/engine/units/stats.ts (getUnitStats)
  → src/engine/morale/morale.ts (moraleCombatBonus)
  → src/lib/cn.ts
  ← src/ui/pages/Game.tsx

src/hooks/useTacticalSelection.ts      [P1-REFACTOR-02]
  → src/engine/units/index.ts
  → src/engine/movement/index.ts (bfsReachable)
  → src/engine/zoc/index.ts (computeEnemyZoc)
  → src/engine/los/index.ts (hasLineOfSight)
  → src/engine/combat/index.ts (previewMelee/Ranged optionnel)
  → src/engine/hex/index.ts (cubeKey, cubeDistance)
  → src/render/types.ts (HexTileState)
  → src/types/game.ts (Team)
  ← src/ui/pages/Game.tsx
```

### Diagramme global Phase 1 fin

```
                ┌────────────────────────┐
                │   src/engine/* (pur)   │
                └──────────┬─────────────┘
                           │
              ┌────────────┴────────────┐
              ↓                         ↓
   useTacticalSelection.ts      CombatPreviewTooltip.tsx
   (REFACTOR-02)                (L1C4-01)
              │                         │
              └─────────┬───────────────┘
                        ↓
               ┌────────────────┐
               │  Game.tsx v3.6 │ ← BattleSidebar (REFACTOR-01)
               │  (L1C4-03 +    │ ← GameHUD (L1C5-01)
               │   L1C5-03)     │ ← EndGameModal (L1C5-02)
               └────────────────┘
                        ↑
                   src/App.tsx
```

---

## 5. Vérifications d'intégrité

Toutes vérifiées sur le code actuel (10/05/2026) :

- ✅ `engine/` n'importe rien depuis `render/`, `hooks/`, `ui/`. Pur.
- ✅ `render/` importe depuis `engine/`, `types/`. Aucun import `hooks/` ou `ui/`.
- ✅ `hooks/` importe depuis `lib/`, `types/`. Pas de Three direct.
- ✅ `ui/` importe librement (couche du dessus).
- ✅ Aucun cycle détecté.
- ⚠️ `src/hooks/useGameRealtime.ts` : 0 dépendant — à brancher ou supprimer (REFACTOR-02 décidera).

### Frontières inter-couches en chiffres

| Direction | Comptage |
|---|---|
| ui → render | 4 imports |
| ui → hooks | 11 imports |
| ui → engine | 8 imports (via barrels) |
| ui → types | 13 imports |
| render → engine | 9 imports |
| render → types | 4 imports |
| hooks → lib | 6 imports |
| engine → engine (intra) | 22 imports |

Aucun import descendant (ui → render → engine seulement). Conforme à la règle skill § 3.

---

## 6. Convention pour les futures MAJ

Après chaque TASK qui ajoute un fichier ou modifie un import, ajouter au § 3 ou § 4 selon le cas. Les sections 1, 2, 5 sont régénérées automatiquement via le script Python (à industrialiser Phase 6 si utile).

Les sub-agents Claude Code DOIVENT consulter ce fichier avant de modifier `Game.tsx`, `types/game.ts`, ou n'importe quel barrel `index.ts`.
