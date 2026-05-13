# CLAUDE.md

A lire en debut de chaque session si la tache touche du code TACTICA.

## Source de verite

1. Derniere version livree dans la session en cours.
2. Fichiers du repo local (cloned).
3. GitHub si fallback necessaire.

## Stack

- React 18 + TypeScript strict (jamais `any` sans justification commentee) + Vite
- Three.js + @react-three/fiber + @react-three/drei
- @react-three/postprocessing pour effets (Phase 5-6)
- Tailwind CSS + Radix UI (Dialog, Dropdown, Tooltip)
- Supabase (auth, BDD, Realtime, Edge Functions)
- react-router-dom v6
- sonner (toasts)
- Zod pour la validation
- Vitest pour les tests
- vite-plugin-pwa + workbox-window (PWA, Lot 7)

## Architecture 3 niveaux (CRITIQUE)

3 echelles : `tactical` | `operational` | `strategic`. Definies dans `src/engine/scales/types.ts`.

Regles non negociables :
- Aucun composant R3F couple a une echelle. `<HexGrid>` ne sait pas s'il est tactique. Il prend sa config en props.
- Aucune valeur de jeu hardcodee : tailles d'hex, contraintes camera, time-per-turn passent par `SCALE_CONFIG`.
- Edge Function de resolution = `resolve_turn(game_id, scale)` parametree par echelle, pas une fonction par echelle.
- Etat JSONB structure : `state.tactical`, `state.operational`, `state.strategic`.
- En MVP (Phases 1-7) seul `tactical` est implemente. Les scenes `OperationalScene` et `StrategicScene` existent en placeholder.

## Conventions 3D

- Convention Z = hauteur (cohrerente avec Fusion 360 et VPB).
- Three.js utilise Y vertical par defaut : conversion uniquement a la frontiere du module render, pas dans l'API publique.
- Coordonnees hex : cubique pour la logique, flat-top pour le rendu.

## Conventions code

### Architecture
- Max 500-600 lignes par fichier, hooks separes pour alleger.
- TypeScript strict, pas de `any` sauf exception justifiee en commentaire.
- Try/catch + toast visible sur tout appel Supabase / API externe.
- Etats de chargement : tout fetch a un `loading` visible + fallback donnees vides.
- Pas de valeurs hardcodees (couleurs, textes, IDs) : constantes, theme Tailwind, ou `SCALE_CONFIG`.

### Versioning fichiers
- Header fichier = 4 entrees max (courante + 3 precedentes).
- Une ligne par entree : `// v1.3a (DD/MM/YYYY) — resume 10 mots max`.
- TAG `console.log` doit matcher la version du header.
- Version mineure = suffixe lettre (v2.0 -> v2.0a -> v2.0b).

### React hooks
- Ne JAMAIS deplacer un hook d'une position a une autre dans un composant existant.
- Tout nouveau hook s'ajoute EN QUEUE, avant le return.
- Test mental avant chaque edit `.tsx` : "est-ce que je change l'ordre des hooks existants ?" Si oui, STOP.

### BDD
- RLS activee sur TOUTE nouvelle table.
- Toutes les valeurs de jeu en JSONB ou tables, jamais hardcodees dans le moteur (preparation Phase 13 moddabilite).
- Verifier l'absence d'erreurs critiques via `Supabase:get_advisors` apres chaque migration.

### Securite
- `service_role` jamais cote client. Uniquement dans Edge Functions.
- Resolution de combat 100% serveur, jamais cote client.

### PWA (Lot 7)
- Plugin `vite-plugin-pwa` mode `generateSW` + `registerType: 'prompt'`.
- `<UpdatePrompt />` monte dans `App.tsx` apres `<Toaster />` (toast sonner "Recharger" sur nouvelle version).
- `devOptions.enabled: true, type: 'module'` (sinon `virtual:pwa-register/react` introuvable en dev).
- Supabase exclu du cache : `urlPattern: /\.supabase\.co\//, handler: 'NetworkOnly'` + `navigateFallbackDenylist: [/\.supabase\.co/]`.
- Icones `public/icons/icon-{192,512,512-maskable}.png`. Maskable padding 18% mini.
- Types : `/// <reference types="vite-plugin-pwa/react" />` dans `vite-env.d.ts`.

## Avant de coder

