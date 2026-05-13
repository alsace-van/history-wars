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

## 7. État courant (13/05/2026 — session 21 clôturée)

- Phase 0 ✅ 13/13
- Phase 1 ✅ 13/13 — combat MVP tactique complet
- Phase 1.5 ✅ polish wounded + visuels asymétriques + toasts combat
- **Phase 2 ✅** refonte combat v2 livrée (sessions 15-16)
- **Phase 2.5 ✅** moral / cohésion / soutien livrée prod (session 17)
- **Phase 2.6 ✅** engagement persistant livrée + testée humain (sessions 18-19). Tag `phase-2-complete`.
- **Phase 3.1 ✅** fog of war évolué livrée + testée humain (session 20). Tag `phase-3-1-complete`.
- **Phase 3.2 ✅** ordres conditionnels livrés + déployés (session 21). Migrations 019+020 prod. EF `submit_orders` v2, `resolve_turn` v9+. Test humain 5 scénarios = session 22.
- **Phase 3.2-bis ✅** (session 21) — Sprint UX + balance suite test humain :
  - **Engagement clarity** : `engagement_ticks` dans EndTurnResult → toasts "Combat continu (T+N)" + DamageFloaters tick + badge `⚔ T+N` sur EngagementOverlay + lerp 600ms UnitHealthBar.
  - **Routed décorrélé du moral** : `routed = effective < 20% effectiveMax` (`ROUT_EFFECTIVE_RATIO`). `applyMoraleDelta` + `isRouted` + sites de recompute mis à jour engine + Deno. Server handlers retreat/suicide/surrender acceptent désormais `routed OR cohesion broken`.
  - **Dominance asymétrique tick** : `dominance = damageNoFloor_A/B`. Côté gagnant prend `clamp(1/dominance, 0.25, 1)` × dégâts. Fatigue moral -2 → -1.
  - **Vision routed** : ennemi engagé en mêlée toujours `identified` (force depuis engagementRows). spiral(movement) inclus dans visibleTileKeys pour permettre repli.
  - **Sidebar refondue** : voyant lumineux (couleur active team), nom joueur fixé sur MON camp (couleur team), ligne par pion `[I.1 ⚔⬢ ████ 200/400]` clickable (recentre caméra), `ParticipantsPanel` collapsible (host = dot vert, moi = highlight ambre). GameTopBar nom officier coloré team.
  - **Helper `computeOrdinalLabels`** (`src/engine/units/labels.ts`) : `${kind}.${N}` par team+kind. Affiché au-dessus pion 3D + dans sidebar (cohérence).
  - **Icônes ordres** ⚔/⬢ : 3D au-dessus du pion (gauche/droite du label) + HTML inline sidebar. Helper colorimétrique partagé. Remplace section textuelle "Ordres disponibles".
  - **UnitStatusRing** : routed = orange clignotement lent (distinct broken rapide).
  - **Bug critique fixé** : `resolve_turn` v7 crashait au boot (import `spiral` manquant dans port Deno hex/index). Piège §12 à ajouter (imports manquants Deno = crash silencieux sans log EF).
- Phase 3.3 ⬜ polish / balance fin de Phase 3.
- Phase 4 ⬜ IA solo + fog server-side RLS (vue SQL filtrée units).
- Phase 5 ⬜ profondeur tactique (formations, fatigue/endurance dédiée, ravitaillement, Infirmier, météo).
- Phases 6-15 ⬜

Prochaine action session 22 :
- Test humain Phase 3.2 ordres conditionnels (5 scénarios : enemy_in_range+fire, on_attacked+retreat, cohesion_broken+hold, garde-fou 4ᵉ ordre, privacy RLS).
- Possible QW : Game.tsx ~640 lignes (un peu au-dessus 600), extraction supplémentaire.
- Possible Phase 3.3 (polish balance).

Feedback UX user sauvegardé en mémoire : `~/.claude/projects/.../memory/ux_tactica_lisibilite.md`
Vision long-terme campagne opérationnelle : `~/.claude/projects/.../memory/vision_operational_campaign.md`
