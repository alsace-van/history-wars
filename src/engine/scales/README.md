# engine/scales/

Configuration par echelle. Une seule source de verite pour les contraintes par scale.

A implementer Phase 0 sous-tache 0.7 :
- `types.ts` `Scale = 'tactical' | 'operational' | 'strategic'`
- `config.ts` `SCALE_CONFIG[scale]` : hexSize, time-per-turn, contraintes camera, etc.
