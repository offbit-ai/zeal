'use client'

import { useEffect, useRef } from 'react'
import { NodeMetadata } from '@/types/workflow'
import { useWorkflowStore } from '@/store/workflow-store'

interface CollapsedGroupPortHandlerProps {
  groupId: string
  groupPosition: { x: number; y: number }
  groupSize: { width: number; height: number }
  groupNodeIds: string[]
  onPortPositionUpdate: (
    nodeId: string,
    portId: string,
    x: number,
    y: number,
    position: 'top' | 'right' | 'bottom' | 'left'
  ) => void
}

export function CollapsedGroupPortHandler({
  groupId,
  groupPosition,
  groupSize,
  groupNodeIds,
  onPortPositionUpdate,
}: CollapsedGroupPortHandlerProps) {
  const nodes = useWorkflowStore(state => state.nodes)
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Calculate group center
    const groupCenterX = groupPosition.x + groupSize.width / 2
    const groupCenterY = groupPosition.y + groupSize.height / 2

    // Check if position has actually changed significantly (avoid floating point issues)
    const lastPos = lastPositionRef.current
    if (
      lastPos &&
      Math.abs(lastPos.x - groupCenterX) < 1 &&
      Math.abs(lastPos.y - groupCenterY) < 1
    ) {
      return // Position hasn't changed significantly
    }

    // Clear any pending update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // Debounce the update to avoid jumpy behavior
    updateTimeoutRef.current = setTimeout(() => {
      // console.log removed

      // Find all nodes that belong to this group
      const groupNodes = nodes.filter(node => groupNodeIds.includes(node.metadata?.id))

      // Register all ports for each node at the group's center
      groupNodes.forEach(node => {
        const nodeId = node.metadata?.id
        if (!nodeId || !node.metadata) return

        const metadata = node.metadata as NodeMetadata

        // Calculate edge positions for better visual appearance
        const leftEdgeX = groupPosition.x + 5
        const rightEdgeX = groupPosition.x + groupSize.width - 5
        const centerY = groupPosition.y + groupSize.height / 2

        // Register input ports on the left edge
        metadata.ports
          ?.filter(p => p.type === 'input')
          .forEach(port => {
            onPortPositionUpdate(nodeId, port.id, leftEdgeX, centerY, 'left')
          })

        // Register output ports on the right edge
        metadata.ports
          ?.filter(p => p.type === 'output')
          .forEach(port => {
            onPortPositionUpdate(nodeId, port.id, rightEdgeX, centerY, 'right')
          })
      })

      // Update last position
      lastPositionRef.current = { x: groupCenterX, y: groupCenterY }
    }, 50) // 50ms debounce

    // Cleanup
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [
    groupId,
    groupPosition.x,
    groupPosition.y,
    groupSize.width,
    groupSize.height,
    groupNodeIds,
    nodes,
    onPortPositionUpdate,
  ])

  return null // This component doesn't render anything
}
