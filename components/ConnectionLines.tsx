'use client'

import { useMemo } from 'react'
import { Connection, ConnectionState } from '@/types/workflow'
import { PortPosition } from '@/hooks/usePortPositions'
import { usePortPositionSubscription } from '@/hooks/usePortPositionSubscription'
import { useWorkflowStore } from '@/store/workflow-store'
import { useZipConnectionState } from '@/hooks/useZipConnectionState'

interface ConnectionLinesProps {
  connections: Connection[]
  getPortPosition: (nodeId: string, portId: string) => PortPosition | undefined
  onConnectionClick?: (connectionId: string) => void
  localGroupCollapseState?: Record<string, boolean>
  enableZipEvents?: boolean // Optional: Enable ZIP WebSocket event integration
}

// Get visual styles for connection states
function getConnectionStyles(state: ConnectionState = 'pending') {
  const baseStyles = {
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
  }

  switch (state) {
    case 'pending':
      return {
        ...baseStyles,
        stroke: '#6B7280', // Gray
        strokeDasharray: '5 5',
        shadowColor: 'rgba(107, 114, 128, 0.2)',
        glowEffect: false,
      }
    case 'warning':
      return {
        ...baseStyles,
        stroke: '#F59E0B', // Warm orange/amber
        strokeDasharray: 'none',
        shadowColor: 'rgba(245, 158, 11, 0.3)',
        glowEffect: true,
        glowColor: '#F59E0B',
      }
    case 'error':
      return {
        ...baseStyles,
        stroke: '#EF4444', // Red
        strokeDasharray: 'none',
        shadowColor: 'rgba(239, 68, 68, 0.3)',
        glowEffect: true,
        glowColor: '#EF4444',
      }
    case 'success':
      return {
        ...baseStyles,
        stroke: '#84CC16', // Lemon green
        strokeDasharray: 'none',
        shadowColor: 'rgba(132, 204, 22, 0.3)',
        glowEffect: true,
        glowColor: '#84CC16',
      }
    case 'running':
      return {
        ...baseStyles,
        stroke: '#3B82F6', // Blue
        strokeDasharray: '10 5',
        shadowColor: 'rgba(59, 130, 246, 0.4)',
        glowEffect: true,
        glowColor: '#3B82F6',
        animated: true,
      }
    default:
      // Default to pending style for any unknown state
      return {
        ...baseStyles,
        stroke: '#6B7280', // Gray
        strokeDasharray: '5 5',
        shadowColor: 'rgba(107, 114, 128, 0.2)',
        glowEffect: false,
      }
  }
}

// Calculate control point offset based on port position
function getControlPointOffset(position: 'top' | 'right' | 'bottom' | 'left'): {
  dx: number
  dy: number
} {
  const distance = 40 // Reduced from 100 to make curves tighter
  switch (position) {
    case 'top':
      return { dx: 0, dy: -distance }
    case 'right':
      return { dx: distance, dy: 0 }
    case 'bottom':
      return { dx: 0, dy: distance }
    case 'left':
      return { dx: -distance, dy: 0 }
  }
}

// Find intersection point between line and rectangle border
function findBorderIntersection(
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): { x: number; y: number } | null {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y

  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) return null

  const intersections: { x: number; y: number; t: number }[] = []

  // Check intersection with each edge
  const edges = [
    { start: { x: rect.x, y: rect.y }, end: { x: rect.x + rect.width, y: rect.y } }, // Top
    {
      start: { x: rect.x + rect.width, y: rect.y },
      end: { x: rect.x + rect.width, y: rect.y + rect.height },
    }, // Right
    {
      start: { x: rect.x + rect.width, y: rect.y + rect.height },
      end: { x: rect.x, y: rect.y + rect.height },
    }, // Bottom
    { start: { x: rect.x, y: rect.y + rect.height }, end: { x: rect.x, y: rect.y } }, // Left
  ]

  for (const edge of edges) {
    const edgeDx = edge.end.x - edge.start.x
    const edgeDy = edge.end.y - edge.start.y

    const denominator = dx * edgeDy - dy * edgeDx
    if (Math.abs(denominator) < 1e-10) continue // Lines are parallel

    const t =
      ((edge.start.x - lineStart.x) * edgeDy - (edge.start.y - lineStart.y) * edgeDx) / denominator
    const u = ((edge.start.x - lineStart.x) * dy - (edge.start.y - lineStart.y) * dx) / denominator

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      const intersectionX = lineStart.x + t * dx
      const intersectionY = lineStart.y + t * dy
      intersections.push({ x: intersectionX, y: intersectionY, t })
    }
  }

  // Return the closest intersection to the line start
  if (intersections.length === 0) return null

  intersections.sort((a, b) => a.t - b.t)
  return { x: intersections[0].x, y: intersections[0].y }
}

