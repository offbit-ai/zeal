'use client'

import { useState, useCallback } from 'react'

export interface PortPosition {
  nodeId: string
  portId: string
  x: number
  y: number
  position: 'top' | 'right' | 'bottom' | 'left'
}

export function usePortPositions() {
  const [portPositions, setPortPositions] = useState<Map<string, PortPosition>>(new Map())

  const updatePortPosition = useCallback(
    (
      nodeId: string,
      portId: string,
      x: number,
      y: number,
      position: 'top' | 'right' | 'bottom' | 'left'
    ) => {
      const key = `${nodeId}-${portId}`
      setPortPositions(prev => {
        const newMap = new Map(prev)
        newMap.set(key, { nodeId, portId, x, y, position })
        return newMap
      })
    },
    []
  )

  const getPortPosition = useCallback(
    (nodeId: string, portId: string): PortPosition | undefined => {
      return portPositions.get(`${nodeId}-${portId}`)
    },
    [portPositions]
  )

  return {
    portPositions,
    updatePortPosition,
    getPortPosition,
  }
}
