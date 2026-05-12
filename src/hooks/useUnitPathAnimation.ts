// v1.0 (12/05/2026) — QW1 : extraction de l'animation de chemins par unité (Map<unitId, path[]>)
import { useCallback, useState } from 'react'
import type { Cube } from '@engine/hex'

export interface UseUnitPathAnimationResult {
  unitPaths: Map<string, ReadonlyArray<Cube>>
  setUnitPaths: React.Dispatch<React.SetStateAction<Map<string, ReadonlyArray<Cube>>>>
  onUnitPathDone: (unitId: string) => void
}

export function useUnitPathAnimation(): UseUnitPathAnimationResult {
  const [unitPaths, setUnitPaths] = useState<Map<string, ReadonlyArray<Cube>>>(new Map())

  const onUnitPathDone = useCallback((unitId: string) => {
    setUnitPaths(prev => {
      if (!prev.has(unitId)) return prev
      const next = new Map(prev)
      next.delete(unitId)
      return next
    })
  }, [])

  return { unitPaths, setUnitPaths, onUnitPathDone }
}
