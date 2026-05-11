# CLAUDE.md — TACTICA

> Point d'entrée Claude Code. Lis ce fichier en premier à chaque session.
> Tout le reste est référencé depuis ici.

---

## 1. Projet

TACTICA = wargame hex tactique multi-joueur sur les batailles de France (Moyen Âge → 1ère GM).
Stack : Vite + React 18 + TS strict + Three.js (R3F + drei) + Tailwind + Radix + Supabase + Vitest + PWA.

Architecture 3 niveaux (`tactical | operational | strategic`) — en MVP seul `tactical` est implémenté.

## 2. Fichiers à charger selon la tâche

| Tâche | Fichiers à lire AVANT de coder |
|---|---|
| Toute tâche TACTICA | `docs/CLAUDE.md` (conventions strictes) |
| Vue d'ensemble phases | `PLAN-MASTER-V2.md` |
| Travail Phase 1 | `PLAN-PHASE-1-FIN-CLAUDE-CODE.md` (TASKs détaillées) |
| Modif d'un fichier existant | `docs/dependency-map.md` § 3 (impact dépendants) |
| Bug suspect d'être déjà vu | `docs/CLAUDE.md` § 11 (pièges connus) |
| Reprise de session | `docs/WIP.md` (dernière session en tête) |
| Backlog post-phase | `docs/BACKLOG.md` |

## 3. Règles critiques (non-négociables)

1. **Frontière modules** : `engine/` zéro Three/Supabase/React. `render/` zéro Supabase/hooks. `hooks/` zéro Three direct. Aucun cycle.
2. **Header versioning** : 4 entrées max, format `// vX.Ya (DD/MM/YYYY) — résumé ≤10 mots`. Le TAG `console.log('[Component vX.Y]', ...)` DOIT matcher la version courante.
3. **Hooks React** : ne jamais déplacer un hook existant. Tout nouveau hook s'ajoute EN QUEUE avant le return.
4. **Max 600 lignes par fichier**. Si on dépasse, extraire en hooks/composants séparés.
5. **TS strict** : pas de `any` sans commentaire justificatif.
6. **Try/catch + toast sonner** sur tout appel Supabase ou EF.
7. **RLS obligatoire** sur toute nouvelle table. `service_role` jamais côté client.
8. **Aucun hardcode** de valeurs de jeu : `SCALE_CONFIG`, table `units`, ou JSONB `state`.
9. **3D** : Z = hauteur (Fusion 360). Conversion Y↔Z UNIQUEMENT à la frontière `render/`. Pas dans l'API publique.
10. **Hex** : flat-top, coordonnées cubiques `{q,r,s | q+r+s=0}`. Voisins ordre fixe E,NE,NW,W,SW,SE.

## 4. Workflow multi-agent

Le travail Phase 1 fin est découpé en **TASKs atomiques** dans `PLAN-PHASE-1-FIN-CLAUDE-CODE.md`. Règles :

- Une TASK ne lit QUE ce qui est dans son `Fichiers IN`. Si manque → ajouter à IN ou créer dépendance.
- Une TASK livre EXACTEMENT les fichiers dans `Fichiers OUT`. Pas de fichiers bonus.
- Tasks parallélisables = aucune intersection sur OUT. Vérifier mécaniquement.
- Tasks dépendantes = orchestrer en série, A doit valider avant B.
- 3 vagues d'exécution prévues — voir § 0 du plan Phase 1.

### Pré-flight checklist avant edit

Avant chaque `str_replace` ou `create_file` :

1. ✅ Le fichier est-il dans le `OUT` de ma TASK courante ?
2. ✅ Ai-je lu ses dépendants dans `docs/dependency-map.md` § 3 ?
3. ✅ Le TAG `console.log` matche-t-il le header bumper ?
4. ✅ Aucun hook réordonné dans un .tsx existant ?
5. ✅ Max 600 lignes respecté ?

### Post-edit checklist

1. ✅ `npm run tsc` 0 erreur
2. ✅ `npm run test` vert (≥ 107 actuels)
3. ✅ `npm run build` PWA OK si la TASK touche le build
4. ✅ `console.log` debug retirés (garder uniquement TAG versionné)
5. ✅ Commentaires inline ≤ 1 ligne, format `// voir piège #N`

## 5. Format livraison à l'utilisateur

```
1. Diagnostic     : 1-2 lignes en français simple
2. Tu dois tester : 1 ligne par comportement concret visible à l'écran
3. Livrables      : zip via present_files, arborescence src/... correcte
4. Rien d'autre.
```

Pas de récap, pas de "leçons apprises", pas de bullet 10 points.

Exception : confiance < 95 % AVANT de coder → plan détaillé + questions autorisés.

## 6. Sources de vérité du code (par priorité)

1. Dernière version livrée dans la session courante (si modif déjà faite, prime sur tout).
2. Code dans le repo local côté utilisateur (pull GitHub à jour).
3. `/mnt/project/` (fallback).

Ne jamais demander un re-upload si le fichier est accessible via une de ces sources.

## 7. État courant (11/05/2026 — session 17)

- Phase 0 ✅ 13/13
- Phase 1 ✅ 13/13 — combat MVP tactique complet
- Phase 1.5 ✅ polish wounded + visuels asymétriques + toasts combat
- **Phase 2 ✅** refonte combat v2 livrée (sessions 15-16) :
  - Engine pur v2 + 205+ tests Vitest (24 fichiers verts)
  - Migrations 012/013/014 appliquées prod (vérif 10/05)
  - Engine-port Deno miroir complet, `resolve_action` refacturée en handlers
  - UI : UnitInspector v2, Tooltip v2 breakdown, ResultPanel v3 charge, Sidebar v1.1 effectifs
  - Render : UnitPlaceholder v2 + HealthBar v2 + DamageFloater 3D + skip Espace
  - Balance : plancher attrition × 0.08, nerf cav 1.1/0.9
  - Hotfix soft-lock routed (PR #27) — coup de grâce autorisé
  - Doc : `docs/COMBAT-V2.md`
- **Phase 2.5 🟡** moral / cohésion / soutien (en cours) — voir `docs/PLAN-MORAL-COHESION.md` :
  - États gradués Nominal/Ébranlé/Brisé, cohésion `0.5×moral + 0.3×effectif + 0.2×soutien`
  - Soutien rayon 1+2 (plafond 3), modale Ébranlé, panneau Retraite/Reddition/Suicide pour Brisé
  - Désertion retraite seuil 50% pertes, cohésion temps réel
  - Design figé via PRs #28-#31 ; **Vague A engine à attaquer** (~1 jour)
- Phase 3 ⬜ moteur de tour : brouillard évolué, détection, pré-postures
- Phase 4 ⬜ IA solo (déplacée de Phase 2 après refonte combat)
- Phase 5 ⬜ Profondeur tactique (formations, fatigue, ravitaillement, Infirmier, météo)
- Phases 6-15 ⬜

Prochaine action :
1. Vague A engine moral-cohésion : `engine/cohesion/*`, MAJ `morale.ts` v1.1, `contact.ts` v1.2 + tests.
2. Vagues B (EF), C (UI/Render), D (calibrage tests humain).
3. Test humain partie complète Phase 2 (split/merge/charge cav/coup de grâce routed) puis tag `phase-2-complete`.

Prochaine action :
1. Appliquer migrations 012/013/014 en prod via `mcp_supabase__apply_migration`.
2. `Supabase:get_advisors` → 0 warning critique.
3. Test humain 2 navigateurs (split + merge + charge cav + saturation terrain).
4. Polish Session 2.5 (animations) puis `npm run build` PWA + tag `phase-2-complete`.
