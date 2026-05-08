# WIP.md

Journal des sessions de developpement, plus recente en haut. Maximum 10 entrees, on tronque en bas.

---

## Session 2 &mdash; 08/05/2026 &mdash; Phase 0 Lot 2

**Fait** :
- Migration BDD `001_foundations` appliquee : tables `profiles`, `games`, `game_players` avec RLS active sur les 3.
- Trigger `handle_new_user` cree le profil automatiquement au signup, derive le pseudo depuis `raw_user_meta_data.username` (avec fallback email).
- Migration `002_secure_handle_new_user` : revoke EXECUTE pour anon/authenticated/public sur la fonction (advisor security WARN resolu).
- 0 lint security restant.
- Nouvelles deps installees (a faire `npm install` cote utilisateur) : `@radix-ui/react-slot`, `@radix-ui/react-label`, `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`, `tailwindcss-animate`.
- Tailwind config etendue avec systeme shadcn (CSS variables HSL : `--background`, `--foreground`, `--primary`, etc.) en plus des tokens custom TACTICA.
- `src/index.css` avec definitions CSS variables dark mode.
- Composants atomes ajoutes :
  - `src/ui/components/Label.tsx` (Radix Label)
  - `src/ui/components/Input.tsx`
  - `src/ui/components/Button.tsx` (variants : default, outline, ghost, link, destructive)
  - `src/ui/components/PasswordInput.tsx` (toggle eye/eye-off)
  - `src/ui/components/Typewriter.tsx` (effet machine a ecrire)
- `src/ui/auth/AuthBackground.tsx` : illustration SVG champ de bataille (silhouettes + grille hex). Placeholder, remplaceable par image historique plus tard.
- `src/ui/pages/Auth.tsx` : page split-screen complete avec 4 modes via query param `?mode=signin|signup|reset|update-password`. Toggle in-place, transition `animate-slide-up`.
- `src/ui/pages/Home.tsx` : page d'accueil placeholder protegee, charge le pseudo depuis `profiles`, bouton de deconnexion.
- `src/hooks/useAuth.ts` : session + signUp + signIn + signOut + resetPassword + updatePassword.
- `src/hooks/useRequireAuth.ts` : redirige vers `/auth?mode=signin` si pas connecte.
- `src/lib/cn.ts` : utilitaire clsx + tailwind-merge.
- `src/App.tsx` : router avec routes `/` (Home, protegee), `/auth` (Auth), fallback redirect `/`.

**A faire cote utilisateur** :
- `npm install` (nouvelles deps).
- Configurer Supabase Auth :
  - Dashboard > Authentication > URL Configuration.
  - Site URL : `http://localhost:5173`.
  - Ajouter `http://localhost:5173/**` dans Redirect URLs (necessaire pour reset password).
- `npm run dev`.
- Tester :
  1. Aller sur `http://localhost:5173` -> redirection vers `/auth?mode=signin`.
  2. Cliquer "Creer un compte" -> URL devient `?mode=signup`, formulaire bascule.
  3. Creer un compte avec email + pseudo + password.
  4. Verifier dans Supabase Dashboard > Table Editor que le profil est cree dans `profiles`.
  5. Confirmer l'email (clic sur lien dans la boite mail).
  6. Se connecter -> redirection vers `/` qui affiche "Bienvenue, [pseudo]".
  7. Se deconnecter -> redirection vers `/auth`.
  8. Tester "Mot de passe oublie" (necessite que le Site URL soit configure).
- `npm run tsc` doit passer 0 erreur.
- Premier commit Lot 2 sur GitHub.

**Decisions** :
- Pas de toast UI (sonner) pour le Lot 2, messages d'erreur in-form. Sera reconsidere Lot 3 si besoin.
- Pas de protection des routes via composant `<ProtectedRoute>` mais via hook `useRequireAuth` dans la page elle-meme. Plus simple, pas besoin de composant wrapper.
- Tailwind config etendue (pas remplacee) : on garde les tokens TACTICA existants en plus des variables shadcn pour les composants atomes.
- Citations historiques verifiees, pas inventees : Napoleon (signin, reset), Sun Tzu (signup), Clausewitz (update-password).

**Prochain Lot** :
- Lot 3 : Lobby (creer/lister/rejoindre une partie) + Realtime sync 2 onglets. Avant : maquette HTML du lobby.
