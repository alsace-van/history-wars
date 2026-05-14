// v1.12 (14/05/2026) — Phase 3.3 Lot C : orderRetreatPickMode (highlight hex pour pré-ordre retreat)
// v1.11 (14/05/2026) — Phase 3.3 : targetableUnitIds utilise resolveUnitStatsV2 + skip LoS si arcedTrajectory
// v1.10 (12/05/2026) — Phase 3.1-C : params visibleTileKeys + enemyVisibility (filtre reachable/targetable)
// v1.9 (12/05/2026) — QW2 : inspectedEnemyId (clic ennemi → panel read-only, toggle même cible)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeCohesion, computeSupport, type CohesionState, type SupportCount } from '@engine/cohesion'
import { cubeKey, cubeDistance, neighbors, spiral } from '@engine/hex'
import { bfsReachable } from '@engine/movement'
import { computeEnemyZoc } from '@engine/zoc'
import { hasLineOfSight } from '@engine/los'
import { getUnitStats, resolveUnitStatsV2, type UnitState } from '@engine/units'
import type { VisibilityLevel } from '@engine/vision'
import type { HexTileState } from '@render/types'
import type { Team } from '@/types/game'

interface UseTacticalSelectionParams {
  inProgress: boolean
  isMyTurn: boolean
  myTeam: Team | null
  /** team active courant (sert a invalider la selection sur changement de tour) */
  activeTeam: Team
  unitStates: ReadonlyArray<UnitState>
  /** cles cubiques des hex de la carte — limite la propagation BFS */
  boardKeys: ReadonlySet<string>
  /**
   * Phase 2 2D.6 : si true et selectedUnit existe, on remplace reachableMap/tileStates
   * par les 6 voisins libres en state 'split-target' (UX : sélection visuelle de la case
   * cible pour scinder). Le click sur ces tiles déclenche split_unit dans Game.tsx.
   */
  splitMode: boolean
  /**
   * Phase 2.5 C — mode "Retraite" : highlight des 6 voisins libres pour sortir une unité Brisée.
   * Click sur ces tiles déclenche `retreat` dans Game.tsx.
   */
  retreatMode?: boolean
  /**
   * Phase 2.5 C — mode "Combat suicide" : highlight des ennemis adjacents.
   * Click sur ces tiles/unités déclenche `suicide_attack` dans Game.tsx.
   */
  suicideMode?: boolean
  /**
   * Phase 2.6 C — Set des unitId actuellement dans au moins 1 engagement actif.
   * Si l'unité sélectionnée y figure, son mouvement standard est désactivé
   * (reachableMap vide). Elle doit Rompre le combat (-10% effective) avant
   * de se redéplacer. L'attaque mêlée sur son opponent reste possible (riposte).
   */
  engagedUnitIds?: ReadonlySet<string>
  /**
   * Phase 3.1-C : hex visibles par mon team (fog client, fourni par useVisionMap).
   * Si présent, reachableMap est filtré pour ne contenir QUE les hex visibles.
   * Si absent (rétro-compat), pas de filtre fog (comportement pré-Phase 3).
   */
  visibleTileKeys?: ReadonlySet<string>
  /**
   * Phase 3.1-C : niveau d'identification par ennemi (fourni par useVisionMap).
   * Si présent, targetableUnitIds exclut les ennemis 'hidden' (impossible de tirer
   * sur ce qu'on ne voit pas). Côté serveur (EF), la validation reste désactivée
   * en MVP — RLS anti-triche prévu Phase 4.
   */
  enemyVisibility?: ReadonlyMap<string, VisibilityLevel>
  /**
   * Phase 3.3 Lot C — mode "pick hex" pour pré-ordre retreat. Quand activé,
   * highlight les hex dans spiral(unit.position, movement) libres + visibles.
   * Click sur un hex highlight → callback consommé par Game.tsx (commit destHex
   * dans la draft d'ordre).
   */
  orderRetreatPickMode?: boolean
}

