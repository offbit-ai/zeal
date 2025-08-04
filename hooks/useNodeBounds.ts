'use client'

import { useCallback, useState } from 'react'

export interface NodeBounds {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export function useNodeBounds() {
  const [nodeBounds, setNodeBounds] = useState<Map<string, NodeBounds>>(new Map())

  const updateNodeBounds = useCallback((id: string, bounds: Omit<NodeBounds, 'id'>) => {
    setNodeBounds(prev => {
      const newMap = new Map(prev)
      newMap.set(id, { id, ...bounds })
      return newMap
    })
  }, [])

  const removeNodeBounds = useCallback((id: string) => {
    setNodeBounds(prev => {
      const newMap = new Map(prev)
      newMap.delete(id)
      return newMap
    })
  }, [])

  const getNodeBoundsArray = useCallback(() => {
    return Array.from(nodeBounds.values())
  }, [nodeBounds])

  return {
    nodeBounds,
    updateNodeBounds,
    removeNodeBounds,
    getNodeBoundsArray,
  }
}
