'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { NodeGroup } from '@/types/workflow'
import { useWorkflowStore } from '@/store/workflow-store'
import { Edit2, Trash2 } from 'lucide-react'
import { NodeMetadata } from '@/types/workflow'

// Calculate node dimensions based on actual DOM measurements or stored bounds
// Returns dimensions in LOGICAL coordinates (not screen coordinates)
const calculateNodeDimensions = (
  metadata: NodeMetadata,
  nodeBounds?: Map<string, { x: number; y: number; width: number; height: number }>,
  zoom: number = 1
): { width: number; height: number } => {
  // First, try to use stored bounds if available
  // Assuming nodeBounds stores logical dimensions
  if (nodeBounds && nodeBounds.has(metadata.id)) {
    const bounds = nodeBounds.get(metadata.id)!
    return { width: bounds.width, height: bounds.height }
  }

  // Otherwise, try to get actual DOM measurements from the draggable node
  const nodeElement = document.querySelector(`[data-node-id="${metadata.id}"]`)
  if (nodeElement) {
    const rect = nodeElement.getBoundingClientRect()
    // Convert from screen coordinates to logical coordinates
    return { width: rect.width / zoom, height: rect.height / zoom }
  }

  // Fallback to reasonable dimensions based on node type if element not found
  // These are already in logical coordinates
  const nodeType = metadata.type || 'default'

  let fallbackHeight = 120 // Default height
  if (nodeType.includes('ai') || nodeType.includes('model')) {
    fallbackHeight = 180 // AI nodes are typically taller
  } else if (nodeType.includes('input') || nodeType.includes('output')) {
    fallbackHeight = 100 // I/O nodes are usually shorter
  } else if (nodeType.includes('process') || nodeType.includes('transform')) {
    fallbackHeight = 140 // Processing nodes are medium height
  }

  return { width: 200, height: fallbackHeight }
}

interface NodeGroupContainerProps {
  group: NodeGroup
  children: React.ReactNode
  isCollapsed: boolean
  onCollapseToggle: (groupId: string) => void
  isDropTarget?: boolean
  onEditClick?: (groupId: string) => void
  onDeleteClick?: (groupId: string) => void
  zoom?: number
  nodePositions?: Record<string, { x: number; y: number }> // Local node positions
  nodeBounds?: Map<string, { x: number; y: number; width: number; height: number }> // Node bounds from useNodeBounds hook
  onGroupResize?: (groupId: string, newSize: { width: number; height: number }) => void // Callback for resize
  onContainerReady?: (groupId: string) => void // Callback when container is ready to render children
}