// Generate bezier curve path
function generatePath(source: PortPosition, target: PortPosition): string {
  // Default to 'right' and 'left' if position is undefined
  const sourceControl = getControlPointOffset(source.position || 'right')
  const targetControl = getControlPointOffset(target.position || 'left')

  const x1 = source.x
  const y1 = source.y
  const x2 = target.x
  const y2 = target.y

  const c1x = x1 + sourceControl.dx
  const c1y = y1 + sourceControl.dy
  const c2x = x2 + targetControl.dx
  const c2y = y2 + targetControl.dy

  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`
}

// Generate a clickable path that avoids node port areas
function generateClickablePath(source: PortPosition, target: PortPosition): string {
  // Default to 'right' and 'left' if position is undefined
  const sourceControl = getControlPointOffset(source.position || 'right')
  const targetControl = getControlPointOffset(target.position || 'left')

  // Start the path a bit away from the source port to avoid blocking it
  const portClearance = 30 // pixels to stay away from ports

  const x1 =
    source.x + (sourceControl.dx > 0 ? portClearance : sourceControl.dx < 0 ? -portClearance : 0)
  const y1 =
    source.y + (sourceControl.dy > 0 ? portClearance : sourceControl.dy < 0 ? -portClearance : 0)
  const x2 =
    target.x + (targetControl.dx > 0 ? portClearance : targetControl.dx < 0 ? -portClearance : 0)
  const y2 =
    target.y + (targetControl.dy > 0 ? portClearance : targetControl.dy < 0 ? -portClearance : 0)

  const c1x = source.x + sourceControl.dx
  const c1y = source.y + sourceControl.dy
  const c2x = target.x + targetControl.dx
  const c2y = target.y + targetControl.dy

  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`
}

// Check if a line segment intersects with a rectangle
function lineIntersectsRect(
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  // Check if line endpoints are inside the rectangle
  const startInside =
    lineStart.x >= rect.x &&
    lineStart.x <= rect.x + rect.width &&
    lineStart.y >= rect.y &&
    lineStart.y <= rect.y + rect.height

  const endInside =
    lineEnd.x >= rect.x &&
    lineEnd.x <= rect.x + rect.width &&
    lineEnd.y >= rect.y &&
    lineEnd.y <= rect.y + rect.height

  // If either endpoint is inside, line intersects
  if (startInside || endInside) return true

  // Check if line crosses any of the rectangle edges
  const rectLeft = rect.x
  const rectRight = rect.x + rect.width
  const rectTop = rect.y
  const rectBottom = rect.y + rect.height

  // Line-line intersection formula for each edge
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y

  // Helper function to check line-edge intersection
  const intersectsEdge = (
    edgeStart: { x: number; y: number },
    edgeEnd: { x: number; y: number }
  ): boolean => {
    const edgeDx = edgeEnd.x - edgeStart.x
    const edgeDy = edgeEnd.y - edgeStart.y

    const denominator = dx * edgeDy - dy * edgeDx
    if (Math.abs(denominator) < 1e-10) return false // Lines are parallel

    const t =
      ((edgeStart.x - lineStart.x) * edgeDy - (edgeStart.y - lineStart.y) * edgeDx) / denominator
    const u = ((edgeStart.x - lineStart.x) * dy - (edgeStart.y - lineStart.y) * dx) / denominator

    return t >= 0 && t <= 1 && u >= 0 && u <= 1
  }

  // Check intersection with all four edges
  return (
    intersectsEdge({ x: rectLeft, y: rectTop }, { x: rectRight, y: rectTop }) || // Top edge
    intersectsEdge({ x: rectRight, y: rectTop }, { x: rectRight, y: rectBottom }) || // Right edge
    intersectsEdge({ x: rectRight, y: rectBottom }, { x: rectLeft, y: rectBottom }) || // Bottom edge
    intersectsEdge({ x: rectLeft, y: rectBottom }, { x: rectLeft, y: rectTop }) // Left edge
  )
}

