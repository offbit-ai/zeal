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

export function ConnectionLines({ connections, getPortPosition, onConnectionClick }: ConnectionLinesProps) {
  // Subscribe to port position changes for immediate updates
  usePortPositionSubscription()
  
  // Get group dragging state to hide connections during drag
  const isGroupDragging = useWorkflowStore(state => state.isGroupDragging)
  
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
        const source = getPortPosition(connection.source.nodeId, connection.source.portId)
        const target = getPortPosition(connection.target.nodeId, connection.target.portId)

        // console.log(`🔗 Connection ${connection.id}:`, {
        //   sourceNodeId: connection.source.nodeId,
        //   sourcePortId: connection.source.portId,
        //   targetNodeId: connection.target.nodeId,
        //   targetPortId: connection.target.portId,
        //   sourcePos: source,
        //   targetPos: target
        // })

        if (!source || !target) {
          // console.log(`❌ Missing port positions for connection ${connection.id}`)
          return null
        }

        const path = generatePath(source, target)
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