interface UseTacticalSelectionResult {
  selectedUnitId: string | null
  selectedUnit: UnitState | null
  isSelectedMine: boolean
  /** Map<cubeKey, cout MP> des cases atteignables (vide si pas de selection ou unite ennemie) */
  reachableMap: Map<string, number>
  /** Set des unitId ennemis attaquables par l'unite selectionnee (range + LoS) */
  targetableUnitIds: Set<string>
  /** Set des cubeKey en ZoC ennemie ; entrer y stoppe le mouvement (cf piege #41) */
  dangerousZocKeys: Set<string>
  /** Map<cubeKey, HexTileState> a passer a TacticalScene */
  tileStates: Map<string, HexTileState>
  /** Set des unites qui ont epuise leurs ordres (visuellement attenuees) */
  exhaustedUnitIds: Set<string>
  /** Phase 2 2D.6 : Set des cubeKey adjacentes libres en mode split (vide sinon). */
  splitTargetKeys: Set<string>
  /** Phase 2.5 — état de cohésion par unité (nominal / shaken / broken). */
  cohesionStateMap: Map<string, CohesionState>
  /** Phase 2.5 — comptage soutien par unité (alliés rayon 1+2). */
  supportMap: Map<string, SupportCount>
  /** Phase 2.5 C — Set des cubeKey adjacentes libres en mode retreat (vide sinon). */
  retreatTargetKeys: Set<string>
  /** Phase 2.5 C — Set des unitId ennemis adjacents en mode suicide (vide sinon). */
  suicideTargetIds: Set<string>
  /** Phase 3.3 Lot C — Set des cubeKey atteignables pour pré-ordre retreat (vide hors mode). */
  orderRetreatPickKeys: Set<string>
  /** QW2 — Unité ennemie en cours d'inspection (panel read-only). null si aucune. */
  inspectedEnemy: UnitState | null
  handleUnitClick: (unit: { id: string; team: Team }) => void
  clearSelection: () => void
  /** QW2 — clear l'inspection seule (sans toucher selectedUnitId). */
  clearInspection: () => void
}

