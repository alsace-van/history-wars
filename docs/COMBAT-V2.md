# COMBAT-V2.md

Reference des regles de combat **TACTICA Phase 2**.
Version 1.0 - 10/05/2026.

> Source de verite cote engine : `src/engine/combat/v2/` + `src/engine/units/{stats,sizing}.ts` + `src/engine/terrain/`.
> Source de verite cote BDD : `combat_config` (migration 014, JSONB editable runtime).
> Source de verite mirror Deno : `supabase/functions/_shared/engine-port/combat/v2/`.

---

## 1. Vue d'ensemble

La Phase 2 transforme le combat MVP (Phase 1 : ATK - DEF + roll) en un systeme riche fonde sur :
- **Effectif elastique** du pion (1 pion = 1 bataillon historique : 800 hommes, 180 cavaliers, 120 servants d'artillerie).
- **3 phases d'attaque distinctes** : melee, distance, charge cavalerie.
- **Matrices de matchup** par phase (3 matrices 3x3, lookup `attacker_kind x defender_kind`).
- **Saturation par terrain** : un hex couloir limite a 80 hommes engages, une plaine ouverte a 300.
- **Modele de calcul par contact** (Option 3 du brainstorm 09-10/05/2026) : `puissance - resistance` plafonne a un plancher 1 si l'attaque est valide.
- **Charge cavalerie** : detectee si attacker.kind = C, distance parcourue >= 2 hex en ligne droite, terrain `chargeAllowed`.
- **Scission / fusion** de pions : 3 ratios preset (50/50, 75/25, 90/10), 1 tour d'inactivite offensive.
- **Variance** : roll 0.85 + dice * 0.30 (±15%).
- **Riposte automatique** en melee uniquement (pas en ranged ni charge).
- **Breakdown ligne par ligne** affiche dans le tooltip de prevision (UI).

Le moteur de tour reste celui de la Phase 1 (ordres simultanes, defenseur passif). La refonte du moteur de tour sera la **Phase 3** (brouillard, detection, pre-postures).

---

## 2. Stats par UnitKind (Phase 2 v2)

Source : `engine/units/stats.ts` `UNIT_STATS_V2`. Mirror BDD : `combat_config.config.stats`.

| Kind | effectiveMax | effectiveMin | attack | defense | rangedPower | range | minRange | movement |
|------|-------------:|-------------:|-------:|--------:|------------:|------:|---------:|---------:|
| I (Infanterie) | 800 | 100 | 1.0 | 1.0 | 0   | 1 | 0 | 3 |
| C (Cavalerie)  | 180 |  25 | 1.1 | 0.9 | 0   | 1 | 0 | 6 |
| A (Artillerie) | 120 |  30 | 0.5 | 0.3 | 4.0 | 7 | 2 | 2 |

**SubKind 'archer'** sur A : override `range = 4`, `minRange = 0`, `rangedPower = 2.5`.

Conversions pratiques :
- Infanterie : 1 pion = 1 bataillon de ligne historique (~800 hommes).
- Cavalerie : 1 pion = 1 escadron (~180 cavaliers).
- Artillerie : 1 pion = 1 batterie (6 pieces, ~120 servants).

---

## 3. Plafonds saturation par terrain

Source : `engine/terrain/caps.ts` `TERRAIN_CAPS`. Mirror BDD : `combat_config.config.terrainCaps`.

| Terrain | contactCap | defBonus | atkPenalty | cavMovementPenalty | chargeAllowed |
|---------|-----------:|---------:|-----------:|-------------------:|:-------------:|
| plaine_ouverte  | 300 | 1.0 | 1.0 | 1.0 | true  |
| plaine_standard | 200 | 1.0 | 1.0 | 1.0 | true  |
| bosquet         | 150 | 1.2 | 0.9 | 0.7 | false |
| foret           | 100 | 1.5 | 0.8 | 0.4 | false |
| pont            |  80 | 1.3 | 1.0 | 0.5 | false |
| breche          |  50 | 1.5 | 1.0 | 0.0 | false |

`contactCap` plafonne le nombre d'hommes engages au contact. C'est ce qui rend le scenario "Thermopyles" possible : 100 hommes en breche tiennent presque autant que 800 (les 50 supplementaires ne servent a rien physiquement).

Le plafond final utilise est `min(contactCap_attacker, contactCap_defender)` : le terrain le plus restrictif gouverne.

---

## 4. Matrices de matchup

Source : `engine/combat/v2/matchup.ts` `getMatchupCoef(att, def, phase, config)`. Mirror BDD : `combat_config.config.matchupMatrix`.

### 4.1 Melee

| Att\Def | I  | C  | A  |
|---------|---:|---:|---:|
| **I**   | 1.0 | 1.1 | 1.5 |
| **C**   | 0.9 | 1.0 | 1.5 |
| **A**   | 0.5 | 0.5 | 1.0 |

Cavalerie au contact sans charge = leger desavantage vs infanterie (carre tenu). Artillerie au contact = 50% d'efficacite vs inf/cav.

### 4.2 Ranged

| Att\Def | I  | C  | A  |
|---------|---:|---:|---:|
| **I**   | 0.8 | 0.7 | 0.9 |
| **C**   | 0.5 | 0.5 | 0.5 |
| **A**   | 1.0 | 0.7 | 1.5 |

Artillerie excellente en contre-batterie (1.5), mediocre vs cavalerie mobile (0.7). Cavalerie tire mal a distance (carabines courte portee).

### 4.3 Charge cavalerie

| Att\Def | I  | C  | A  |
|---------|---:|---:|---:|
| **I**   | 1.0 | 1.0 | 1.0 |
| **C**   | 1.5 | 1.1 | 1.5 |
| **A**   | 1.0 | 1.0 | 1.0 |

Une charge de cavalerie sur infanterie (1.5) compense largement le matchup melee classique (0.9). C'est la raison d'etre tactique de la cavalerie : preparer un mouvement de charge plutot que rester au contact.

---

## 5. Modele de calcul par contact

Source : `engine/combat/v2/contact.ts` `resolveContact()`. Mirror Deno identique.

Pipeline (cf. brainstorm Option 3) :

```
1. menEngagedAtt = min(attacker.effective, contactCap_terrain)
2. menEngagedDef = min(defender.effective, contactCap_terrain)
3. baseAttackFactor = phase === 'ranged' ? aStats.rangedPower : aStats.attack
4. baseDefenseFactor = dStats.defense
5. matchupCoef = getMatchupCoef(att.kind, def.kind, phase)
6. atkTerrainMult = TERRAIN_CAPS[attackerTerrain].atkPenalty
7. defTerrainMult = TERRAIN_CAPS[defenderTerrain].defBonus
8. precisionMult = phase === 'ranged' ? distancePrecision(distance, range, minRange) : 1
9. attackerMoraleMult = 1 + moraleCombatBonus(att) / 100   (-0.15, 0, +0.05)
10. defenderMoraleMult = 1 + moraleCombatBonus(def) / 100

power = menEngagedAtt * baseAttackFactor * matchupCoef * chargeMult
        * atkTerrainMult * precisionMult * attackerMoraleMult

resistance = menEngagedDef * baseDefenseFactor * defTerrainMult * defenderMoraleMult

attackPossible = baseAttackFactor > 0 && matchupCoef > 0
                 && (phase !== 'ranged' || precisionMult > 0)

damageRaw = attackPossible ? max(1, max(0, power - resistance))
                           : max(0, power - resistance)

variance = config.diceVariance.low + rng() * config.diceVariance.range
            (defaut : 0.85 + rng() * 0.30  →  variance ∈ [0.85, 1.15))

damageFinal = round(damageRaw * variance)
menLost = min(damageFinal, defender.effective)
```

Ensuite `splitCasualties(menLost, defender.effective)` decompose en `killed` (60%) + `woundedAdd` (40%). Le defenseur est marque `defenderKilled = true` si `effectiveAfter <= effectiveMin`.

Le moral baisse cote defenseur de `round(damage / 4)` en melee/charge, `/ 6` en ranged. Cote attaquant : +2 melee/charge, +1 ranged.

**Plancher d'attrition (Phase 2.5)** : si l'attaque est theoriquement valide (attackPossible), le damage minimum n'est plus 1 mais `max(1, round(menEngagedAttacker * baseAttritionRate))`. `baseAttritionRate` est dans `CombatConfig` (default 0.08 = 8 %). Exemple : 200 hommes engages sur plaine_standard → 16 pertes minimum/tour, meme a forces parfaitement egales (power = resistance). Realisme : un combat 200 vs 200 en melee tue significativement plus qu'1 soldat. La variance ±15 % s'applique ensuite mais le plancher reste enforce.

Avant Phase 2.5 : `power - resistance <= 0` donnait 1 degat, ce qui creait un equilibre figé peu lisible (bug reproduit le 10/05/2026 sur 800I vs 800I plaine_standard).

**Nerf cav Phase 2.5** : les stats `C attack=1.5 / defense=0.7` (v2.0) donnaient un ratio offensif 2.14, soit `power - resistance ≈ 150` sur 180 hommes engages (bug reproduit le 10/05/2026 sur 180 C vs 180 C plaine_standard → defenseur one-shot apres variance haute). Stats corrigees a `attack=1.1 / defense=0.9` (ratio 1.22) → `power - resistance ≈ 38` sur le meme matchup → ~30-45 morts/tour. La cavalerie reste dominante via le matchup `C vs I` melee (0.9) + la **charge** (matchup 1.5 × multiplicateur 1.3-1.5).

---

## 6. Charge cavalerie

Source : `engine/combat/v2/charge.ts`.

Une charge est applicable si :
- `attacker.kind === 'C'`
- `chargedDistance(attackerPath) >= 2` (au moins 2 hex parcourus ce tour)
- `isPathStraight(attackerPath)` (chaque pas suit la meme direction unitaire)
- Tous les hex du `attackerPathTerrain` ont `chargeAllowed === true`
- Le defenseur est adjacent a la position finale du path (`cubeDist(last, defender) === 1`)

Multiplicateur :
- 2 hex parcourus : `chargeMultiplier(2) = 1.3`
- 3 hex : `1.4`
- 4+ hex : `1.5` (plafond)

Le path est alimente par `last_move_path` JSONB sur `units` (migration 012), set par le handler `move` (handleMove.ts) et reset en debut de tour par `resolve_turn` v1.1.

Pas de riposte sur charge (similaire ranged).

---

## 7. Courbe de precision distance

Source : `engine/combat/v2/distance.ts` `distancePrecision(distance, range, minRange)`.

```
sweetLow  = max(minRange, round(range * 0.4))
sweetHigh = round(range * 0.7)

distance < minRange     → 0    (interdit, ex: artillerie a bout portant)
distance > range        → 0    (hors portee)
distance ∈ [sweetLow, sweetHigh]    → 1.0
distance ∈ [minRange, sweetLow[    → lerp 0.85 → 1.0 (vise pas calee)
distance ∈ ]sweetHigh, range]      → lerp 1.0 → 0.5  (tail-off)
```

Exemples :
- Archer (range=4, minRange=0) : sweet spot distance 2-3, distance 4 → 0.5.
- Artillerie (range=7, minRange=2) : sweet spot distance 3-5, distance 7 → 0.5, distance 1 → 0.

---

## 8. Scission / Fusion (effectif elastique)

Source : `engine/units/sizing.ts`.

### Split

`splitUnit({ source, ratio, targetPosition, newUnitId })` :
- `source.hasAttacked === false`
- `source.effective >= 2 * effectiveMin`
- `cubeDistance(targetPosition, source.position) === 1`
- Les 2 fragments resultants ont chacun `effective >= effectiveMin`
- Chaque fragment retombe sur `effectiveMax` standard du type (un pion fusionne se split en 2 bataillons standards)
- Les 2 fragments sont marques `hasMoved = true, hasAttacked = true` (1 tour d'inactivite offensive)

3 ratios preset MVP Phase 2 : `half` (50/50), `three_quarter` (75/25), `nine_one` (90/10).

### Merge

`mergeUnits({ target, source })` :
- same `kind` et `subKind`
- same `team`
- adjacents
- ni l'un ni l'autre n'a attaque ce tour
- `target.effective + source.effective <= target.effectiveMax + source.effectiveMax` (effectiveMax cumule)
- Pion resultant : `effectiveMax_merged = somme`, `effectiveMin_merged = somme`, `morale_merged = moyenne ponderee par effective`, `routed = target.routed && source.routed`
- Marque `hasMoved = true, hasAttacked = true`

Le pion `source` est supprime de la BDD apres merge.

---

## 9. Riposte

Source : `engine/combat/v2/index.ts` `resolveCombat()`.

Une riposte est jouee uniquement si :
- `phase === 'melee'` (pas en ranged ni charge)
- `defenderEffectiveAfter > 0` (defenseur encore present)
- `defenderRouted === false` (defenseur pas en deroute apres l'impact)

La riposte est un appel `resolveContact` avec :
- `attacker = defenderAfter` (defenseur post-impact, hp/wounded/morale baisses)
- `defender = attacker` (attaquant initial)
- `phase = 'melee'`
- `chargeMult = 1.0`
- `attackerTerrain` et `defenderTerrain` inverses

Le rng est partage entre attaque et riposte (determinisme replay).

---

## 10. Configuration runtime

Source : `combat_config` table BDD (migration 014). Seed initial JSONB qui mirror `DEFAULT_COMBAT_CONFIG`.

L'EF `resolve_action` charge `combat_config` une fois par invocation via `loadCombatConfig(admin)`. Si la table est vide, fallback sur `DEFAULT_COMBAT_CONFIG`.

Pour modifier les coefs en prod sans redeploy :
```sql
UPDATE combat_config
SET config = jsonb_set(config, '{matchupMatrix,melee,C,I}', '0.85'::jsonb)
WHERE scale = 'tactical' AND version = 1;
```

Preparation Phase 15 (open source / moddabilite) : tous les coefs sont JSONB editables.

---

## 11. Snapshot AttackResultV2 (Realtime / replays)

Source : `_shared/types.ts` `AttackResultV2`.

Le payload `INSERT game_actions` (Realtime) contient :
- `attackPhase` : 'melee' | 'ranged' | 'charge'
- `combat.attackerEffectiveBefore/After`, `defenderEffectiveBefore/After`
- `combat.menEngagedAttacker/Defender`, `combat.contactCap`
- `combat.bonusBreakdown` : liste `{ label, multiplier, appliedTo }`
- `combat.chargeBonusApplied` : true si charge
- `riposte` : meme structure ou null

Le client peut rejouer entierement l'animation et l'affichage du combat depuis ce payload, sans refetch (cf. piege #29 master).

---

## 12. Validation Phase 2 (criteres)

- [x] Migrations 012/013/014 livrees (idempotentes, advisors clean a verifier en prod)
- [x] `npm run tsc` 0 erreur
- [x] `npm run test` >= 170 verts (actuels : 203)
- [x] Un bataillon plus gros inflige plus de degats sub-saturation
- [x] Saturation plaine 200 : 1800 vs 800 = 800 vs 800
- [x] Thermopyles : 100 vs 800 sur breche cap 50 = effets identiques
- [x] Charge cav 2+ hex en ligne droite plaine = +30% a +50% degats
- [x] Distance ranged optimale > distance max (sweet spot vs tail-off)
- [x] Split / merge fonctionnels avec inactivite 1 tour
- [x] Pion change de taille selon effective (scale lerp 0.35-1.0)
- [x] CombatPreviewTooltip affiche breakdown ligne par ligne
- [x] CombatResultPanel reconnait phase 'charge' (badge + tab)

Restes Phase 2 polish (Session 2.5) :
- [ ] CombatAnimator (~2s par combat, skippable, projectile distance, courbe charge)
- [ ] DamageFloater
- [ ] Setting `animationSpeed` persistant + raccourci espace
- [ ] Application reelle des migrations en prod + advisors check
- [ ] `npm run build` PWA + Lighthouse >= 90

---

**Cite ce fichier en cas de question game design Phase 2.**
