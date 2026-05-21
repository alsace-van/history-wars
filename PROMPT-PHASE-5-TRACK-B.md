# PROMPT — Track B : Multi-Hex Foundation (TACTICA Phase 5 Lot 5.6)

> À coller dans une **nouvelle session Claude Code** ouverte sur le même repo TACTICA.
> Cette session travaille en parallèle d'une autre (Track A — Map/Terrain).
> Ce prompt est **autonome** : la nouvelle session n'a aucun contexte des précédentes conversations.

---

## Mission

Tu reprends le développement de **TACTICA** (wargame hex tactique multi-joueur, React 18 + TS strict + Three.js R3F + Supabase + Vitest + PWA). La Phase 5 du projet est lancée et découpée en 7 lots. **Tu prends en charge le Lot 5.6 (multi-hex units)** en parallèle d'une autre session qui s'occupe des Lots 5.0 à 5.5 (terrain/map).

Ton objectif Track B = introduire le concept "1 unité = N hex contigus" sans casser le gameplay 1-hex existant.

## Lectures obligatoires AVANT toute action

Lis ces fichiers dans cet ordre :

1. `/Users/stephanekapp/Desktop/history wars/tactica/CLAUDE.md` — point d'entrée racine, règles non-négociables
2. `/Users/stephanekapp/Desktop/history wars/tactica/docs/CLAUDE.md` — conventions strictes (header versioning, hooks, frontières modules)
3. `/Users/stephanekapp/Desktop/history wars/tactica/AUDIT-PHASE-5.md` — audit factuel du code Phase 5, sections 1.1 (UnitState), 1.5 (render), 3.3 (refonte transversale multi-hex), 6.2 (décision BDD unit_positions)
4. `/Users/stephanekapp/Desktop/history wars/tactica/PLAN-PHASE-5.md` — **focus sur § 7 (Lot 5.6)**, tâches 5.6.1 à 5.6.9
5. `/Users/stephanekapp/Desktop/history wars/tactica/docs/dependency-map.md` § 12 "modifier X, vérifier Y"

## Branche git

Avant ta première modification :

```bash
cd "/Users/stephanekapp/Desktop/history wars/tactica"
git checkout main
git pull
git checkout -b phase-5-track-b-multihex
```

Tu ne pushes pas sur `main` directement. Tu commits régulièrement sur `phase-5-track-b-multihex`. PR finale ouverte par l'utilisateur.

## Périmètre Track B — ce que tu livres dans cet ordre

| # | Tâche | Effort | Bloquant pour la suivante ? |
|---|---|---|---|
| **5.6.1** | Migration 042 `unit_positions` | 1h | Oui |
| **5.6.2** | UnitState refonte (`positions: ReadonlyArray<{cube, effectiveShare}>`) | 2h | Oui |
| **5.6.3** | ZdC sommée (engine/zoc/zoc.ts) | 1h | Non |
| **5.6.6** | Render multi-hex (UnitFigurines, UnitLabel) | 3h | Non |
| **5.6.7** | Sélection multi-hex (useTacticalSelection) | 1h | Non |

Puis tu **STOPPES** et tu attends. NE COMMENCE PAS les tâches 5.6.4, 5.6.5, 5.6.8, 5.6.9.

## Périmètre EXCLU — fichiers interdits

Ces fichiers sont en train d'être modifiés par Track A. **N'y touche pas** :

- `src/engine/movement/path.ts`
- `src/engine/movement/range.ts`
- `src/engine/combat/v2/contact.ts`
- `src/engine/combat/v2/charge.ts`, `engagement.ts`, `melee.ts`, `ranged.ts` (toute la sous-arbo `v2/`)
- `src/engine/sim/applyAction.ts`
- `src/engine/los/has-line-of-sight.ts`
- `src/engine/terrain/**`
- `supabase/functions/resolve_action/**`
- `supabase/functions/_shared/engine-port/**` (mirror engine côté Deno)
- `supabase/functions/start_battle/**`
- Toute migration ≥ 035 (terrain), ≤ 041 (déploiement/bâtiments) — réservées à Track A

Si tu as besoin de lire un de ces fichiers (pour comprendre des types ou contrats), c'est OK. Tu lis, tu ne modifies pas.

## Concept multi-hex — vision figée

Actuellement : 1 unité TACTICA = 1 pion abstrait sur 1 hex, représentant 800-1200 hommes.

Nouveau paradigme Phase 5 :
- 1 unité = N hex contigus
- L'effectif total est réparti entre les hex (`effectiveShare`)
- N dépend de l'effectif total et de la densité réaliste

Calculs de densité (hex flat-top, formule aire = 3√3/2 × c²) :

| Côté hex | Aire | Inf 3 rangs serrés | Inf colonne aérée | Cavalerie |
|---|---|---|---|---|
| **50 m** | ~6 500 m² | ~3 000 h | ~1 500 h | ~600 cav |
| **100 m** | ~26 000 m² | ~10 000 h irréaliste | ~5 000 h | ~2 000 cav |