- Confiance < 95% : poser des questions, ne pas coder.
- Tache complexe : decouper en sous-taches numerotees.
- Reutiliser les hooks/composants/utils existants avant d'en creer de nouveaux.
- Verifier que chaque import utilise existe reellement.
- Pour une nouvelle table : verifier si une table existante couvre le besoin avant d'en creer une.
- Pour une nouvelle modale ou popup : maquette HTML d'abord, puis demander draggable / overlay / redimensionnable.

## Apres le code

- Relire, simuler mentalement chaque bouton et input.
- Supprimer les console.log de debug. Garder uniquement les logs versionnes avec le TAG.
- `npm run tsc` sur les fichiers modifies : 0 erreur obligatoire.
- Bug resolu absent de la liste des pieges : ajouter en format compact.
- WIP.md : ajouter entree de session en tete, 10 sessions max.

## Pieges connus

A enrichir au fil des phases.

1. Melanger les conventions de coordonnees hex (axial / offset / cubique). Tout passe par les fonctions de conversion centralisees dans `engine/hex/`.
2. Oublier la RLS sur une table. Verifier dans le dashboard Supabase apres chaque migration : icone cadenas visible.
3. Mettre des valeurs de jeu en dur dans le code. Tout passe par `SCALE_CONFIG` ou des tables BDD.
4. Hardcoder une taille d'hex dans `HexGrid` ou les fonctions de conversion. Ces fonctions DOIVENT accepter `hexSize` en parametre.
5. Confondre Y et Z dans Three.js. Conversion uniquement a la frontiere du module render.
6. Coupler un composant render a une echelle. `<TacticalScene>` peut connaitre sa scale, mais `<HexGrid>` non.
7. Creer une Edge Function `resolve_tactical_turn` au lieu de `resolve_turn(scale)`.
8. **RLS recursive entre 2 tables qui se referencent**. Cause : policy A fait `EXISTS (SELECT FROM B)`, policy B fait `EXISTS (SELECT FROM A)` -> Postgres detecte une recursion infinie. Vu sur `games` <-> `game_players` au Lot 4 (migration 003 puis 004). Fix : creer des fonctions `SECURITY DEFINER` qui contournent la RLS pour le check booleen, puis utiliser ces fonctions dans les policies. Pattern : `is_player_in_game(_game_id uuid)`, `is_game_host(_game_id uuid)`, etc. Toujours `revoke execute from public, anon` + `grant execute to authenticated`. Detection : erreur Postgres "infinite recursion detected in policy for relation".
9. **Policies legacy non supprimees lors d'une migration de fix RLS**. Postgres combine TOUTES les policies PERMISSIVE en OR : si on ecrit une nouvelle policy "propre" sans dropper les anciennes, les anciennes restent actives et peuvent re-introduire la recursion. Vu au Lot 4 (migration 005). Fix : toujours `DROP POLICY IF EXISTS` les anciennes par leur nom exact (verifier via `select policyname from pg_policies where tablename = '...'`).
10. **`registerType: 'prompt'` sans `<UpdatePrompt />` monte**. Cause : le SW est genere et installe, mais le composant qui ecoute `useRegisterSW` n'existe pas, donc l'utilisateur ne voit jamais le toast de mise a jour. Fix : monter `<UpdatePrompt />` dans `App.tsx` (apres `<Toaster />`). Detection : nouvelle version pushee, build, preview, aucun toast n'apparait. Vu Lot 7.
11. **`virtual:pwa-register/react` introuvable en dev** avec `devOptions.enabled: false`. Cause : le module virtuel n'est genere que si le plugin tourne en dev. Fix : `devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' }`. Le SW dev reste minimal, HMR fonctionne. Detection : erreur Vite "Failed to resolve import virtual:pwa-register/react". Vu Lot 7.
12. **Import manquant dans port Deno engine-port = crash silencieux EF** (zero log). Cause : si un EF importe un symbole depuis `supabase/functions/_shared/engine-port/X/index.ts` qui n'existe pas dans le port Deno (alors qu'il existe dans `src/engine/X/`), Deno crashe au boot avec ImportError AVANT meme de logger l'invocation. Cote client : "Failed to send a request to the Edge Function", aucun log cote EF dans `get_logs`. Fix : pour chaque ajout d'import nomme depuis engine-port, verifier que le symbole est explicitement exporte cote Deno. Pattern recurrent : `src/engine/X/neighbors.ts` exporte `neighbor`/`ring`/`spiral`, port Deno n'expose que `neighbors`. Vu session 21 (Phase 3.2) : `_evaluateOrders.ts` + `vision/visibility.ts` importaient `spiral` absent du port Deno → resolve_turn v7 down sans trace.