export function ConnectionLines({
  connections,
  getPortPosition,
  onConnectionClick,
  localGroupCollapseState = {},
  enableZipEvents = false, // Default to false for backward compatibility
}: ConnectionLinesProps) {
  // Subscribe to port position changes for immediate updates
  usePortPositionSubscription()

  // Get all groups to check for collapsed ones
  const groups = useWorkflowStore(state => state.groups)

  // Subscribe to ZIP WebSocket events for real-time connection states (only if enabled)
  const { connectionStates, isConnected } = useZipConnectionState({
    autoConnect: enableZipEvents,
    autoClear: true,
    successTimeout: 3000,
  })

  // Merge ZIP WebSocket states with connection data
  const enhancedConnections = useMemo(() => {
    // Only enhance if ZIP events are enabled and connected
    if (!enableZipEvents || !isConnected || Object.keys(connectionStates).length === 0) {
      return connections
    }
    
    return connections.map(conn => {
      const zipState = connectionStates[conn.id]
      if (zipState) {
        // Update the connection's state based on WebSocket events
        // This will trigger visual changes through getConnectionStyles
        return {
          ...conn,
          state: zipState.state, // This updates the visual state
          metadata: {
            ...conn.metadata,
            ...zipState.metadata,
            lastUpdate: zipState.lastUpdate,
          }
        }
      }
      return conn
    })
  }, [connections, connectionStates, isConnected, enableZipEvents])

  // TODO: Re-implement group dragging state in V2 store
  // For now, connections will remain visible during group drag

  // Check if we have port positions for connections that should render
  const connectionsWithPositions = enhancedConnections.filter(conn => {
    const sourcePos = getPortPosition(conn.source.nodeId, conn.source.portId)
    const targetPos = getPortPosition(conn.target.nodeId, conn.target.portId)
    return sourcePos && targetPos
  })

  // Only render connections that have both port positions available
  const connectionsToRender = connectionsWithPositions

  return (
    <svg
      className="absolute inset-0"
      style={{
        overflow: 'visible',
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      <defs>
        {/* Define glow filters for each state */}
        <filter id="glow-warning" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="glow-error" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="glow-success" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="glow-running" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {connectionsToRender.map(connection => {
        let source = getPortPosition(connection.source.nodeId, connection.source.portId)
        let target = getPortPosition(connection.target.nodeId, connection.target.portId)

        // // console.log removed

        // Handle missing port positions for nodes in collapsed groups
        if (!source || !target) {
          // Check if missing positions are due to collapsed groups
          let missingSource = !source
          let missingTarget = !target
          let fallbackSource = source
          let fallbackTarget = target

          // Find if the missing port positions are for nodes in collapsed groups
          for (const group of groups) {
            if (!localGroupCollapseState[group.id]) continue

            if (missingSource && group.nodeIds.includes(connection.source.nodeId)) {
              // Source node is in a collapsed group - we'll handle this in the group logic below
              fallbackSource = {
                nodeId: connection.source.nodeId,
                portId: connection.source.portId,
                x: 0,
                y: 0,
                position: 'right' as const,
              }
              missingSource = false
            }

            if (missingTarget && group.nodeIds.includes(connection.target.nodeId)) {
              // Target node is in a collapsed group - we'll handle this in the group logic below
              fallbackTarget = {
                nodeId: connection.target.nodeId,
                portId: connection.target.portId,
                x: 0,
                y: 0,
                position: 'left' as const,
              }
              missingTarget = false
            }
          }

          // If still missing positions and not in collapsed groups, skip this connection
          if (missingSource || missingTarget) {
            return null
          }

          // Use fallback positions
          source = fallbackSource!
          target = fallbackTarget!
        }

        // Check for collapsed group interactions
        let modifiedSource = source
        let modifiedTarget = target
        let shouldHide = false

        for (const group of groups) {
          if (!localGroupCollapseState[group.id]) continue

          const sourceInGroup = group.nodeIds.includes(connection.source.nodeId)
          const targetInGroup = group.nodeIds.includes(connection.target.nodeId)

          // Hide connections between nodes within the same collapsed group
          if (sourceInGroup && targetInGroup) {
            shouldHide = true
            break
          }

          const groupRect = {
            x: group.position.x,
            y: group.position.y,
            width: group.size.width,
            height: 40, // Use header height when collapsed
          }

          // Modify connection endpoints for external-to-internal connections
          if (sourceInGroup && !targetInGroup) {
            // Source is inside collapsed group, target is outside
            // Check if this is a fallback position (x: 0, y: 0) from initial load
            const isFallbackPosition = source.x === 0 && source.y === 0

            if (!isFallbackPosition) {
              const intersection = findBorderIntersection(
                { x: target.x, y: target.y },
                { x: source.x, y: source.y },
                groupRect
              )
              if (intersection) {
                modifiedSource = { ...source, x: intersection.x, y: intersection.y }
              } else {
                // Fallback: always use right edge for outgoing connections from collapsed group
                const groupCenterY = groupRect.y + groupRect.height / 2
                const edgeX = groupRect.x + groupRect.width // Always use right edge for outgoing connections
                const edgeY = groupCenterY

                modifiedSource = { ...source, x: edgeX, y: edgeY }
              }
            } else {
              // If using fallback position, always use right edge for outgoing connections from collapsed group
              const groupCenterY = groupRect.y + groupRect.height / 2
              const edgeX = groupRect.x + groupRect.width // Always use right edge for outgoing connections
              const edgeY = groupCenterY

              modifiedSource = { ...source, x: edgeX, y: edgeY }
            }
          } else if (!sourceInGroup && targetInGroup) {
            // Target is inside collapsed group, source is outside
            const intersection = findBorderIntersection(
              { x: source.x, y: source.y },
              { x: target.x, y: target.y },
              groupRect
            )
            if (intersection) {
              modifiedTarget = { ...target, x: intersection.x, y: intersection.y }
            } else {
              // Fallback: determine best edge based on source position relative to group
              const groupCenterX = groupRect.x + groupRect.width / 2
              const groupCenterY = groupRect.y + groupRect.height / 2

              // Calculate which edge is closest to the source
              const sourceRelativeToGroup = {
                x: source.x - groupCenterX,
                y: source.y - groupCenterY,
              }

              let edgeX, edgeY
              if (Math.abs(sourceRelativeToGroup.x) > Math.abs(sourceRelativeToGroup.y)) {
                // Source is more horizontal from group - use left or right edge
                if (sourceRelativeToGroup.x > 0) {
                  // Source is to the right - use right edge
                  edgeX = groupRect.x + groupRect.width
                  edgeY = groupCenterY
                } else {
                  // Source is to the left - use left edge
                  edgeX = groupRect.x
                  edgeY = groupCenterY
                }
              } else {
                // Source is more vertical from group - use top or bottom edge
                if (sourceRelativeToGroup.y > 0) {
                  // Source is below - use bottom edge
                  edgeX = groupCenterX
                  edgeY = groupRect.y + groupRect.height
                } else {
                  // Source is above - use top edge
                  edgeX = groupCenterX
                  edgeY = groupRect.y
                }
              }

              modifiedTarget = { ...target, x: edgeX, y: edgeY }
            }
          } else if (!sourceInGroup && !targetInGroup) {
            // Check if line crosses the collapsed group
            if (
              lineIntersectsRect(
                { x: source.x, y: source.y },
                { x: target.x, y: target.y },
                groupRect
              )
            ) {
              shouldHide = true
              break
            }
          }
        }

        if (shouldHide) {
          return null
        }

        const path = generatePath(modifiedSource, modifiedTarget)
        const clickablePath = generateClickablePath(modifiedSource, modifiedTarget)
        const styles = getConnectionStyles(connection.state || 'pending')
        const filterId = styles?.glowEffect ? `glow-${connection.state}` : undefined

        return (
          <g key={connection.id} className="group">
            {/* Shadow effect */}
            <path
              d={path}
              fill="none"
              stroke={styles.shadowColor}
              strokeWidth="4"
              strokeLinecap={styles.strokeLinecap}
              strokeDasharray={styles.strokeDasharray}
              pointerEvents="none"
              className="group-hover:opacity-0 transition-opacity duration-200"
              style={
                connection.state === 'running'
                  ? {
                      strokeDashoffset: 0,
                      animation: 'dash-flow 1s linear infinite',
                    }
                  : undefined
              }
            />

            {/* Main connection line */}
            <path
              d={path}
              fill="none"
              stroke={styles.stroke}
              strokeWidth={styles.strokeWidth}
              strokeLinecap={styles.strokeLinecap}
              strokeDasharray={styles.strokeDasharray}
              filter={filterId ? `url(#${filterId})` : undefined}
              pointerEvents="none"
              className="group-hover:opacity-0 transition-opacity duration-200"
              style={
                connection.state === 'running'
                  ? {
                      strokeDashoffset: 0,
                      animation: 'dash-flow 1s linear infinite',
                    }
                  : undefined
              }
            />

            {/* Additional glow effect for success/warning/error states */}
            {styles.glowEffect && 'glowColor' in styles && (
              <path
                d={path}
                fill="none"
                stroke={styles.glowColor}
                strokeWidth="1"
                strokeLinecap={styles.strokeLinecap}
                opacity="0.6"
                filter={filterId ? `url(#${filterId})` : undefined}
                pointerEvents="none"
                className="group-hover:opacity-0 transition-opacity duration-200"
              />
            )}

            {/* Hover overlay - black solid line */}
            <path
              d={path}
              fill="none"
              stroke="black"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0"
              pointerEvents="none"
              className="group-hover:opacity-100 transition-opacity duration-200"
            />

            {/* Invisible clickable path that avoids port areas */}
            <path
              d={clickablePath}
              fill="none"
              stroke="transparent"
              strokeWidth="8"
              strokeLinecap="round"
              style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
              onClick={e => {
                e.stopPropagation()
                onConnectionClick?.(connection.id)
              }}
            />
          </g>
        )
      })}
    </svg>
  )
}