À 50 m/hex (cible MVP Phase 5) :
- Bataillon 800h → 1 hex (en ligne 3 rangs)
- Régiment 2 400h → 2-4 hex
- Brigade 5 000h → 5-8 hex
- 1 batterie 6 pièces → 1 hex
- Escadron 120 cav → 1 hex

**Phase 5 Lot 5.6** introduit juste le concept multi-hex (forme libre, contiguë).
**Phase 6 future** introduira les formations typées (carré, ligne, colonne, tirailleurs) avec leurs bonus/malus.

## Décisions architecturales actées (figées dans AUDIT-PHASE-5.md § 6)

1. **BDD** : table `unit_positions(unit_id uuid, q int, r int, effective_share int)` avec PK composite `(unit_id, q, r)`. Backfill : pour chaque unité existante, insérer 1 row avec `effective_share = effective` (toute la unité sur 1 hex au départ).

2. **UnitState (engine)** : remplacer `position: Cube` par `positions: ReadonlyArray<{ cube: Cube; effectiveShare: number }>`. Helper `mainPosition(unit)` retourne le centroïde ou le 1er hex pour compat MVP.

3. **Règle contiguïté** : tous les hex de `positions` doivent former une zone connexe (BFS de validation). À enforcer dans validateur engine, pas BDD (contrainte SQL trop complexe).

4. **ZdC** : union des voisins de **chaque** hex de l'unité (moins les hex de l'unité elle-même). Implication : unité 3-hex en ligne projette ZdC sur ~7 hex au lieu de 6.

5. **Render** : N figurines (1 par hex), 1 seul UnitLabel sur l'hex "principal" (centroïde arrondi au cube le plus proche), 1 seule UnitHealthBar.

6. **Sélection** : click sur n'importe quel hex d'une unité → sélectionne l'unité entière. Ring de sélection autour des N hex (calcul outline du contour).

7. **Compat MVP** : unités créées avant la migration 042 sont 1-hex. Le système doit gérer mixte 1-hex et multi-hex sans branchement conditionnel partout. Idéalement, le code traite tout le monde comme multi-hex avec N=1.

## Conventions strictes (cf. `docs/CLAUDE.md`)

1. **Header versioning** sur tout fichier .ts/.tsx créé ou modifié :
   ```ts
   // v1.0 (DD/MM/YYYY) — création multi-hex types
   // v1.1 (DD/MM/YYYY) — ajout helper centroid
   // ...max 4 entrées
   ```
   Le `console.log('[ComponentName v1.1]', ...)` doit matcher la version courante du header.

2. **Hooks React** : ajout en queue, jamais déplacer un hook existant.

3. **Max 600 lignes** par fichier. Si tu dépasses, extraire en sous-modules.

4. **TS strict** : pas de `any` sans commentaire justificatif.

5. **Try/catch + toast sonner** sur tout appel Supabase ou EF.

6. **RLS obligatoire** sur la nouvelle table `unit_positions`. SELECT cohérent avec `units` (membres du game + spectateurs avec respect fog of war).

7. **Tests Vitest** : ajouter ≥ 20 tests sur Lot 5.6 (positions, ZdC, sélection, contiguïté). Cible projet : 401+ tests verts à la fin de Track B (vs 381 actuels).

## Approche recommandée

### Étape 1 (TASK 5.6.1) — Migration 042

Écrire `supabase/migrations/042_unit_multi_hex.sql` :

```sql
-- Multi-hex unit positions
CREATE TABLE IF NOT EXISTS public.unit_positions (
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  q int NOT NULL,
  r int NOT NULL,
  effective_share int NOT NULL CHECK (effective_share >= 0),
  PRIMARY KEY (unit_id, q, r)
);

CREATE INDEX IF NOT EXISTS idx_unit_positions_qr
  ON public.unit_positions (q, r);

-- Backfill : 1 row par unit existante avec effective complet
INSERT INTO public.unit_positions (unit_id, q, r, effective_share)
SELECT u.id, u.position_q, u.position_r, u.effective
FROM public.units u
WHERE NOT EXISTS (
  SELECT 1 FROM public.unit_positions p WHERE p.unit_id = u.id
);

-- RLS
ALTER TABLE public.unit_positions ENABLE ROW LEVEL SECURITY;

-- SELECT : cohérent avec units
CREATE POLICY unit_positions_select
  ON public.unit_positions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = unit_positions.unit_id
      -- la RLS de units (fog server-side migration 024) sera appliquée en cascade
    )
  );

-- INSERT/UPDATE/DELETE : service_role only (jamais client direct)
-- Pas de policy = bloqué par défaut

ALTER TABLE public.unit_positions REPLICA IDENTITY FULL;
```

Applique via `mcp__46662ac2-a2f2-4569-961c-c50a9df36fa1__apply_migration` puis check `get_advisors`.

### Étape 2 (TASK 5.6.2) — UnitState refonte

Étendre `src/engine/units/types.ts` :

```ts
// v1.X (DD/MM/YYYY) — multi-hex positions array
export interface UnitHexPosition {
  readonly cube: Cube;
  readonly effectiveShare: number;
}

export interface UnitState {
  // ... champs existants
  readonly position: Cube;                                          // DEPRECATED, conserve compat MVP
  readonly positions: ReadonlyArray<UnitHexPosition>;               // NEW
  // ...
}
```

