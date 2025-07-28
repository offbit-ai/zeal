import { NodeMetadata, NodeShape, NodeVariant, Port } from '@/types/workflow'
import { useState, useRef, useEffect } from 'react'
import { Icon } from '@/lib/icons'
import { getNodeStyles, getTextColor } from '@/utils/nodeColorVariants'
import { hasUnconfiguredDefaults } from '@/utils/nodeConfigurationStatus'
import { Info } from 'lucide-react'

interface WorkflowNodeProps {
  metadata: NodeMetadata
  isDragging?: boolean
  isHighlighted?: boolean
  isSelected?: boolean
  onPortPositionUpdate?: (nodeId: string, portId: string, x: number, y: number, position: 'top' | 'right' | 'bottom' | 'left') => void
  onPortDragStart?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onPortDragEnd?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  zoom?: number
}

interface PortComponentProps {
  port: Port
  nodeShape: NodeShape
  showLabel: boolean
  nodeId: string
  onPortPositionUpdate?: (portId: string, x: number, y: number, position: 'top' | 'right' | 'bottom' | 'left') => void
  onPortDragStart?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onPortDragEnd?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  portIndex: number
  totalPortsOnSide: number
  zoom?: number
}

function PortComponent({ port, nodeShape, showLabel, nodeId, onPortPositionUpdate, onPortDragStart, onPortDragEnd, portIndex, totalPortsOnSide, zoom = 1 }: PortComponentProps) {
  const portRef = useRef<HTMLDivElement>(null)
  
  // Measure and report actual port position using world coordinates
  useEffect(() => {
    if (portRef.current && onPortPositionUpdate) {
      const measurePortPosition = () => {
        const portElement = portRef.current
        const nodeElement = portElement?.closest('[data-node-id]') as HTMLElement
        if (!portElement || !nodeElement) {
          return
        }
        
        // Get the canvas container to calculate relative positions
        const canvasElement = nodeElement.closest('[data-canvas]') as HTMLElement
        if (!canvasElement) {
          return
        }
        
        // Get the transformed content container within the canvas
        const contentContainer = canvasElement.querySelector('div[style*="transform"]') as HTMLElement
        if (!contentContainer) {
          return
        }
        
        // Note: Group positioning is handled automatically since groups are positioned
        // within the same coordinate system as individual nodes
        
        // Get bounding rects relative to the viewport
        const portRect = portElement.getBoundingClientRect()
        const contentRect = contentContainer.getBoundingClientRect()
        
        // Calculate port center relative to the transformed content container
        // Adjust for zoom since getBoundingClientRect returns screen coordinates
        let portCenterX = (portRect.left + portRect.width / 2 - contentRect.left) / zoom
        let portCenterY = (portRect.top + portRect.height / 2 - contentRect.top) / zoom
        
        // If node is in a group, the port position is already correctly calculated
        // relative to the content container since the group itself is positioned
        // within the content container. No additional offset needed.
        
        // Report the coordinates in the transformed space
        onPortPositionUpdate(port.id, portCenterX, portCenterY, port.position)
      }
      
      // Measure on mount and when dependencies change
      const timer = setTimeout(measurePortPosition, 100)
      // Also measure with a longer delay to ensure DOM is ready
      const laterTimer = setTimeout(measurePortPosition, 500)
      
      // Also re-measure on resize
      const observer = new ResizeObserver(measurePortPosition)
      if (portRef.current) {
        observer.observe(portRef.current)
      }
      
      // Listen for node position changes
      const handleNodePositionChanged = (e: Event) => {
        const customEvent = e as CustomEvent
        if (customEvent.detail?.nodeId === nodeId) {
          requestAnimationFrame(measurePortPosition) // Use animation frame for smoother updates
        }
      }
      
      // Listen for group position changes (only when drag ends)
      const handleGroupPositionChanged = () => {
        // Re-measure port positions when group drag ends
        requestAnimationFrame(measurePortPosition)
      }
      
      document.addEventListener('nodePositionChanged', handleNodePositionChanged)
      document.addEventListener('groupPositionChanged', handleGroupPositionChanged)
      
      return () => {
        clearTimeout(timer)
        clearTimeout(laterTimer)
        observer.disconnect()
        document.removeEventListener('nodePositionChanged', handleNodePositionChanged)
        document.removeEventListener('groupPositionChanged', handleGroupPositionChanged)
      }
    }
  }, [port.id, port.position, onPortPositionUpdate, nodeId, zoom])
  
  // Calculate position offset for multiple ports on the same side
  const getPortOffset = () => {
    if (totalPortsOnSide === 1) return '50%'
    
    // Distribute ports evenly along the side
    const spacing = 100 / (totalPortsOnSide + 1)
    const offset = spacing * (portIndex + 1)
    return `${offset}%`
  }
  
  // Port positioning based on position and node shape
  const positionStyles = nodeShape === 'diamond' ? {
    // For diamond shape, adjust positions to align with rotated edges
    top: 'absolute -top-1 -left-1',
    right: 'absolute -top-1 -right-1',
    bottom: 'absolute -bottom-1 -right-1',
    left: 'absolute -bottom-1 -left-1'
  } : {
    // Standard positions for rectangle and circle - base positioning
    top: 'absolute -top-2 -translate-x-1/2',
    right: 'absolute -right-2 -translate-y-1/2',
    bottom: 'absolute -bottom-2 -translate-x-1/2',
    left: 'absolute -left-2 -translate-y-1/2'
  }
  
  // Dynamic positioning based on side and index
  const dynamicStyles: React.CSSProperties = {}
  if (nodeShape !== 'diamond') {
    if (port.position === 'left' || port.position === 'right') {
      dynamicStyles.top = getPortOffset()
    } else {
      dynamicStyles.left = getPortOffset()
    }
  }
  
  // Label positioning - always on the same side as the port, centered
  const labelPositionStyles = {
    top: 'bottom-full mb-1 left-1/2 -translate-x-1/2',     // Label above the port, centered
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',      // Label to the right of the port, centered
    bottom: 'top-full mt-1 left-1/2 -translate-x-1/2',     // Label below the port, centered
    left: 'right-full mr-2 top-1/2 -translate-y-1/2'       // Label to the left of the port, centered
  }
  
  return (
    <div ref={portRef} className={`${positionStyles[port.position]} group`} style={dynamicStyles}>
      <div 
        className="w-3 h-3 bg-white border-2 border-gray-900 rounded-full hover:scale-125 transition-transform cursor-crosshair"
        data-port-id={port.id}
        data-node-id={nodeId}
        data-port-type={port.type}
        onMouseDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onPortDragStart?.(nodeId, port.id, port.type)
        }}
        onMouseUp={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onPortDragEnd?.(nodeId, port.id, port.type)
        }}
      />
      {showLabel && (
        <div 
          className={`absolute ${labelPositionStyles[port.position]} whitespace-nowrap px-2 py-0.5 text-xs rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.9)', 
            color: '#374151', 
            borderWidth: '1px', 
            borderStyle: 'solid', 
            borderColor: '#d1d5db' 
          }}
        >
          {port.label}
        </div>
      )}
    </div>
  )
}

export function WorkflowNode({ metadata, isDragging = false, isHighlighted = false, isSelected = false, onPortPositionUpdate, onPortDragStart, onPortDragEnd, zoom = 1 }: WorkflowNodeProps) {
  const { title, subtitle, icon, variant, shape, size = 'medium', ports = [] } = metadata
  const [isHovered, setIsHovered] = useState(false)
  
  // Debug: Log ports for this node
  // console.log(`🔌 Node ${metadata.id} has ${ports.length} ports:`, ports.map(p => `${p.id}(${p.position})`).join(', '))
  
  
  // Get the icon name (icon is now always a string from the API)
  const iconName = typeof icon === 'string' ? icon : 'box'
  
  // Check if node needs configuration
  const needsConfiguration = hasUnconfiguredDefaults(metadata)
  
  // Debug metadata changes
  // useEffect(() => {
  //   console.log(`🎨 COMPONENT: WorkflowNode ${metadata.id} received metadata:`, {
  //     title,
  //     subtitle,
  //     icon: iconName,
  //     variant
  //   })
  // }, [metadata.id, title, subtitle, iconName, variant])
  
  // Group ports by position for proper indexing
  const portsByPosition = ports.reduce((acc, port) => {
    if (!acc[port.position]) acc[port.position] = []
    acc[port.position].push(port)
    return acc
  }, {} as Record<string, Port[]>)

  // Get node color styles based on variant
  const nodeStyles = getNodeStyles(variant, isHovered)
  const textColor = getTextColor(variant)

  const shapeStyles: Record<NodeShape, string> = {
    'rectangle': 'rounded-lg',
    'circle': 'rounded-full',
    'diamond': 'rotate-45'
  }

  const sizeStyles = {
    'small': {
      container: 'px-3 py-2 max-w-[160px]',
      icon: 'p-1.5',
      iconSize: 'w-5 h-5',
      title: 'text-xs',
      subtitle: 'text-[10px]'
    },
    'medium': {
      container: 'px-4 py-3 max-w-[200px]',
      icon: 'p-2',
      iconSize: 'w-6 h-6',
      title: 'text-sm',
      subtitle: 'text-xs'
    },
    'large': {
      container: 'px-5 py-4 max-w-[240px]',
      icon: 'p-2.5',
      iconSize: 'w-7 h-7',
      title: 'text-base',
      subtitle: 'text-sm'
    }
  }

  const currentSize = sizeStyles[size]

  // Handle circle shape differently
  if (shape === 'circle') {
    return (
      <div className="flex flex-col items-center relative select-none" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div 
          className={`${shapeStyles[shape]} w-16 h-16 flex items-center justify-center relative select-none ${isDragging ? 'shadow-xl' : ''} ${isHighlighted ? 'ring-4 ring-blue-500 animate-pulse' : ''} ${isSelected ? 'ring-4 ring-blue-600' : ''} ${needsConfiguration ? 'ring-2 ring-orange-400 ring-opacity-60 animate-shake' : ''}`}
          style={nodeStyles}
        >
          <Icon key={iconName} name={iconName} className="w-7 h-7" style={{ color: textColor }} strokeWidth={1.5} />
          {needsConfiguration && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 rounded-full flex items-center justify-center">
              <Info className="w-2.5 h-2.5 text-white" strokeWidth={2} />
            </div>
          )}
          {/* Render ports */}
          {ports.map(port => {
            const portsOnSameSide = portsByPosition[port.position] || []
            const portIndex = portsOnSameSide.findIndex(p => p.id === port.id)
            return (
              <PortComponent 
                key={port.id} 
                port={port} 
                nodeShape={shape} 
                showLabel={isHovered} 
                nodeId={metadata.id} 
 
                onPortPositionUpdate={onPortPositionUpdate ? (portId, x, y, position) => onPortPositionUpdate(metadata.id, portId, x, y, position) : undefined}
                onPortDragStart={onPortDragStart} 
                onPortDragEnd={onPortDragEnd}
                portIndex={portIndex}
                totalPortsOnSide={portsOnSameSide.length}
                zoom={zoom}
              />
            )
          })}
        </div>
        <div className="text-center mt-2">
          <div className={`font-medium ${currentSize.title}`} style={{ color: '#111827' }}>{title}</div>
          {subtitle && (
            <div className={`${currentSize.subtitle}`} style={{ color: '#6b7280' }}>{subtitle}</div>
          )}
        </div>
      </div>
    )
  }

  // Handle diamond shape differently
  if (shape === 'diamond') {
    return (
      <div className="flex flex-col items-center relative select-none" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div 
          className={`${shapeStyles[shape]} w-12 h-12 flex items-center justify-center relative select-none ${isDragging ? 'shadow-xl' : ''} ${isHighlighted ? 'ring-4 ring-blue-500 animate-pulse' : ''} ${isSelected ? 'ring-4 ring-blue-600' : ''} ${needsConfiguration ? 'ring-2 ring-orange-400 ring-opacity-60 animate-shake' : ''}`}
          style={nodeStyles}
        >
          <Icon key={iconName} name={iconName} className="w-5 h-5 -rotate-45" style={{ color: textColor }} strokeWidth={1.5} />
          {needsConfiguration && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 rounded-full flex items-center justify-center">
              <Info className="w-2.5 h-2.5 text-white" strokeWidth={2} />
            </div>
          )}
          {/* Render ports */}
          {ports.map(port => {
            const portsOnSameSide = portsByPosition[port.position] || []
            const portIndex = portsOnSameSide.findIndex(p => p.id === port.id)
            return (
              <PortComponent 
                key={port.id} 
                port={port} 
                nodeShape={shape} 
                showLabel={isHovered} 
                nodeId={metadata.id} 
 
                onPortPositionUpdate={onPortPositionUpdate ? (portId, x, y, position) => onPortPositionUpdate(metadata.id, portId, x, y, position) : undefined}
                onPortDragStart={onPortDragStart} 
                onPortDragEnd={onPortDragEnd}
                portIndex={portIndex}
                totalPortsOnSide={portsOnSameSide.length}
                zoom={zoom}
              />
            )
          })}
        </div>
        <div className="text-center mt-2">
          <div className={`font-medium ${currentSize.title}`} style={{ color: '#111827' }}>{title}</div>
          {subtitle && (
            <div className={`${currentSize.subtitle}`} style={{ color: '#6b7280' }}>{subtitle}</div>
          )}
        </div>
      </div>
    )
  }

  // Default rectangle shape
  return (
    <div 
      className={`${currentSize.container} ${shapeStyles[shape]} flex items-center gap-3 w-fit relative select-none ${isDragging ? 'shadow-xl' : ''} ${isHighlighted ? 'ring-4 ring-blue-500 animate-pulse' : ''} ${isSelected ? 'ring-4 ring-blue-600' : ''} ${needsConfiguration ? 'ring-2 ring-orange-400 ring-opacity-60 animate-shake' : ''}`}
      style={nodeStyles}
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`${currentSize.icon} rounded-md flex items-center justify-center relative`} style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
        <Icon key={iconName} name={iconName} className={currentSize.iconSize} style={{ color: textColor }} strokeWidth={1.5} />
        {needsConfiguration && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 rounded-full flex items-center justify-center">
            <Info className="w-2.5 h-2.5 text-white" strokeWidth={2} />
          </div>
        )}
      </div>
      <div>
        <div className={`font-medium ${currentSize.title}`} style={{ color: textColor }}>{title}</div>
        {subtitle && (
          <div className={`${currentSize.subtitle} opacity-70`} style={{ color: textColor }}>{subtitle}</div>
        )}
      </div>
      {/* Render ports */}
      {ports.map(port => {
        const portsOnSameSide = portsByPosition[port.position] || []
        const portIndex = portsOnSameSide.findIndex(p => p.id === port.id)
        return (
          <PortComponent 
            key={port.id} 
            port={port} 
            nodeShape={shape} 
            showLabel={isHovered} 
            nodeId={metadata.id} 
            onPortPositionUpdate={onPortPositionUpdate ? (portId, x, y, position) => onPortPositionUpdate(metadata.id, portId, x, y, position) : undefined}
            onPortDragStart={onPortDragStart} 
            onPortDragEnd={onPortDragEnd}
            portIndex={portIndex}
            totalPortsOnSide={portsOnSameSide.length}
            zoom={zoom}
          />
        )
      })}
    </div>
  )
}