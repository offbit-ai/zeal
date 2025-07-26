'use client'

import { Connection, ConnectionState } from '@/types/workflow'
import { PortPosition } from '@/hooks/usePortPositions'
import { usePortPositionSubscription } from '@/hooks/usePortPositionSubscription'
import { useWorkflowStore } from '@/store/workflowStore'

interface ConnectionLinesProps {
  connections: Connection[]
  getPortPosition: (nodeId: string, portId: string) => PortPosition | undefined
  onConnectionClick?: (connectionId: string) => void
}

// Get visual styles for connection states
function getConnectionStyles(state: ConnectionState = 'pending') {
  const baseStyles = {
    strokeWidth: 2,
    strokeLinecap: 'round' as const
  }
  
  switch (state) {
    case 'pending':
      return {
        ...baseStyles,
        stroke: '#6B7280', // Gray
        strokeDasharray: '5 5',
        shadowColor: 'rgba(107, 114, 128, 0.2)',
        glowEffect: false
      }
    case 'warning':
      return {
        ...baseStyles,
        stroke: '#F59E0B', // Warm orange/amber
        strokeDasharray: 'none',
        shadowColor: 'rgba(245, 158, 11, 0.3)',
        glowEffect: true,
        glowColor: '#F59E0B'
      }
    case 'error':
      return {
        ...baseStyles,
        stroke: '#EF4444', // Red
        strokeDasharray: 'none',
        shadowColor: 'rgba(239, 68, 68, 0.3)',
        glowEffect: true,
        glowColor: '#EF4444'
      }
    case 'success':
      return {
        ...baseStyles,
        stroke: '#84CC16', // Lemon green
        strokeDasharray: 'none',
        shadowColor: 'rgba(132, 204, 22, 0.3)',
        glowEffect: true,
        glowColor: '#84CC16'
      }
  }
}

// Calculate control point offset based on port position
function getControlPointOffset(position: 'top' | 'right' | 'bottom' | 'left'): { dx: number; dy: number } {
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
    { start: { x: rect.x + rect.width, y: rect.y }, end: { x: rect.x + rect.width, y: rect.y + rect.height } }, // Right
    { start: { x: rect.x + rect.width, y: rect.y + rect.height }, end: { x: rect.x, y: rect.y + rect.height } }, // Bottom
    { start: { x: rect.x, y: rect.y + rect.height }, end: { x: rect.x, y: rect.y } } // Left
  ]
  
  for (const edge of edges) {
    const edgeDx = edge.end.x - edge.start.x
    const edgeDy = edge.end.y - edge.start.y
    
    const denominator = dx * edgeDy - dy * edgeDx
    if (Math.abs(denominator) < 1e-10) continue // Lines are parallel
    
    const t = ((edge.start.x - lineStart.x) * edgeDy - (edge.start.y - lineStart.y) * edgeDx) / denominator
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
  const sourceControl = getControlPointOffset(source.position)
  const targetControl = getControlPointOffset(target.position)

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

// Check if a line segment intersects with a rectangle
function lineIntersectsRect(
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  // Check if line endpoints are inside the rectangle
  const startInside = 
    lineStart.x >= rect.x && lineStart.x <= rect.x + rect.width &&
    lineStart.y >= rect.y && lineStart.y <= rect.y + rect.height
  
  const endInside = 
    lineEnd.x >= rect.x && lineEnd.x <= rect.x + rect.width &&
    lineEnd.y >= rect.y && lineEnd.y <= rect.y + rect.height
  
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
    
    const t = ((edgeStart.x - lineStart.x) * edgeDy - (edgeStart.y - lineStart.y) * edgeDx) / denominator
    const u = ((edgeStart.x - lineStart.x) * dy - (edgeStart.y - lineStart.y) * dx) / denominator
    
    return t >= 0 && t <= 1 && u >= 0 && u <= 1
  }
  
  // Check intersection with all four edges
  return (
    intersectsEdge({ x: rectLeft, y: rectTop }, { x: rectRight, y: rectTop }) ||     // Top edge
    intersectsEdge({ x: rectRight, y: rectTop }, { x: rectRight, y: rectBottom }) || // Right edge
    intersectsEdge({ x: rectRight, y: rectBottom }, { x: rectLeft, y: rectBottom }) || // Bottom edge
    intersectsEdge({ x: rectLeft, y: rectBottom }, { x: rectLeft, y: rectTop })      // Left edge
  )
}

