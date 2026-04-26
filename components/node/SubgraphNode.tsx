'use client'

import { useState } from 'react'
import { ChevronRight, GitBranch } from 'lucide-react'
import { DraggableNode } from './DraggableNode'
import { useWorkflowStore } from '@/store/workflow-store'
import { NodeShape, SubgraphNodeMetadata } from '@/types/workflow'

interface SubgraphNodeProps {
  metadata: SubgraphNodeMetadata
  position: { x: number; y: number }
  onClick?: () => void
  onPositionChange?: (nodeId: string, position: { x: number; y: number }) => void
  onBoundsChange?: (
    nodeId: string,
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
  zoom?: number
  isHighlighted?: boolean
  isNodeSelected?: boolean
  isInGroup?: boolean
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
  isNodeSelected,
  isInGroup = false,
}: SubgraphNodeProps) {
  const { switchGraph, graphs } = useWorkflowStore()
  const [isHovered, setIsHovered] = useState(false)

  const targetGraph = graphs.find(g => g.id === metadata.graphId)

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    switchGraph(metadata.graphId)
  }

  // Override metadata for visual appearance
  // Use dynamic namespace if workflowName is available
  const dynamicNamespace = metadata.workflowName
    ? `${metadata.workflowName}/${metadata.graphId}`
    : metadata.graphNamespace

  const subgraphMetadata = {
    ...metadata,
    variant: 'orange-600' as const,
    icon: 'link',
    subtitle: `${dynamicNamespace}`,
    shape: 'diamond' as NodeShape,
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
        onClick={onClick}
        onPositionChange={onPositionChange}
        onBoundsChange={onBoundsChange}
        onPortPositionUpdate={onPortPositionUpdate}
        onPortDragStart={onPortDragStart}
        onPortDragEnd={onPortDragEnd}
        zoom={zoom}
        isHighlighted={isHighlighted}
        isSelected={isNodeSelected}
        isInGroup={isInGroup}
      />
    </div>
  )
}