export function useTacticalSelection(
  params: UseTacticalSelectionParams
): UseTacticalSelectionResult {
  const { inProgress, isMyTurn, myTeam, activeTeam, unitStates, boardKeys, splitMode, retreatMode = false, suicideMode = false, engagedUnitIds, visibleTileKeys, enemyVisibility, orderRetreatPickMode = false } = params

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

  // Reset selection : sortie de in_progress, changement de tour, ou unite disparue
  useEffect(() => {
    if (!inProgress) {
      setSelectedUnitId(null)
      return
    }
    if (selectedUnitId && !unitStates.some(u => u.id === selectedUnitId)) {
      setSelectedUnitId(null)
    }
  }, [inProgress, activeTeam, unitStates, selectedUnitId])

  const selectedUnit = useMemo<UnitState | null>(
    () => unitStates.find(u => u.id === selectedUnitId) ?? null,
    [unitStates, selectedUnitId]
  )

  const isSelectedMine = !!selectedUnit && selectedUnit.team === myTeam

  // ZoC ennemie depuis le point de vue de l'unite selectionnee. Memoise + reutilise par
  // reachableMap (BFS stop) et dangerousZocKeys (visuel) — evite double calcul.
  const enemyZoc = useMemo<Set<string>>(() => {
    if (!selectedUnit || !isSelectedMine) return new Set()
    return computeEnemyZoc(unitStates, selectedUnit.team)
  }, [selectedUnit, isSelectedMine, unitStates])

  // v1.8 — heuristique post-rupture : hasAttacked && !hasMoved + ennemi(s) adjacent(s)
  // → l'unité vient de Rompre ce tour. Pas de migration BDD nécessaire car aucun
  // autre flux ne laisse ce triplet d'état (artillerie ne tire pas adjacent, mêlée
  // crée un engagement → impossible de bouger sans rompre).
  const postRuptureAdjacentEnemies = useMemo<UnitState[]>(() => {
    if (!selectedUnit || !isSelectedMine) return []
    if (!selectedUnit.hasAttacked || selectedUnit.hasMoved) return []
    const adj: UnitState[] = []
    for (const u of unitStates) {
      if (u.team === selectedUnit.team) continue
      if (cubeDistance(selectedUnit.position, u.position) === 1) adj.push(u)
    }
    return adj
  }, [selectedUnit, isSelectedMine, unitStates])

  const reachableMap = useMemo<Map<string, number>>(() => {
    if (!selectedUnit || !isSelectedMine || !isMyTurn) return new Map()
    if (selectedUnit.hasMoved || selectedUnit.routed) return new Map()
    // Phase 2.6 — engagement persistant : une unité engagée doit Rompre le combat
    // (action volontaire, -10% effective) avant de pouvoir bouger en standard.
    if (engagedUnitIds && engagedUnitIds.has(selectedUnit.id)) return new Map()
    const stats = getUnitStats(selectedUnit.kind)
    const others = unitStates.filter(u => u.id !== selectedUnit.id)
    const blockers = new Set(others.map(u => cubeKey(u.position)))
    const raw = bfsReachable({
      start: selectedUnit.position,
      movementPoints: stats.movement,
      blockers,
      enemyZocCubes: enemyZoc,
    })
    const startKey = cubeKey(selectedUnit.position)
    const out = new Map<string, number>()

    // v1.8 — post-rupture : ne garder que les hex qui s'éloignent STRICTEMENT de tous
    // les ennemis ex-engagés (= adjacents au moment de la rupture, puisque l'unité
    // n'a pas bougé depuis).
    const filterPostRupture = postRuptureAdjacentEnemies.length > 0
    for (const [k, c] of raw) {
      if (k === startKey) continue
      if (!boardKeys.has(k)) continue
      if (filterPostRupture) {
        // Recompose la position depuis raw — bfsReachable expose le hex en clé. On a
        // besoin du cube ; on utilise la map des positions atteintes.
        // raw retourne Map<cubeKey, cost>. Pour récupérer le hex, on parse la clé
        // (format q,r,s).
        const parts = k.split(',').map(Number)
        const destCube = { q: parts[0], r: parts[1], s: parts[2] }
        let isAwayFromAll = true
        for (const enemy of postRuptureAdjacentEnemies) {
          if (cubeDistance(destCube, enemy.position) <= 1) {
            // toujours adjacent à au moins un ex-ennemi → interdit
            isAwayFromAll = false
            break
          }
        }
        if (!isAwayFromAll) continue
      }
      // Phase 3.1-C : fog client — ne pas proposer de move vers un hex non observé.
      // (Le serveur ne valide pas la visibilité en MVP, cf. RLS Phase 4.)
      if (visibleTileKeys && !visibleTileKeys.has(k)) continue
      out.set(k, c)
    }
    return out
  }, [selectedUnit, isSelectedMine, isMyTurn, unitStates, enemyZoc, boardKeys, engagedUnitIds, postRuptureAdjacentEnemies, visibleTileKeys])

  // Phase 2.5 — précalcule cohésion + support pour toutes les unités (single pass).
  // Permet : (1) bloquer attaque standard si Brisé, (2) UI panneau critique,
  // (3) anneaux 3D, (4) modale Ébranlé. Recalcul à chaque changement unitStates
  // → cohésion en temps réel (cf décision 8 plan moral-cohésion).
  const cohesionData = useMemo<{
    supportMap: Map<string, SupportCount>
    cohesionStateMap: Map<string, CohesionState>
  }>(() => {
    const supportMap = new Map<string, SupportCount>()
    const cohesionStateMap = new Map<string, CohesionState>()
    for (const u of unitStates) {
      const s = computeSupport(u, unitStates)
      const c = computeCohesion(u, s)
      supportMap.set(u.id, s)
      cohesionStateMap.set(u.id, c.state)
    }
    return { supportMap, cohesionStateMap }
  }, [unitStates])

  const targetableUnitIds = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!selectedUnit || !isSelectedMine || !isMyTurn) return out
    if (selectedUnit.hasAttacked || selectedUnit.routed) return out
    // v1.7 (12/05/2026) — Brisée ne peut plus attaquer EN STANDARD sauf si l'ennemi est
    // strictement plus petit (override "finir une troupe affaiblie"). Cohérent avec
    // handleAttack.ts côté EF v1.3 — mirror obligatoire pour UI/serveur.
    const isBroken = cohesionData.cohesionStateMap.get(selectedUnit.id) === 'broken'
    // Phase 3.3 — v2 stats (avec subKind) au lieu de v1 (range=4 hardcode A) — alignement client/serveur.
    const statsV2 = resolveUnitStatsV2(selectedUnit.kind, selectedUnit.subKind)
    const range = statsV2.range
    const minRange = statsV2.minRange
    const arcedTrajectory = statsV2.arcedTrajectory ?? false
    for (const enemy of unitStates) {
      if (enemy.team === selectedUnit.team) continue
      if (isBroken && enemy.effective >= selectedUnit.effective) continue // override Brisée
      // Phase 2.5 — on attaque même les ennemis routed / Brisé (coup de grâce historique).
      const dist = cubeDistance(selectedUnit.position, enemy.position)
      if (dist === 0 || dist > range) continue
      if (dist > 1) {
        // Phase 3.3 : check minRange explicite (ex artillery_light minRange=2 → distance 1 = mêlée, pas ranged).
        // Le serveur valide pareil ; on s'aligne pour ne pas highlighter une cible invalide.
        if (dist < minRange) continue
        // Tir en cloche (obusier) : ignore les blockers unités. Sinon check LoS classique.
        if (!arcedTrajectory) {
          const blockers = new Set<string>()
          for (const u of unitStates) {
            if (u.id === selectedUnit.id) continue
            if (u.id === enemy.id) continue
            blockers.add(cubeKey(u.position))
          }
          if (!hasLineOfSight(selectedUnit.position, enemy.position, blockers)) continue
        }
      }
      // Phase 3.1-C : impossible de cibler un ennemi non vu (hidden). 'spotted'/'identified' OK.
      if (enemyVisibility && (enemyVisibility.get(enemy.id) ?? 'hidden') === 'hidden') continue
      out.add(enemy.id)
    }
    return out
  }, [selectedUnit, isSelectedMine, isMyTurn, unitStates, cohesionData, enemyVisibility])

  // v1.10 (12/05/2026) — Phase 3.1-C : visibleEnemyIds n'est plus calculé ici, il vient de
  // useVisionMap (param enemyVisibility) — single source of truth, évite double calcul fog.

  // Phase 2 2D.6 : 6 voisins libres autour de la source quand splitMode actif.
  // Calcul indépendant de reachableMap (pas de coût MP, juste adjacence + libre).
  const splitTargetKeys = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!splitMode || !selectedUnit || !isSelectedMine || !isMyTurn) return out
    const occupied = new Set<string>()
    for (const u of unitStates) {
      if (u.id === selectedUnit.id) continue
      occupied.add(cubeKey(u.position))
    }
    for (const n of neighbors(selectedUnit.position)) {
      const k = cubeKey(n)
      if (!boardKeys.has(k)) continue
      if (occupied.has(k)) continue
      out.add(k)
    }
    return out
  }, [splitMode, selectedUnit, isSelectedMine, isMyTurn, unitStates, boardKeys])

  // Phase 2.5 C — 6 voisins libres autour de la source en mode retreat (UX similaire split).
  // L'unité doit être Brisée pour entrer en retreatMode (vérif côté Game.tsx).
  const retreatTargetKeys = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!retreatMode || !selectedUnit || !isSelectedMine || !isMyTurn) return out
    const occupied = new Set<string>()
    for (const u of unitStates) {
      if (u.id === selectedUnit.id) continue
      occupied.add(cubeKey(u.position))
    }
    for (const n of neighbors(selectedUnit.position)) {
      const k = cubeKey(n)
      if (!boardKeys.has(k)) continue
      if (occupied.has(k)) continue
      out.add(k)
    }
    return out
  }, [retreatMode, selectedUnit, isSelectedMine, isMyTurn, unitStates, boardKeys])

  // Phase 2.5 C — ennemis adjacents quand suicideMode actif (cibles potentielles).
  // Le check encerclement + ratio camp se fait côté EF.
  const suicideTargetIds = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!suicideMode || !selectedUnit || !isSelectedMine || !isMyTurn) return out
    for (const enemy of unitStates) {
      if (enemy.team === selectedUnit.team) continue
      if (cubeDistance(selectedUnit.position, enemy.position) !== 1) continue
      out.add(enemy.id)
    }
    return out
  }, [suicideMode, selectedUnit, isSelectedMine, isMyTurn, unitStates])

  // Phase 3.3 Lot C — hex sélectionnables pour pré-ordre retreat (spiral movement).
  // Inclut tous les hex à distance ≤ movement, libres, visibles. Pas de check ZoC :
  // l'ordre est pré-réservé, l'évaluation effective se fait au moment du déclenchement.
  const orderRetreatPickKeys = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!orderRetreatPickMode || !selectedUnit || !isSelectedMine) return out
    const stats = getUnitStats(selectedUnit.kind)
    const occupied = new Set<string>()
    for (const u of unitStates) {
      if (u.id === selectedUnit.id) continue
      occupied.add(cubeKey(u.position))
    }
    const candidates = spiral(selectedUnit.position, stats.movement)
    const startKey = cubeKey(selectedUnit.position)
    for (const c of candidates) {
      const k = cubeKey(c)
      if (k === startKey) continue
      if (!boardKeys.has(k)) continue
      if (occupied.has(k)) continue
      if (visibleTileKeys && !visibleTileKeys.has(k)) continue
      out.add(k)
    }
    return out
  }, [orderRetreatPickMode, selectedUnit, isSelectedMine, unitStates, boardKeys, visibleTileKeys])

  const tileStates = useMemo<Map<string, HexTileState>>(() => {
    const map = new Map<string, HexTileState>()
    // Modes exclusifs : split / retreat / suicide / orderRetreatPick n'affichent QUE leur sélection.
    if (splitMode) {
      for (const k of splitTargetKeys) map.set(k, 'split-target')
      return map
    }
    if (retreatMode) {
      // Réutilise le state 'split-target' (ambre) pour la sélection direction retraite.
      for (const k of retreatTargetKeys) map.set(k, 'split-target')
      return map
    }
    if (orderRetreatPickMode) {
      // Phase 3.3 Lot C — bleu distinct, ce n'est PAS le repli immédiat mais un pré-ordre.
      for (const k of orderRetreatPickKeys) map.set(k, 'retreat-target')
      return map
    }
    if (suicideMode) {
      // Pas de tile state spécifique en mode suicide — les ennemis attaquables sont highlight via suicideTargetIds.
      return map
    }
    for (const k of reachableMap.keys()) {
      // hex reachable mais en ZoC ennemie → 'dangerous' (entree y stoppe le mouvement)
      map.set(k, enemyZoc.has(k) ? 'dangerous' : 'reachable')
    }
    return map
  }, [splitMode, splitTargetKeys, retreatMode, retreatTargetKeys, orderRetreatPickMode, orderRetreatPickKeys, suicideMode, reachableMap, enemyZoc])

  const exhaustedUnitIds = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    for (const u of unitStates) {
      if (u.hasMoved && u.hasAttacked) set.add(u.id)
      if (u.routed) set.add(u.id)
    }
    return set
  }, [unitStates])

  const handleUnitClick = useCallback(
    (unit: { id: string; team: Team }) => {
      if (!inProgress) return
      if (selectedUnitId === unit.id) {
        setSelectedUnitId(null)
        return
      }
      if (unit.team !== myTeam) {
        // QW2 — clic ennemi : toggle inspection (panel read-only).
        // setInspectedEnemyId déclaré plus bas (queue) — la closure capture le binding.
        setInspectedEnemyId(prev => (prev === unit.id ? null : unit.id))
        return
      }
      setSelectedUnitId(unit.id)
      setInspectedEnemyId(null)
    },
    [inProgress, selectedUnitId, myTeam]
  )

  const clearSelection = useCallback(() => {
    setSelectedUnitId(null)
    setInspectedEnemyId(null)
  }, [])

  // QW2 — Inspection ennemie (hooks en queue cf. CLAUDE.md règle 3).
  const [inspectedEnemyId, setInspectedEnemyId] = useState<string | null>(null)

  const inspectedEnemy = useMemo<UnitState | null>(
    () => unitStates.find(u => u.id === inspectedEnemyId) ?? null,
    [unitStates, inspectedEnemyId],
  )

  // Reset inspection si sortie de in_progress ou si l'ennemi disparaît (killed/merged).
  useEffect(() => {
    if (!inProgress) {
      setInspectedEnemyId(null)
      return
    }
    if (inspectedEnemyId && !unitStates.some(u => u.id === inspectedEnemyId)) {
      setInspectedEnemyId(null)
    }
  }, [inProgress, inspectedEnemyId, unitStates])

  const clearInspection = useCallback(() => {
    setInspectedEnemyId(null)
  }, [])

  return {
    selectedUnitId,
    selectedUnit,
    isSelectedMine,
    reachableMap,
    targetableUnitIds,
    dangerousZocKeys: enemyZoc,
    tileStates,
    exhaustedUnitIds,
    splitTargetKeys,
    cohesionStateMap: cohesionData.cohesionStateMap,
    supportMap: cohesionData.supportMap,
    retreatTargetKeys,
    suicideTargetIds,
    orderRetreatPickKeys,
    inspectedEnemy,
    handleUnitClick,
    clearSelection,
    clearInspection,
  }
}