export function ConnectionLines({ connections, getPortPosition, onConnectionClick }: ConnectionLinesProps) {
  // Subscribe to port position changes for immediate updates
  usePortPositionSubscription()
  
  // Get group dragging state to hide connections during drag
  const isGroupDragging = useWorkflowStore(state => state.isGroupDragging)
  
  // Get all groups to check for collapsed ones
  const groups = useWorkflowStore(state => state.groups)
  
  // Debug: Log connection count and port positions
  // console.log(`🔗 ConnectionLines rendering ${connections.length} connections`)
  
  // Hide connection lines during group dragging for smooth UX
  if (isGroupDragging) {
    return null
  }
  
  return (
    <svg 
      className="absolute inset-0 pointer-events-none" 
      style={{ 
        overflow: 'visible', 
        width: '100%', 
        height: '100%',
        zIndex: 1
      }}
    >
      <defs>
        {/* Define glow filters for each state */}
        <filter id="glow-warning" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        <filter id="glow-error" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        <filter id="glow-success" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {connections.map(connection => {
        let source = getPortPosition(connection.source.nodeId, connection.source.portId)
        let target = getPortPosition(connection.target.nodeId, connection.target.portId)

        // console.log(`🔗 Connection ${connection.id}:`, {
        //   sourceNodeId: connection.source.nodeId,
        //   sourcePortId: connection.source.portId,
        //   targetNodeId: connection.target.nodeId,
        //   targetPortId: connection.target.portId,
        //   sourcePos: source,
        //   targetPos: target
        // })

        // Handle missing port positions for nodes in collapsed groups
        if (!source || !target) {
          // Check if missing positions are due to collapsed groups
          let missingSource = !source
          let missingTarget = !target
          let fallbackSource = source
          let fallbackTarget = target
          
          // Find if the missing port positions are for nodes in collapsed groups
          for (const group of groups) {
            if (!group.collapsed) continue
            
            if (missingSource && group.nodeIds.includes(connection.source.nodeId)) {
              // Source node is in a collapsed group - we'll handle this in the group logic below
              fallbackSource = { nodeId: connection.source.nodeId, portId: connection.source.portId, x: 0, y: 0, position: 'right' as const }
              missingSource = false
            }
            
            if (missingTarget && group.nodeIds.includes(connection.target.nodeId)) {
              // Target node is in a collapsed group - we'll handle this in the group logic below  
              fallbackTarget = { nodeId: connection.target.nodeId, portId: connection.target.portId, x: 0, y: 0, position: 'left' as const }
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
          if (!group.collapsed) continue
          
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
            height: 40 // Use header height when collapsed
          }
          
          // Modify connection endpoints for external-to-internal connections
          if (sourceInGroup && !targetInGroup) {
            // Source is inside collapsed group, target is outside
            const intersection = findBorderIntersection(
              { x: target.x, y: target.y },
              { x: source.x, y: source.y },
              groupRect
            )
            if (intersection) {
              modifiedSource = { ...source, x: intersection.x, y: intersection.y }
            } else {
              // Fallback: always connect to side border (left or right edge)
              const groupCenterX = groupRect.x + groupRect.width / 2
              const groupCenterY = groupRect.y + groupRect.height / 2
              
              // Determine which side edge to connect to based on target position
              const edgeX = target.x < groupCenterX ? groupRect.x : groupRect.x + groupRect.width
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
              // Fallback: always connect to side border (left or right edge)
              const groupCenterX = groupRect.x + groupRect.width / 2
              const groupCenterY = groupRect.y + groupRect.height / 2
              
              // Determine which side edge to connect to based on source position
              const edgeX = source.x < groupCenterX ? groupRect.x : groupRect.x + groupRect.width
              const edgeY = groupCenterY
              
              modifiedTarget = { ...target, x: edgeX, y: edgeY }
            }
          } else if (!sourceInGroup && !targetInGroup) {
            // Check if line crosses the collapsed group
            if (lineIntersectsRect(
              { x: source.x, y: source.y },
              { x: target.x, y: target.y },
              groupRect
            )) {
              shouldHide = true
              break
            }
          }
        }

        if (shouldHide) {
          return null
        }

        const path = generatePath(modifiedSource, modifiedTarget)
        const styles = getConnectionStyles(connection.state)
        const filterId = styles.glowEffect ? `glow-${connection.state}` : undefined

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
            
            {/* Invisible wide path for easier clicking */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth="12"
              strokeLinecap="round"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
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