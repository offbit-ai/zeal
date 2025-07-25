import { NodeMetadata, NodeShape, NodeVariant, Port } from '@/types/workflow'
import { useState, useRef, useEffect } from 'react'

interface WorkflowNodeProps {
  metadata: NodeMetadata
  isDragging?: boolean
  isHighlighted?: boolean
  onPortPositionUpdate?: (nodeId: string, portId: string, x: number, y: number, position: 'top' | 'right' | 'bottom' | 'left') => void
  onPortDragStart?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onPortDragEnd?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
}

interface PortComponentProps {
  port: Port
  nodeShape: NodeShape
  showLabel: boolean
  nodeId: string
  onPortPositionUpdate?: (portId: string, x: number, y: number, position: 'top' | 'right' | 'bottom' | 'left') => void
  onPortDragStart?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onPortDragEnd?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
}

function PortComponent({ port, nodeShape, showLabel, nodeId, onPortPositionUpdate, onPortDragStart, onPortDragEnd }: PortComponentProps) {
  const isInput = port.type === 'input'
  const portRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (portRef.current && onPortPositionUpdate) {
      const updatePosition = () => {
        // Get the node container
        const nodeElement = portRef.current!.closest('[data-node-id]') as HTMLElement
        if (!nodeElement) return
        
        // Get node position from transform
        const transform = nodeElement.style.transform
        const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/)
        if (!match) return
        
        const nodeX = parseFloat(match[1])
        const nodeY = parseFloat(match[2])
        
        // Get port position relative to node
        const portRect = portRef.current!.getBoundingClientRect()
        const nodeRect = nodeElement.getBoundingClientRect()
        
        const relativeX = portRect.left - nodeRect.left + portRect.width / 2
        const relativeY = portRect.top - nodeRect.top + portRect.height / 2
        
        // Calculate absolute position
        const absoluteX = nodeX + relativeX
        const absoluteY = nodeY + relativeY
        
        onPortPositionUpdate(port.id, absoluteX, absoluteY, port.position)
      }
      
      // Update position after a short delay
      const timer = setTimeout(updatePosition, 100)
      
      // Listen for node position changes
      const handleNodeMove = () => {
        updatePosition()
      }
      
      const nodeElement = portRef.current!.closest('[data-node-id]')
      if (nodeElement) {
        nodeElement.addEventListener('nodePositionChanged', handleNodeMove)
      }
      
      return () => {
        clearTimeout(timer)
        if (nodeElement) {
          nodeElement.removeEventListener('nodePositionChanged', handleNodeMove)
        }
      }
    }
  }, [port.id, port.position, onPortPositionUpdate, nodeId])
  
  // Port positioning based on position and node shape
  const positionStyles = nodeShape === 'diamond' ? {
    // For diamond shape, adjust positions to align with rotated edges
    top: 'absolute -top-1 -left-1',
    right: 'absolute -top-1 -right-1',
    bottom: 'absolute -bottom-1 -right-1',
    left: 'absolute -bottom-1 -left-1'
  } : {
    // Standard positions for rectangle and circle
    top: 'absolute -top-2 left-1/2 -translate-x-1/2',
    right: 'absolute -right-2 top-1/2 -translate-y-1/2',
    bottom: 'absolute -bottom-2 left-1/2 -translate-x-1/2',
    left: 'absolute -left-2 top-1/2 -translate-y-1/2'
  }
  
  // Label positioning - always on the same side as the port, centered
  const labelPositionStyles = {
    top: 'bottom-full mb-1 left-1/2 -translate-x-1/2',     // Label above the port, centered
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',      // Label to the right of the port, centered
    bottom: 'top-full mt-1 left-1/2 -translate-x-1/2',     // Label below the port, centered
    left: 'right-full mr-2 top-1/2 -translate-y-1/2'       // Label to the left of the port, centered
  }
  
  return (
    <div ref={portRef} className={`${positionStyles[port.position]} group`}>
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
        <div className={`absolute ${labelPositionStyles[port.position]} whitespace-nowrap px-2 py-0.5 bg-white/90 text-gray-700 text-xs rounded border border-gray-300 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}>
          {port.label}
        </div>
      )}
    </div>
  )
}

export function WorkflowNode({ metadata, isDragging = false, isHighlighted = false, onPortPositionUpdate, onPortDragStart, onPortDragEnd }: WorkflowNodeProps) {
  const { title, subtitle, icon: Icon, variant, shape, size = 'medium', ports = [] } = metadata
  const [isHovered, setIsHovered] = useState(false)

  const variantStyles: Record<NodeVariant, string> = {
    'black': 'bg-black',
    'gray-700': 'bg-gray-700',
    'gray-600': 'bg-gray-600',
    'gray-800': 'bg-gray-800',
    'gray-900': 'bg-gray-900',
    'blue-600': 'bg-blue-600',
    'green-600': 'bg-green-600',
    'orange-600': 'bg-orange-600',
    'orange-700': 'bg-orange-700'
  }

  const shapeStyles: Record<NodeShape, string> = {
    'rectangle': 'rounded-lg',
    'circle': 'rounded-full',
    'diamond': 'rotate-45'
  }

  const sizeStyles = {
    'small': {
      container: 'px-3 py-2 max-w-[160px]',
      icon: 'p-1.5 w-4 h-4',
      title: 'text-xs',
      subtitle: 'text-[10px]'
    },
    'medium': {
      container: 'px-4 py-3 max-w-[200px]',
      icon: 'p-2.5 w-5 h-5',
      title: 'text-sm',
      subtitle: 'text-xs'
    },
    'large': {
      container: 'px-5 py-4 max-w-[240px]',
      icon: 'p-3 w-6 h-6',
      title: 'text-base',
      subtitle: 'text-sm'
    }
  }

  const currentSize = sizeStyles[size]

  // Handle circle shape differently
  if (shape === 'circle') {
    return (
      <div className="flex flex-col items-center relative select-none" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className={`${variantStyles[variant]} text-white ${shapeStyles[shape]} w-16 h-16 flex items-center justify-center relative select-none ${isDragging ? 'shadow-xl' : ''} ${isHighlighted ? 'ring-4 ring-blue-500 animate-pulse' : ''}`}>
          <Icon className="w-7 h-7" strokeWidth={1.5} />
          {/* Render ports */}
          {ports.map(port => (
            <PortComponent key={port.id} port={port} nodeShape={shape} showLabel={isHovered} nodeId={metadata.id} onPortPositionUpdate={onPortPositionUpdate ? (portId, x, y, position) => onPortPositionUpdate(metadata.id, portId, x, y, position) : undefined} onPortDragStart={onPortDragStart} onPortDragEnd={onPortDragEnd} />
          ))}
        </div>
        <div className="text-center mt-2">
          <div className={`font-medium ${currentSize.title} text-black`}>{title}</div>
          {subtitle && (
            <div className={`${currentSize.subtitle} text-gray-500`}>{subtitle}</div>
          )}
        </div>
      </div>
    )
  }

  // Handle diamond shape differently
  if (shape === 'diamond') {
    return (
      <div className="flex flex-col items-center relative select-none" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className={`${variantStyles[variant]} text-white ${shapeStyles[shape]} w-12 h-12 flex items-center justify-center relative select-none ${isDragging ? 'shadow-xl' : ''} ${isHighlighted ? 'ring-4 ring-blue-500 animate-pulse' : ''}`}>
          <Icon className="w-5 h-5 -rotate-45" strokeWidth={1.5} />
          {/* Render ports */}
          {ports.map(port => (
            <PortComponent key={port.id} port={port} nodeShape={shape} showLabel={isHovered} nodeId={metadata.id} onPortPositionUpdate={onPortPositionUpdate ? (portId, x, y, position) => onPortPositionUpdate(metadata.id, portId, x, y, position) : undefined} onPortDragStart={onPortDragStart} onPortDragEnd={onPortDragEnd} />
          ))}
        </div>
        <div className="text-center mt-2">
          <div className={`font-medium ${currentSize.title} text-black`}>{title}</div>
          {subtitle && (
            <div className={`${currentSize.subtitle} text-gray-500`}>{subtitle}</div>
          )}
        </div>
      </div>
    )
  }

  // Default rectangle shape
  return (
    <div 
      className={`${variantStyles[variant]} text-white ${currentSize.container} ${shapeStyles[shape]} flex items-center gap-3 w-fit relative select-none ${isDragging ? 'shadow-xl' : ''} ${isHighlighted ? 'ring-4 ring-blue-500 animate-pulse' : ''}`}
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`${currentSize.icon} bg-white/10 rounded-md flex items-center justify-center`}>
        <Icon className={currentSize.icon.split(' ').slice(-2).join(' ')} strokeWidth={1.5} />
      </div>
      <div>
        <div className={`font-medium ${currentSize.title}`}>{title}</div>
        {subtitle && (
          <div className={`${currentSize.subtitle} opacity-70`}>{subtitle}</div>
        )}
      </div>
      {/* Render ports */}
      {ports.map(port => (
        <PortComponent key={port.id} port={port} nodeShape={shape} showLabel={isHovered} nodeId={metadata.id} onPortPositionUpdate={onPortPositionUpdate ? (portId, x, y, position) => onPortPositionUpdate(metadata.id, portId, x, y, position) : undefined} onPortDragStart={onPortDragStart} onPortDragEnd={onPortDragEnd} />
      ))}
    </div>
  )
}