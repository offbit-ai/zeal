'use client'

import { useState, useRef, useEffect, MouseEvent } from 'react'
import { WorkflowNode } from './WorkflowNode'
import type { NodeMetadata, NodeGroup } from '@/types/workflow'

interface DraggableNodeProps {
  metadata: NodeMetadata
  position: { x: number; y: number }
  nodeId?: string // Optional explicit node ID for CRDT compatibility
  propertyValues?: Record<string, any> // Node property values
  onPositionChange?: (id: string, position: { x: number; y: number }) => void
  onBoundsChange?: (
    id: string,
    bounds: { x: number; y: number; width: number; height: number }
  ) => void
  onPortPositionUpdate?: (
    nodeId: string,
    portId: string,
    x: number,
    y: number,
    position: 'top' | 'right' | 'bottom' | 'left'
  ) => void
  onPortDragStart?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onPortDragEnd?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onClick?: (nodeId: string, event?: React.MouseEvent) => void
  isHighlighted?: boolean
  isSelected?: boolean
  onNodeDropIntoGroup?: (nodeId: string, groupId: string) => void
  onNodeHoverGroup?: (groupId: string | null) => void
  groups?: NodeGroup[]
  zoom?: number
  isInGroup?: boolean // New prop to indicate if node is inside a group
  currentGroup?: NodeGroup // Current group (for dynamic bounds calculation)
  onNodeNearGroupBoundary?: (
    nodeId: string,
    groupId: string,
    action: 'resize-right' | 'resize-down',
    value?: number
  ) => void // Callback when node approaches group boundary
  onDragStart?: (nodeId: string) => void
  onDragEnd?: (nodeId: string, finalPosition?: { x: number; y: number }) => void
  onPropertyChange?: (nodeId: string, propertyName: string, value: any) => void // Callback for property changes
}