Créer `src/engine/units/positions.ts` (NEW) avec helpers :
- `mainPosition(unit): Cube` — retourne `unit.positions[0]?.cube ?? unit.position`
- `allCubes(unit): Cube[]` — retourne tous les hex de l'unité
- `centroid(unit): Cube` — centroïde arrondi au cube le plus proche (utiliser `cubeRound`)
- `isContiguous(positions): boolean` — BFS de validation
- `totalEffective(unit): number` — somme `effectiveShare`

Mettre à jour `src/lib/unitAdapter.ts` pour mapper `unit_positions` BDD → `UnitState.positions`.

Tests dans `src/engine/units/__tests__/positions.test.ts`.

### Étape 3 (TASK 5.6.3) — ZdC sommée

Refactor `src/engine/zoc/zoc.ts` :
- `getZocFor(units, team)` → boucler sur toutes les units, pour chaque unité, boucler sur tous ses `positions`, pour chaque hex, lister les voisins
- Retirer les hex de l'unité elle-même du set ZdC (pas d'auto-ZdC)
- Set final = union ZdC de toutes les unités de la team

Tests : unité 3-hex en ligne projette ZdC sur 7 hex (3 + 4 voisins extérieurs).

### Étape 4 (TASK 5.6.6) — Render multi-hex

Créer `src/render/units/UnitFigurines.tsx` (NEW) :
- Pour chaque `position` de l'unité, place une figurine GLB (soldier.glb actuel)
- Animation lerp : toutes les figurines lerp en cohérence quand l'unité bouge

Refactor `src/render/units/UnitPlaceholder.tsx` :
- Si `unit.positions.length === 1` → comportement actuel
- Sinon → délègue à `UnitFigurines`

Adapter `UnitHealthBar.tsx` : positionner sur centroïde (utiliser helper `centroid` engine).

Créer `src/render/units/UnitLabel.tsx` (NEW) : 1 label central pour le groupe (kind, effectif total).

### Étape 5 (TASK 5.6.7) — Sélection multi-hex

Refactor `src/hooks/useTacticalSelection.ts` :
- `selectedUnitId` reste l'identifiant unité
- `selectedHexes` (NEW) = tous les hex de l'unité sélectionnée
- Ring de sélection autour de chaque hex de l'unité (ou contour calculé en option, mais MVP = ring par hex)
- Click sur hex membre d'une unité → selectUnit, peu importe lequel

Tests : click sur n'importe quel hex d'une unité 3-hex → unité entière sélectionnée.

## Critères fin de Track B

- [ ] Migration 042 appliquée prod, `get_advisors` clean
- [ ] `npm run tsc` 0 erreur
- [ ] `npm run test` 401+ verts (vs 381 baseline)
- [ ] Branch `phase-5-track-b-multihex` commitée
- [ ] Aucune régression visible sur partie 1-hex existante (test manuel : créer game, observer comportement standard)
- [ ] Backfill BDD vérifié : `SELECT COUNT(*) FROM unit_positions WHERE unit_id IN (SELECT id FROM units)` = nombre d'units (1 row par unité)
- [ ] WIP.md mis à jour (session dédiée Track B)
- [ ] Branch poussée, prête pour PR review

## Point de synchro avec Track A

Après tes 5 tâches : STOP. Attends que Track A finisse les Lots 5.2 (engine terrain) et 5.5 (bâtiments), puis tu reprends sur les TASK 5.6.4, 5.6.5, 5.6.8, 5.6.9 quand la branche `main` aura intégré le travail Track A. Tu rebase ta branche sur main et tu finis la phase.

## Format de livraison (cf. CLAUDE.md racine § 5)

```
1. Diagnostic     : 1-2 lignes en français simple
2. Tu dois tester : 1 ligne par comportement concret visible à l'écran
3. Livrables      : arborescence src/... correcte + chemin des fichiers livrés
4. Rien d'autre.
```

Pas de récap, pas de leçons apprises, pas de bullet 10 points.

## Stack technique pertinent

- Vite + React 18 + TS strict
- Three.js + @react-three/fiber + @react-three/drei
- Tailwind + Radix
- Supabase (PostgreSQL + Realtime + Edge Functions Deno)
- Vitest pour tests
- Hex flat-top, coords cubiques `{q, r, s | q+r+s=0}`
- Convention 3D : Z = hauteur (Fusion 360), conversion Y↔Z UNIQUEMENT à la frontière `render/`

## Sources de vérité

1. Code dans le repo local `/Users/stephanekapp/Desktop/history wars/tactica/`
2. `CLAUDE.md` racine + `docs/CLAUDE.md` pour les règles
3. `AUDIT-PHASE-5.md` + `PLAN-PHASE-5.md` pour les décisions

## Démarrage

Commence par lire les 5 docs (§ "Lectures obligatoires"), puis fais `git checkout -b phase-5-track-b-multihex`, puis attaque TASK 5.6.1.

Bon code.
