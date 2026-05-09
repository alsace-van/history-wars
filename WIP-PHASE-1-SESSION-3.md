# WIP — Phase 1 (handoff session 09/05/2026 #3)

## État global
Phase 0 ✅ — Phase 1 🟡 — sous-lot 1A ✅, 1B 3/4, 1C non démarré.

## Sous-lot 1A — Engine pur ✅ TERMINÉ
- L1A.1 ✅ `engine/units/` + `engine/morale/` (70 tests)
- L1A.2 ✅ `engine/movement/` (BFS + A*) + `engine/zoc/` (85 tests)
- L1A.3 ✅ `engine/los/` + `engine/combat/` (rng + melee + ranged + preview) — 107/107 tests verts

## Sous-lot 1B — BDD + Edge Functions 🟡 EN COURS
- L1B.1 ✅ Migration 007 + 008 appliquées sur Supabase prod (`abhbkdyoknrsdavimbpr`)
- L1B.2 ✅ `_shared/*` + EF `start_battle` déployée + testée OK
- **L1B.3 ✅ EF `resolve_action` cas `move`** (session courante)
  - Extension `_shared/engine-port/` avec `hex/`, `movement/`, `zoc/`
  - `_shared/types.ts` v1.1 : ajout `ActionType`, `MovePayload`, `MoveResult`, `ResolveActionBody`, ERROR_CODES étendus
  - `resolve_action/index.ts` v1.0 : dispatcher, idempotence D12, BFS reachable, snapshot D13, catch 23505 race
  - À déployer : `supabase functions deploy resolve_action`
- **L1B.4 ⬜ À FAIRE** :
  - EF `resolve_action` cas `attack_ranged` + `attack_melee` (étendre engine-port avec `los/`, `combat/`, `morale/`)
  - EF `resolve_turn(scale)` (bascule activeTeam, reset has_moved/has_attacked, récupération morale)

## Sous-lot 1C — UI tactique ⬜ PAS COMMENCÉ
- L1C.0 ⬜ maquette HTML HUD ordres
- L1C.1 ⬜ hook `useTacticalGame` + `UnitPlaceholder` v1.1 (lerp + onPointerDown + isSelected)
- L1C.2 ⬜ `DragPreview` + `HexGrid` v1.1 + `HexTile` v1.0d + `colors.ts` + `CombatPreviewBadge` + `CameraController` v1.1
- L1C.3 ⬜ `OrdersHud` + `UnitInspector` + `TurnIndicator` + `Game.tsx` v2.1 + `TacticalScene` v1.1

## Fichiers livrés cette session (L1B.3)
- `supabase/functions/_shared/types.ts` (v1.1)
- `supabase/functions/_shared/engine-port/hex/types.ts`
- `supabase/functions/_shared/engine-port/hex/coordinates.ts`
- `supabase/functions/_shared/engine-port/hex/distance.ts`
- `supabase/functions/_shared/engine-port/hex/neighbors.ts`
- `supabase/functions/_shared/engine-port/hex/key.ts`
- `supabase/functions/_shared/engine-port/hex/index.ts`
- `supabase/functions/_shared/engine-port/movement/range.ts`
- `supabase/functions/_shared/engine-port/movement/index.ts`
- `supabase/functions/_shared/engine-port/zoc/zoc.ts`
- `supabase/functions/_shared/engine-port/zoc/index.ts`
- `supabase/functions/resolve_action/index.ts` (v1.0)

## Décisions implémentées L1B.3
- **D12 Idempotence** : SELECT cached AVANT validation + catch 23505 sur INSERT race → retour cached
- **D13 Snapshot** : `result = { from, to, cost, snapshot: { unit_id, q, r, has_moved } }`
- **Piège #18 (race UNIQUE position)** : try/catch sur UPDATE units, code 23505 → `INVALID_MOVE` "case occupée"
- **Piège #19 (boardRadius)** : `cubeDistance(dest, origin) > boardRadius` → `OUT_OF_BOARD`

## ERROR_CODES ajoutés
`INVALID_PAYLOAD`, `GAME_NOT_FOUND`, `NOT_IN_GAME`, `NOT_IN_PROGRESS`, `NOT_ORDERS_PHASE`, `NOT_YOUR_TURN`, `NOT_IMPLEMENTED`, `UNIT_NOT_FOUND`, `UNIT_NOT_OWNED`, `UNIT_ROUTED`, `ALREADY_MOVED`, `ALREADY_ATTACKED`, `INVALID_MOVE`, `OUT_OF_BOARD`, `OUT_OF_RANGE`, `NO_LINE_OF_SIGHT`.

## Tests à valider (curl/dashboard, après déploiement EF)
1. **Move valide** (joueur actif, hex reachable) → 200, unit déplacée, `has_moved=true`, ligne `game_actions` insérée avec snapshot
2. **Move sur hex non reachable** (au-delà MP) → 400 `INVALID_MOVE`
3. **Move hors plateau** (distance > boardRadius) → 400 `OUT_OF_BOARD`
4. **Move sur sa propre position** → 400 `INVALID_MOVE`
5. **Move unité ennemie** → 403 `UNIT_NOT_OWNED`
6. **Move quand pas mon tour** → 403 `NOT_YOUR_TURN`
7. **Move unité has_moved=true** → 400 `ALREADY_MOVED`
8. **Double appel même `client_action_id`** → 200 idempotent (pas de double-mouvement)
9. **`attack_ranged` ou `attack_melee`** → 501 `NOT_IMPLEMENTED`
10. **POST sans JWT** → 401 `UNAUTHENTICATED`
11. **Game `status='lobby'`** → 400 `NOT_IN_PROGRESS`

## Commande de déploiement
```bash
supabase functions deploy resolve_action --project-ref abhbkdyoknrsdavimbpr
```

## Prochaine étape
**L1B.4** : EF `resolve_action` cas `attack_ranged` + `attack_melee` + EF `resolve_turn(scale)`.

À porter côté `engine-port/` :
- `hex/line.ts` (cubeLerp, cubeLineDraw) — pour LoS
- `los/los.ts` (hasLineOfSight)
- `combat/rng.ts` (Mulberry32)
- `combat/types.ts` (CombatModifiers, CombatResult)
- `combat/melee.ts` + `combat/ranged.ts`
- `morale/morale.ts` (applyMoraleDelta, isRouted, MORALE_ROUT_THRESHOLD)

## Commande pour relancer
> "On reprend Phase 1 L1B.4 — EF resolve_action ranged/melee + resolve_turn. Tu as le WIP-PHASE-1-SESSION-3.md et le PLAN-MASTER-CHECKLIST."
