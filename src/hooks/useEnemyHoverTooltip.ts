// v1.0 (12/05/2026) — QW1 : extraction du tooltip hover ennemi (hover state + mousePos + handlers) de Game.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { UnitState } from '@engine/units'
import type { UnitInstance } from '@render/types'

interface UseEnemyHoverTooltipParams {
  unitStates: ReadonlyArray<UnitState>
  targetableUnitIds: Set<string>
}

export interface UseEnemyHoverTooltipResult {
  hoveredEnemyId: string | null
  setHoveredEnemyId: (id: string | null) => void
  hoveredEnemy: UnitState | null
  mousePos: { x: number; y: number }
  handleSceneMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void
  handleUnitPointerOver: (unit: UnitInstance) => void
  handleUnitPointerOut: (unit: UnitInstance) => void
}

export function useEnemyHoverTooltip(p: UseEnemyHoverTooltipParams): UseEnemyHoverTooltipResult {
  const { unitStates, targetableUnitIds } = p

  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const handleSceneMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!hoveredEnemyId) return
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [hoveredEnemyId])

  const handleUnitPointerOver = useCallback((unit: UnitInstance) => {
    if (targetableUnitIds.has(unit.id)) setHoveredEnemyId(unit.id)
  }, [targetableUnitIds])

  const handleUnitPointerOut = useCallback((unit: UnitInstance) => {
    setHoveredEnemyId(prev => (prev === unit.id ? null : prev))
  }, [])

  const hoveredEnemy = useMemo<UnitState | null>(
    () => unitStates.find(u => u.id === hoveredEnemyId) ?? null,
    [unitStates, hoveredEnemyId]
  )

  // Reset hover si l'ennemi sort du targetableUnitIds (ex: changement de sélection).
  useEffect(() => {
    if (hoveredEnemyId && !targetableUnitIds.has(hoveredEnemyId)) {
      setHoveredEnemyId(null)
    }
  }, [hoveredEnemyId, targetableUnitIds])

  return {
    hoveredEnemyId,
    setHoveredEnemyId,
    hoveredEnemy,
    mousePos,
    handleSceneMouseMove,
    handleUnitPointerOver,
    handleUnitPointerOut,
  }
}
