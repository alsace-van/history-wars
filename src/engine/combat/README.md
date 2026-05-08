# engine/combat/

Resolution de combat par points additifs (ATK, DEF, terrain, flanc, fatigue, moral). Implementation Phase 1.

Module partage client/serveur :
- Cote client : previsions de combat dans la phase d'ordres
- Cote serveur : resolution autoritative dans Edge Function `resolve_turn`
