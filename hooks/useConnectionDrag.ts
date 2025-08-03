'use client'

import { useState, useCallback, useEffect } from 'react'
import { Connection, ConnectionState } from '@/types/workflow'
import { PortPosition } from './usePortPositions'

interface DragState {
  isDragging: boolean
  sourceNodeId: string | null
  sourcePortId: string | null
  sourcePortType: 'input' | 'output' | null
  currentPosition: { x: number; y: number } | null
}

export function useConnectionDrag(existingConnections: Connection[] = []) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    sourceNodeId: null,
    sourcePortId: null,
    sourcePortType: null,
    currentPosition: null
  })

  const startDrag = useCallback((nodeId: string, portId: string, portType: 'input' | 'output', position: { x: number; y: number }) => {
    // Only allow dragging from output ports
    if (portType !== 'output') return
    
    setDragState({
      isDragging: true,
      sourceNodeId: nodeId,
      sourcePortId: portId,
      sourcePortType: portType,
      currentPosition: position
    })
  }, [])

  const updateDrag = useCallback((position: { x: number; y: number }) => {
    setDragState(prev => ({
      ...prev,
      currentPosition: position
    }))
  }, [])

  const endDrag = useCallback((targetNodeId: string | null, targetPortId: string | null, targetPortType: 'input' | 'output' | null) => {
    const { sourceNodeId, sourcePortId, sourcePortType } = dragState
    
    // Reset drag state
    setDragState({
      isDragging: false,
      sourceNodeId: null,
      sourcePortId: null,
      sourcePortType: null,
      currentPosition: null
    })
    
    // Validate connection
    if (!sourceNodeId || !sourcePortId || !targetNodeId || !targetPortId) return null
    
    // Only allow output to input connections
    if (sourcePortType !== 'output' || targetPortType !== 'input') return null
    
    // Don't allow self-connections
    if (sourceNodeId === targetNodeId) return null
    
    // Check for duplicate connections
    const isDuplicate = existingConnections.some(conn => 
      conn.source.nodeId === sourceNodeId && 
      conn.source.portId === sourcePortId && 
      conn.target.nodeId === targetNodeId && 
      conn.target.portId === targetPortId
    )
    
    if (isDuplicate) return null
    
    // Return valid connection with generated ID
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    return {
      id: connectionId,
      source: { nodeId: sourceNodeId, portId: sourcePortId },
      target: { nodeId: targetNodeId, portId: targetPortId },
      state: 'pending' as ConnectionState
    }
  }, [dragState])

  const cancelDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      sourceNodeId: null,
      sourcePortId: null,
      sourcePortType: null,
      currentPosition: null
    })
  }, [])

  // Cancel drag on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.isDragging) {
        cancelDrag()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dragState.isDragging, cancelDrag])

  return {
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag
  }
}