export function DraggableNode({
  metadata,
  position,
  nodeId,
  propertyValues = {},
  onPositionChange,
  onBoundsChange,
  onPortPositionUpdate,
  onPortDragStart,
  onPortDragEnd,
  onClick,
  isHighlighted = false,
  isSelected = false,
  onNodeDropIntoGroup,
  onNodeHoverGroup,
  groups = [],
  zoom = 1,
  isInGroup = false,
  currentGroup,
  onNodeNearGroupBoundary,
  onDragStart,
  onDragEnd,
  onPropertyChange,
}: DraggableNodeProps) {
  const [hoveringGroupId, setHoveringGroupId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const nodeRef = useRef<HTMLDivElement>(null)
  const lastResizeTime = useRef<{ right: number; down: number }>({ right: 0, down: 0 })
  const throttleDelay = 100 // ms

  // Guard against undefined position (can happen during remote updates)
  if (!position) {
    console.warn('DraggableNode: position is undefined for node', metadata.id)
    return null
  }

  // Helper function to check if node center is inside a group
  const findGroupUnderNode = (nodePosition: { x: number; y: number }): string | null => {
    if (!nodeRef.current) return null

    const nodeRect = nodeRef.current.getBoundingClientRect()
    const nodeCenterX = nodePosition.x + nodeRect.width / 2
    const nodeCenterY = nodePosition.y + nodeRect.height / 2

    for (const group of groups) {
      // Skip if node is already in this group
      if (group.nodeIds.includes(metadata.id)) continue

      // Skip if group is collapsed - don't allow drops into collapsed groups
      if (group.isCollapsed) continue

      const groupLeft = group.position.x
      const groupTop = group.position.y
      const groupRight = group.position.x + group.size.width
      const groupBottom = group.position.y + group.size.height

      if (
        nodeCenterX >= groupLeft &&
        nodeCenterX <= groupRight &&
        nodeCenterY >= groupTop &&
        nodeCenterY <= groupBottom
      ) {
        return group.id
      }
    }

    return null
  }

  // Reset hovering state when component mounts or key props change
  useEffect(() => {
    setHoveringGroupId(null)
    setIsDragging(false)
  }, [metadata.id, nodeId])

  // Update bounds only when node mounts or metadata changes
  useEffect(() => {
    if (nodeRef.current && onBoundsChange) {
      // Use a small delay to ensure the node is fully rendered
      const timer = setTimeout(() => {
        if (nodeRef.current && position) {
          const rect = nodeRef.current.getBoundingClientRect()
          onBoundsChange(metadata.id, {
            x: position.x,
            y: position.y,
            width: rect.width,
            height: rect.height,
          })
        }
      }, 50)

      return () => clearTimeout(timer)
    }
  }, [metadata.id]) // Only update when node id changes (essentially on mount)

  // Trigger port position updates when node moves
  useEffect(() => {
    if (nodeRef.current && position) {
      const event = new CustomEvent('nodePositionChanged', {
        bubbles: true,
        detail: { nodeId: metadata.id, position },
      })
      nodeRef.current.dispatchEvent(event)
    }
  }, [position?.x, position?.y, metadata.id])

  // Always use metadata.id as the source of truth
  const effectiveNodeId = metadata.id

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only start drag if not clicking on a port
    const target = e.target as HTMLElement
    if (target.closest('[data-port-id]') || target.hasAttribute('data-port-id')) {
      return
    }

    // Check if parent group is being dragged
    const groupContainer = nodeRef.current?.closest('[data-group-container]') as HTMLElement
    if (groupContainer && groupContainer.getAttribute('data-group-dragging') === 'true') {
      return // Don't allow node dragging while group is being dragged
    }

    e.preventDefault()
    e.stopPropagation()

    // Clear any previous hovering state when starting a new drag
    setHoveringGroupId(null)
    setIsDragging(true)

    // Get the canvas container to calculate offset
    const canvasElement = nodeRef.current?.closest('[data-canvas]') as HTMLElement
    const contentContainer = canvasElement?.querySelector('div[style*="transform"]') as HTMLElement

    let canvasOffset = { x: 0, y: 0 }
    let nodeScreenX = 0
    let nodeScreenY = 0

    if (isInGroup && groupContainer) {
      // For nodes in groups, calculate position relative to group container
      const groupRect = groupContainer.getBoundingClientRect()
      const nodeRect = nodeRef.current!.getBoundingClientRect()
      nodeScreenX = nodeRect.left
      nodeScreenY = nodeRect.top
    } else {
      // For ungrouped nodes, use canvas transform
      if (contentContainer) {
        // Extract offset from transform style
        const transform = contentContainer.style.transform
        const translateMatch = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/)
        if (translateMatch) {
          canvasOffset.x = parseFloat(translateMatch[1])
          canvasOffset.y = parseFloat(translateMatch[2])
        }
      }

      // Calculate the offset from mouse to node position accounting for canvas transform
      nodeScreenX = position.x * zoom + canvasOffset.x
      nodeScreenY = position.y * zoom + canvasOffset.y
    }

    const offsetX = e.clientX - nodeScreenX
    const offsetY = e.clientY - nodeScreenY

    let moved = false
    let finalPosition = position
    const initialEvent = e // Store the initial event for click handling

    // Notify drag start
    onDragStart?.(effectiveNodeId)

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      // Convert mouse position back to world coordinates
      let newPosition = { x: 0, y: 0 }

      if (isInGroup && groupContainer) {
        // For nodes in groups, calculate position relative to group
        const groupRect = groupContainer.getBoundingClientRect()
        const contentDiv = groupContainer.querySelector(
          '.absolute.left-0.right-0.bottom-0'
        ) as HTMLElement
        const contentRect = contentDiv?.getBoundingClientRect()

        if (contentRect) {
          newPosition = {
            x: (e.clientX - offsetX - contentRect.left) / zoom,
            y: (e.clientY - offsetY - contentRect.top) / zoom,
          }
        }
      } else {
        // For ungrouped nodes, use canvas coordinates
        newPosition = {
          x: (e.clientX - offsetX - canvasOffset.x) / zoom,
          y: (e.clientY - offsetY - canvasOffset.y) / zoom,
        }
      }

      // Check if we've moved enough to consider it a drag
      const deltaX = Math.abs(newPosition.x - position.x)
      const deltaY = Math.abs(newPosition.y - position.y)

      if (deltaX > 3 || deltaY > 3) {
        moved = true
      }

      // Check if node is hovering over any group (allow moving between groups)
      if (groups && groups.length > 0 && !isInGroup) {
        // Only check for group drops if node is not already in a group
        let foundGroupId: string | null = null

        // Node dimensions (approximate)
        const nodeWidth = 200 // Default node width
        const nodeHeight = 100 // Default node height

        // Check each group to see if the node overlaps
        for (const group of groups) {
          // Skip collapsed groups
          if (group.isCollapsed) continue

          // Check if node center is within group bounds
          const nodeCenterX = newPosition.x + nodeWidth / 2
          const nodeCenterY = newPosition.y + nodeHeight / 2

          const groupLeft = group.position.x
          const groupTop = group.position.y + 32 // Account for header
          const groupRight = group.position.x + group.size.width
          const groupBottom = group.position.y + group.size.height

          if (
            nodeCenterX >= groupLeft &&
            nodeCenterX <= groupRight &&
            nodeCenterY >= groupTop &&
            nodeCenterY <= groupBottom
          ) {
            foundGroupId = group.id
            break
          }
        }

        // Update hovering state if changed
        if (foundGroupId !== hoveringGroupId) {
          // Group hover changed
          setHoveringGroupId(foundGroupId)
          onNodeHoverGroup?.(foundGroupId)
        }
      }

      // Store the final position
      finalPosition = newPosition

      // For nodes in groups, apply constraints and handle boundaries
      if (isInGroup && currentGroup) {
        const nodeWidth = 200 // Approximate node width
        const nodeHeight = 100 // Approximate node height
        const minPadding = 10 // Minimum padding from edges
        const resizeThreshold = 20 // Distance from edge to trigger resize

        // Constrain position to prevent going beyond top/left edges
        const constrainedPosition = {
          x: Math.max(minPadding, newPosition.x),
          y: Math.max(minPadding, newPosition.y),
        }

        // Update final position with constraints
        finalPosition = constrainedPosition

        // Check if we need to resize the group (right/bottom only)
        if (onNodeNearGroupBoundary) {
          const now = Date.now()

          // Check right edge with throttling
          if (
            constrainedPosition.x + nodeWidth >
            (currentGroup.size?.width || 200) - resizeThreshold
          ) {
            if (now - lastResizeTime.current.right > throttleDelay) {
              const newWidth = constrainedPosition.x + nodeWidth + resizeThreshold
              onNodeNearGroupBoundary(effectiveNodeId, currentGroup.id, 'resize-right', newWidth)
              lastResizeTime.current.right = now
            }
          }

          // Check bottom edge with throttling
          if (
            constrainedPosition.y + nodeHeight >
            (currentGroup.size?.height || 150) - resizeThreshold
          ) {
            if (now - lastResizeTime.current.down > throttleDelay) {
              const contentTop = currentGroup.description ? 100 : 32
              const newHeight = constrainedPosition.y + nodeHeight + resizeThreshold + contentTop
              onNodeNearGroupBoundary(effectiveNodeId, currentGroup.id, 'resize-down', newHeight)
              lastResizeTime.current.down = now
            }
          }
        }

        // Update node position with constrained values
        onPositionChange?.(effectiveNodeId, constrainedPosition)
      } else {
        // Update node position normally for ungrouped nodes
        onPositionChange?.(effectiveNodeId, newPosition)
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      // Handle dropping into group (only for ungrouped nodes)
      // Only drop if we moved AND we're currently hovering over a group AND we're still dragging
      if (moved && hoveringGroupId && !isInGroup && isDragging) {
        // Dropping node into group
        onNodeDropIntoGroup?.(effectiveNodeId, hoveringGroupId)
      }

      // Clear hovering state
      if (hoveringGroupId) {
        setHoveringGroupId(null)
        onNodeHoverGroup?.(null)
      }

      // Clear dragging state
      setIsDragging(false)

      // Notify drag end with final position
      onDragEnd?.(effectiveNodeId, finalPosition)

      // Trigger click if we haven't moved (except for script nodes)
      if (!moved && onClick && metadata.type !== 'script') {
        onClick(effectiveNodeId, initialEvent)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const nodeStyle = isInGroup
    ? {
        // When in a group, use absolute positioning with left/top
        left: `${position.x}px`,
        top: `${position.y}px`,
        pointerEvents: 'auto' as const,
        userSelect: 'none' as const,
        touchAction: 'none' as const,
      }
    : {
        // When not in a group, use transform
        transform: `translate(${position.x}px, ${position.y}px)`,
        pointerEvents: 'auto' as const,
        userSelect: 'none' as const,
        touchAction: 'none' as const,
      }

  return (
    <div
      ref={nodeRef}
      onMouseDown={handleMouseDown}
      className={`absolute cursor-grab z-10`}
      data-node-id={metadata.id}
      data-draggable-node="true"
      data-hovering-group={hoveringGroupId || undefined}
      data-in-group={isInGroup}
      style={nodeStyle}
    >
      <WorkflowNode
        metadata={metadata}
        propertyValues={propertyValues}
        isHighlighted={isHighlighted}
        isSelected={isSelected}
        onPortPositionUpdate={onPortPositionUpdate}
        onPortDragStart={onPortDragStart}
        onPortDragEnd={onPortDragEnd}
        zoom={zoom}
        onPropertyChange={
          onPropertyChange
            ? (propertyName: string, value: any) =>
                onPropertyChange(effectiveNodeId, propertyName, value)
            : undefined
        }
        onSettingsClick={
          metadata.type === 'script' && onClick ? () => onClick(effectiveNodeId) : undefined
        }
        onSizeChange={() => {
          // Update bounds when size changes (only called when resize ends)
          if (nodeRef.current && onBoundsChange) {
            const rect = nodeRef.current.getBoundingClientRect()
            onBoundsChange(effectiveNodeId, {
              x: position.x,
              y: position.y,
              width: rect.width,
              height: rect.height,
            })
          }
        }}
      />
    </div>
  )
}
