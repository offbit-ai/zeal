'use client'

import { useState } from 'react'
import { ChevronRight, GitBranch } from 'lucide-react'
import { DraggableNode } from './DraggableNode'
import { useGraphStore } from '@/store/graphStore'
import { NodeShape, SubgraphNodeMetadata } from '@/types/workflow'

interface SubgraphNodeProps {
  metadata: SubgraphNodeMetadata
  position: { x: number; y: number }
  onClick?: () => void
  onPositionChange?: (nodeId: string, position: { x: number; y: number }) => void
  onBoundsChange?: (nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => void
  onPortPositionUpdate?: (nodeId: string, portId: string, x: number, y: number, position: 'top' | 'right' | 'bottom' | 'left') => void
  onPortDragStart?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onPortDragEnd?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  zoom?: number
  isHighlighted?: boolean
  isNodeSelected?: boolean
}

export function SubgraphNode({
  metadata,
  position,
  onClick,
  onPositionChange,
  onBoundsChange,
  onPortPositionUpdate,
  onPortDragStart,
  onPortDragEnd,
  zoom = 1,
  isHighlighted,
  isNodeSelected
}: SubgraphNodeProps) {
  const { switchGraph, getGraphById } = useGraphStore()
  const [isHovered, setIsHovered] = useState(false)
  
  const targetGraph = getGraphById(metadata.graphId)
  
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    switchGraph(metadata.graphId)
  }
  
  // Override metadata for visual appearance
  const subgraphMetadata = {
    ...metadata,
    variant: 'orange-600' as const,
    icon: 'link',
    subtitle: `Subgraph: ${metadata.graphNamespace}`,
    shape: 'diamond' as NodeShape
  }
  
  return (
    <div
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-fit"
    >
      <DraggableNode
        metadata={subgraphMetadata}
        position={position}
        onClick={()=>{}}
        onPositionChange={onPositionChange}
        onBoundsChange={onBoundsChange}
        onPortPositionUpdate={onPortPositionUpdate}
        onPortDragStart={onPortDragStart}
        onPortDragEnd={onPortDragEnd}
        zoom={zoom}
        isHighlighted={isHighlighted}
        isSelected={isNodeSelected}
      />
      
    </div>
  )
}