export const NodeGroupContainer = React.memo(
  function NodeGroupContainer({
    group,
    children,
    isCollapsed,
    onCollapseToggle,
    isDropTarget = false,
    onEditClick,
    onDeleteClick,
    zoom = 1,
    nodePositions = {},
    nodeBounds,
    onGroupResize,
    onContainerReady,
  }: NodeGroupContainerProps) {
    // Memoize group data to prevent unnecessary re-renders
    const groupId = group?.id
    const groupPosition = group?.position
    const groupSize = group?.size
    // Use local isCollapsed prop instead of synced group.isCollapsed
    const groupDescription = group?.description
    const groupTitle = group?.title
    const groupColor = group?.color
    const groupNodeIds = group?.nodeIds || []

    // All hooks must be declared before any early returns
    const lastValidPosition = useRef<{ x: number; y: number } | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [localPosition, setLocalPosition] = useState<{ x: number; y: number } | null>(null)
    const [isContainerReady, setIsContainerReady] = useState(false)
    const lastUpdateTime = useRef<number>(0)
    const finalPosition = useRef<{ x: number; y: number } | null>(null)
    const [dragStart, setDragStart] = useState<{
      x: number
      y: number
      initialGroupX: number
      initialGroupY: number
    } | null>(null)
    const [resizeStart, setResizeStart] = useState<{
      x: number
      y: number
      width: number
      height: number
    } | null>(null)
    const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [hideConnectionLines, setHideConnectionLines] = useState(false)
    const [localSize, setLocalSize] = useState<{ width: number; height: number } | null>(null)
    const finalSize = useRef<{ width: number; height: number } | null>(null)
    const hasNotifiedReady = useRef<boolean>(false)

    const {
      updateGroupBounds,
      updateNodePosition,
      updateNodePositionInGroup,
      nodes,
      currentGraphId,
      setGraphDirty,
    } = useWorkflowStore()

    // Update last valid position when we get a good one
    useEffect(() => {
      if (
        groupPosition &&
        typeof groupPosition.x === 'number' &&
        typeof groupPosition.y === 'number'
      ) {
        lastValidPosition.current = { ...groupPosition }
      }
    }, [groupPosition?.x, groupPosition?.y])

    // Handle node position synchronization locally
    useEffect(() => {
      if (!group || !nodes || !nodePositions || isCollapsed) return

      // Check each node in this group
      group.nodeIds.forEach(nodeId => {
        const node = nodes.find(n => n.metadata.id === nodeId)
        if (!node) return

        const localPosition = nodePositions[nodeId]
        if (localPosition) {
          // Calculate expected absolute position based on local position
          const headerOffset = group.description ? 100 : 32
          const expectedAbsolutePos = {
            x: group.position.x + localPosition.x,
            y: group.position.y + headerOffset + localPosition.y,
          }

          // Check if current position matches expected
          const currentPos = node.position
          if (
            currentPos &&
            (Math.abs(currentPos.x - expectedAbsolutePos.x) > 1 ||
              Math.abs(currentPos.y - expectedAbsolutePos.y) > 1)
          ) {
            // Update to correct position
            updateNodePosition(nodeId, expectedAbsolutePos)
          }
        }
      })
    }, [group, nodes, nodePositions, isCollapsed, updateNodePosition])

    // Initialize node positions for nodes that don't have stored positions
    useEffect(() => {
      if (!group || !nodes || !isContainerReady) return

      // Use a timeout to ensure we don't run this during rapid state changes
      const timeoutId = setTimeout(() => {
        let hasUpdates = false

        group.nodeIds.forEach(nodeId => {
          // Check if this node already has a stored position
          if (group.nodePositions?.[nodeId]) return

          // Find the node
          const node = nodes.find(n => n.metadata.id === nodeId)
          if (!node || !node.position) return

          // Calculate relative position from absolute position
          const nodePos = node.position
          const groupPos = group.position || { x: 0, y: 0 }
          const headerOffset = group.description ? 100 : 32

          const relativePosition = {
            x: nodePos.x - groupPos.x,
            y: nodePos.y - groupPos.y - headerOffset,
          }

          // Store the position in CRDT
          updateNodePositionInGroup(group.id, nodeId, relativePosition)
          hasUpdates = true
        })

        // Mark graph as dirty only once if we made any updates
        if (hasUpdates) {
          setGraphDirty(currentGraphId, true)
        }
      }, 300)

      return () => clearTimeout(timeoutId)
    }, [group, nodes, isContainerReady, updateNodePositionInGroup, setGraphDirty, currentGraphId])

    // Preserve position stability during collapse/expand transitions
    const stablePositionRef = useRef<{ x: number; y: number } | null>(null)

    // Always keep the most recent valid position
    useEffect(() => {
      if (
        groupPosition &&
        typeof groupPosition.x === 'number' &&
        typeof groupPosition.y === 'number'
      ) {
        stablePositionRef.current = { ...groupPosition }
      }
    }, [groupPosition?.x, groupPosition?.y])

    // During state transitions, ensure we maintain position stability
    const [isTransitioning, setIsTransitioning] = useState(false)
    const transitionPositionRef = useRef<{ x: number; y: number } | null>(null)

    useEffect(() => {
      // Capture current position BEFORE the collapse state change affects anything
      const currentPos = groupPosition || lastValidPosition.current || stablePositionRef.current
      if (currentPos && typeof currentPos.x === 'number' && typeof currentPos.y === 'number') {
        transitionPositionRef.current = { ...currentPos }
      }

      // Mark as transitioning briefly to use the captured position
      setIsTransitioning(true)
      // Use a very short timeout since we removed CSS transitions
      const timeout = setTimeout(() => {
        setIsTransitioning(false)
        transitionPositionRef.current = null // Clear after transition
      }, 50) // Short timeout since no CSS animation

      return () => clearTimeout(timeout)
    }, [isCollapsed, groupId])

    // Debug logging to track prop changes

    // Ensure group has required properties before rendering
    if (!groupId) {
      // Group has no ID, not rendering
      return null
    }

    // Additional validation with warnings instead of returning null
    if (!groupPosition || !groupSize) {
      // Group missing position or size, using defaults
    }

    // Extra validation for position values
    if (
      groupPosition &&
      (typeof groupPosition.x !== 'number' || typeof groupPosition.y !== 'number')
    ) {
      // Group position has invalid values, using defaults
    }

    // Container ready logic - run once per group
    useEffect(() => {
      // Reset state for new group
      hasNotifiedReady.current = false
      setIsContainerReady(false)
      
      // Set ready after a minimal delay to ensure DOM is updated
      const timer = setTimeout(() => {
        if (!hasNotifiedReady.current) {
          hasNotifiedReady.current = true
          setIsContainerReady(true)
          
          // Notify parent that container is ready
          if (onContainerReady) {
            onContainerReady(groupId)
          }
        }
      }, 10) // Very small delay just for DOM update
      
      return () => clearTimeout(timer)
    }, [groupId, onContainerReady])

    // Clear local position when group props change from CRDT, but only if not actively dragging
    useEffect(() => {
      if (!isDragging && !isResizing && localPosition && groupPosition) {
        // Check if CRDT position is significantly different from our local position
        const deltaX = Math.abs((groupPosition.x || 0) - localPosition.x)
        const deltaY = Math.abs((groupPosition.y || 0) - localPosition.y)

        // If CRDT position is different (tolerance for floating point), sync to it
        if (deltaX > 1 || deltaY > 1) {
          // console.log removed
          // Clear local position to use CRDT position
          setLocalPosition(null)
        }
      }
    }, [groupPosition?.x, groupPosition?.y, isDragging, isResizing, localPosition, groupId])

    // Don't clear local size anymore - we want to keep it local
    // Only sync size when nodes are added/removed (handled elsewhere)

    // Store dragging state in a data attribute so child nodes can detect it
    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.setAttribute('data-group-dragging', isDragging.toString())
      }
    }, [isDragging])

    // Handle group dragging
    const handleMouseDown = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement

      // Check if we clicked on a button or interactive element first
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return
      }

      // Since this handler is on the header div, we know we're in the header area
      // No need to check for .group-header class
      e.preventDefault()
      e.stopPropagation() // Prevent canvas selection

      setIsDragging(true)
      setHideConnectionLines(true) // Hide connection lines during drag

      // Use current visual position (localPosition if active, otherwise CRDT position)
      const currentX = localPosition?.x ?? groupPosition?.x ?? 0
      const currentY = localPosition?.y ?? groupPosition?.y ?? 0

      setDragStart({
        x: e.clientX,
        y: e.clientY,
        initialGroupX: currentX,
        initialGroupY: currentY,
      })
    }

    const handleMouseUp = useCallback(() => {
      // Force a final position update to CRDT
      if (isDragging && finalPosition.current && dragStart) {
        try {
          // Update group bounds (position) - this will also update member node absolute positions
          updateGroupBounds(groupId, { x: finalPosition.current.x, y: finalPosition.current.y })

          setGraphDirty(currentGraphId, true)
          finalPosition.current = null // Clear the stored position
        } catch (error) {
          // Error updating group bounds
        }
      }

      // Only update local size, not CRDT
      if (isResizing && finalSize.current) {
        try {
          // Update the stored expanded size locally only
          if (onGroupResize) {
            onGroupResize(groupId, finalSize.current)
          }

          finalSize.current = null // Clear the stored size
        } catch (error) {
          // Error updating group size
        }
      }

      setIsDragging(false)
      setIsResizing(false)
      setDragStart(null)
      setResizeStart(null)
      setLocalSize(null) // Clear local size

      // Don't clear local position immediately - let the sync detection handle it

      // Re-enable connection lines after a brief delay to allow DOM to update
      setTimeout(() => {
        setHideConnectionLines(false)

        // Trigger port position re-measurement for all nodes in this group
        const groupMoveEvent = new CustomEvent('groupPositionChanged', {
          bubbles: true,
          detail: { groupId: groupId },
        })
        if (containerRef.current) {
          containerRef.current.dispatchEvent(groupMoveEvent)
        }
      }, 50)
    }, [
      groupId,
      isDragging,
      isResizing,
      dragStart,
      updateGroupBounds,
      currentGraphId,
      setGraphDirty,
      onGroupResize,
    ])

    // Handle resize from bottom-right corner
    const handleResizeMouseDown = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // console.log removed
      setIsResizing(true)
      setHideConnectionLines(true) // Hide connection lines during resize too
      const startSize = {
        width: groupSize?.width || 200,
        height: groupSize?.height || 150,
      }
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        ...startSize,
      })
      // console.log removed
    }

    useEffect(() => {
      if (!isDragging && !isResizing) return

      let animationFrameId: number | null = null

      const handleMouseMove = (e: MouseEvent) => {
        // Cancel any pending animation frame
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
        }

        // Schedule update on next animation frame for smooth movement
        animationFrameId = requestAnimationFrame(() => {
          if (isDragging && dragStart) {
            const deltaX = (e.clientX - dragStart.x) / zoom
            const deltaY = (e.clientY - dragStart.y) / zoom
            const newX = dragStart.initialGroupX + deltaX
            const newY = dragStart.initialGroupY + deltaY

            // Store the final position for later use
            finalPosition.current = { x: newX, y: newY }

            // Update local position immediately for visual feedback
            setLocalPosition({ x: newX, y: newY })

            // Don't update CRDT during drag to prevent rubber-band effect
            // Only store the final position for later sync
          }

          if (isResizing && resizeStart) {
            // Calculate minimum size based on member nodes
            const memberNodes = nodes.filter(node => groupNodeIds.includes(node.metadata.id))

            let minWidth = 200 // Default minimum
            let minHeight = 150 // Default minimum

            // Only calculate bounds if container is ready and nodes are rendered
            if (memberNodes.length > 0 && isContainerReady && !isCollapsed) {
              // Find the rightmost and bottommost edges of all nodes
              let maxRight = 0
              let maxBottom = 0

              memberNodes.forEach(node => {
                const nodeId = node.metadata.id

                // Use stored position if available, otherwise calculate from absolute
                let relativeX, relativeY
                if (group.nodePositions?.[nodeId]) {
                  // Use CRDT stored positions
                  relativeX = group.nodePositions[nodeId].x
                  relativeY = group.nodePositions[nodeId].y
                } else if (nodePositions[nodeId]) {
                  // Use local positions
                  relativeX = nodePositions[nodeId].x
                  relativeY = nodePositions[nodeId].y
                } else {
                  // Fallback to calculating from absolute position
                  const headerOffset = groupDescription ? 100 : 32
                  relativeX = (node.position?.x || 0) - (groupPosition?.x || 0)
                  relativeY = (node.position?.y || 0) - (groupPosition?.y || 0) - headerOffset
                }

                // Get node dimensions in logical coordinates
                const { width: nodeWidth, height: nodeHeight } = calculateNodeDimensions(
                  node.metadata,
                  nodeBounds,
                  zoom
                )

                // Dimensions are already in logical coordinates
                maxRight = Math.max(maxRight, relativeX + nodeWidth)
                maxBottom = Math.max(maxBottom, relativeY + nodeHeight)
              })

              // Add padding - account for initial left padding (20px) in the total width
              const paddingLeft = 20 // Initial padding when nodes are placed
              const paddingRight = 220 // Increased by 60
              const paddingBottom = 140
              // Total width should include left padding since node positions start at paddingLeft
              minWidth = Math.max(200, maxRight + paddingRight + paddingLeft)
              minHeight = Math.max(150, maxBottom + paddingBottom)
            }

            const deltaX = (e.clientX - resizeStart.x) / zoom
            const deltaY = (e.clientY - resizeStart.y) / zoom

            const newWidth = Math.max(minWidth, resizeStart.width + deltaX)
            const newHeight = Math.max(minHeight, resizeStart.height + deltaY)

            // Store the final size for later use
            finalSize.current = { width: newWidth, height: newHeight }

            // Update local size immediately for visual feedback
            setLocalSize({ width: newWidth, height: newHeight })

            // Don't update CRDT during resize to prevent flicker
            // Size will be synced on mouse up
          }
        })
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
        }
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }, [
      isDragging,
      isResizing,
      dragStart,
      resizeStart,
      groupId,
      handleMouseUp,
      zoom,
      currentGraphId,
      nodes,
      groupPosition?.x,
      groupPosition?.y,
      groupDescription,
      groupNodeIds,
      nodePositions,
      nodeBounds,
      isContainerReady,
      isCollapsed,
      group,
    ])

    // Calculate position with stability during transitions
    // During transitions, prioritize stable position over potentially invalid CRDT position
    let xPos: number
    let yPos: number
    let positionSource = ''

    if (isTransitioning && transitionPositionRef.current) {
      // PRIORITY: During collapse/expand transitions, use the captured position to prevent jumping
      xPos = transitionPositionRef.current.x
      yPos = transitionPositionRef.current.y
      positionSource = 'transitionPosition'
    } else if (localPosition && isDragging) {
      // Use local position ONLY during active dragging (not during collapse/expand)
      xPos = localPosition.x
      yPos = localPosition.y
      positionSource = 'localPosition'
    } else if (
      groupPosition &&
      typeof groupPosition.x === 'number' &&
      typeof groupPosition.y === 'number'
    ) {
      // Use CRDT position when available and valid
      xPos = groupPosition.x
      yPos = groupPosition.y
      positionSource = 'groupPosition'
    } else if (lastValidPosition.current) {
      // Fallback to last known good position
      xPos = lastValidPosition.current.x
      yPos = lastValidPosition.current.y
      positionSource = 'lastValidPosition'
    } else if (stablePositionRef.current) {
      // Fallback to stable position
      xPos = stablePositionRef.current.x
      yPos = stablePositionRef.current.y
      positionSource = 'stablePosition'
    } else {
      // Last resort fallback - this should rarely happen
      xPos = 100
      yPos = 100
      positionSource = 'hardcoded_fallback'
    }

    // Log if position is invalid but still render with fallback
    if (
      !groupPosition ||
      typeof groupPosition.x !== 'number' ||
      typeof groupPosition.y !== 'number'
    ) {
      // Group has invalid position, using fallback
    }

    // Log when collapsed state changes
    useEffect(() => {
      // console.log removed
    }, [isCollapsed, xPos, yPos, groupId, groupPosition, localPosition])

    return (
      <div
        ref={containerRef}
        className={`absolute border-2 border-dashed border-gray-400 bg-gray-50/30 rounded-lg pointer-events-auto ${
          isCollapsed ? 'border-gray-600 bg-gray-100/50' : ''
        } ${isDragging ? 'shadow-2xl border-blue-500' : ''} ${
          isDropTarget && !isCollapsed
            ? 'border-blue-500 bg-blue-50/40 shadow-lg ring-2 ring-blue-300 ring-opacity-50'
            : ''
        }`}
        style={{
          transform: `translate(${xPos}px, ${yPos}px)`,
          width:
            localSize && isResizing
              ? Math.max(100, localSize.width)
              : Math.max(100, groupSize?.width || 200),
          height: isCollapsed
            ? 40
            : localSize && isResizing
              ? Math.max(80, localSize.height)
              : Math.max(80, groupSize?.height || 150),
          zIndex: 0, // Behind nodes
          borderColor: groupColor || '#9CA3AF',
          cursor: isDragging ? 'grabbing' : 'default',
          willChange: isDragging || isResizing ? 'transform' : 'auto',
          // Ensure visibility
          minWidth: '100px',
          minHeight: isCollapsed ? '40px' : '80px',
        }}
        data-group-container="true"
      >
        {/* Drop Target Indicator */}
        {isDropTarget && !isCollapsed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-blue-500 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg animate-pulse">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Group Header */}
        <div
          className="group-header absolute top-0 left-0 right-0 h-8 bg-white/90 backdrop-blur-sm border-b border-gray-300 rounded-t-lg cursor-move flex items-center justify-between px-3 z-50 pointer-events-auto"
          onMouseDown={handleMouseDown}
          onDoubleClick={e => {
            e.stopPropagation()
            onEditClick?.(groupId)
          }}
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">{groupTitle}</h3>
          </div>

          <div className="flex items-center gap-1">
            {/* Edit button */}
            <button
              className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors"
              onClick={e => {
                e.stopPropagation()
                onEditClick?.(groupId)
              }}
              onMouseDown={e => e.stopPropagation()}
              title="Edit group"
            >
              <Edit2 className="w-3 h-3" />
            </button>

            {/* Delete button */}
            <button
              className="text-gray-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
              onClick={e => {
                e.stopPropagation()
                onDeleteClick?.(groupId)
              }}
              onMouseDown={e => e.stopPropagation()}
              title="Delete group"
            >
              <Trash2 className="w-3 h-3" />
            </button>

            {/* Collapse/Expand button */}
            <button
              className="text-gray-500 hover:text-gray-700 text-xs p-1 rounded hover:bg-gray-100 pointer-events-auto relative z-50"
              onClick={e => {
                e.stopPropagation()
                onCollapseToggle(groupId)

                // Trigger port position updates after a short delay to ensure the UI has updated
                setTimeout(() => {
                  const portUpdateEvent = new CustomEvent('groupCollapseChanged', {
                    bubbles: true,
                    detail: { groupId, isCollapsed: !isCollapsed },
                  })
                  if (containerRef.current) {
                    containerRef.current.dispatchEvent(portUpdateEvent)
                  }
                }, 100)
              }}
              onMouseDown={e => {
                e.preventDefault()
                e.stopPropagation()
              }}
              title={isCollapsed ? 'Expand group' : 'Collapse group'}
            >
              {isCollapsed ? '▼' : '▲'}
            </button>

            {/* Node count */}
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
              {groupNodeIds.length}
            </span>
          </div>
        </div>

        {/* Group Content */}

        <>
          {/* Description */}
          {groupDescription && (
            <div
              className={`absolute top-8 left-0 right-0 px-3 py-2 bg-white/60 backdrop-blur-sm  ${isCollapsed ? 'border-b-2 border-l-2 border-r-2 rounded-b-md border-dashed border-gray-400' : 'border-b border-gray-200'}`}
            >
              <p className="text-xs text-gray-600 line-clamp-2">{groupDescription}</p>
            </div>
          )}
          {!isCollapsed && (
            <>
              {/* Children nodes will be rendered here by the parent - only when container is ready */}
              <div
                className="absolute left-0 right-0 bottom-0"
                style={{
                  top: groupDescription ? 100 : 32,
                }}
              >
                {/* Render children immediately - container positioning is handled by CSS transforms */}
                {children}
              </div>

              {/* Resize handle */}
              <div
                className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize bg-gray-400/70 hover:bg-blue-500 rounded-tl-md transition-colors z-50"
                onMouseDown={handleResizeMouseDown}
                title="Drag to resize"
              >
                <div className="absolute bottom-1 right-1 w-2 h-2">
                  <div className="w-full h-px bg-gray-600"></div>
                  <div className="w-px h-full bg-gray-600 ml-1 -mt-px"></div>
                </div>
              </div>
            </>
          )}
        </>
      </div>
    )
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    // Only re-render if specific props actually changed
    return (
      prevProps.group?.id === nextProps.group?.id &&
      prevProps.group?.title === nextProps.group?.title &&
      prevProps.group?.description === nextProps.group?.description &&
      prevProps.group?.position?.x === nextProps.group?.position?.x &&
      prevProps.group?.position?.y === nextProps.group?.position?.y &&
      prevProps.group?.size?.width === nextProps.group?.size?.width &&
      prevProps.group?.size?.height === nextProps.group?.size?.height &&
      prevProps.group?.color === nextProps.group?.color &&
      prevProps.isCollapsed === nextProps.isCollapsed &&
      prevProps.isDropTarget === nextProps.isDropTarget &&
      prevProps.zoom === nextProps.zoom &&
      // Deep compare nodePositions
      JSON.stringify(prevProps.nodePositions) === JSON.stringify(nextProps.nodePositions) &&
      // Compare nodeBounds by size
      prevProps.nodeBounds?.size === nextProps.nodeBounds?.size
    )
  }
)
