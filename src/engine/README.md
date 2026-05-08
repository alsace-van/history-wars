# engine/

Logique pure du jeu, sans React. Reutilisable cote client (previsions) et cote serveur (Edge Functions Supabase).

Sous-modules :
- `hex/` coordonnees cubiques, distance, voisins. Parametre par hexSize.
- `scales/` config par echelle (tactical/operational/strategic).
- `combat/` resolution de combat. Phase 1+.
- `ai/` heuristiques IA. Phase 2+.

Regle : aucun import depuis `render/`, `ui/` ou React. Logique pure.
