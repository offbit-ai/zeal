'use client'

import React from 'react'
import { DraggableNode } from '@/components/DraggableNode'
import { SubgraphNode } from '@/components/SubgraphNode'

interface UngroupedNodesProps {
  storeNodes: any[]
  groups: any[]
  initialized: boolean
  handlePortDragStart: any
  handlePortDragEnd: any
  handleNodeSelect: any
  isNodeSelected: (id: string) => boolean
  handleNodeDropIntoGroup: any
  handleNodeHoverGroup: any
  canvasZoom: number
  handleNodePositionChange: any
  handleNodePropertyChange: any
  handleNodeDragStart: any
  handleNodeDragEnd: any
  highlightedNodeId: string | null
  getNodeId: (node: any) => string
  updateNodeBoundsHook: any
  oldUpdatePortPosition: any
}

/**
 * Renders all top-level nodes that are not contained within a group.
 * Waits for groups to be fully loaded so node-to-group classification is stable.
 */
export const UngroupedNodes = React.memo(
  ({
    storeNodes,
    groups,
    initialized,
    handlePortDragStart,
    handlePortDragEnd,
    handleNodeSelect,
    isNodeSelected,
    handleNodeDropIntoGroup,
    handleNodeHoverGroup,
    canvasZoom,
    handleNodePositionChange,
    handleNodePropertyChange,
    handleNodeDragStart,
    handleNodeDragEnd,
    highlightedNodeId,
    getNodeId,
    updateNodeBoundsHook,
    oldUpdatePortPosition,
  }: UngroupedNodesProps) => {
    const groupsFullyLoaded =
      groups.length === 0 ||
      groups.every((g: any) => {
        if (!g.nodeIds?.length) return true
        return g.nodePositions && Object.keys(g.nodePositions).length >= g.nodeIds.length
      })

    if (!initialized || !groupsFullyLoaded) {
      return null
    }

    const ungroupedNodes =
      storeNodes?.filter((node: any) => {
        const nodeId = getNodeId(node)
        const inAnyGroup = groups.some((group: any) => group.nodeIds.includes(nodeId))
        return !inAnyGroup
      }) || []

    return (
      <>
        {ungroupedNodes.map((node: any) => {
          if (!node || !node.metadata) return null
          const nodeId = getNodeId(node)

          if (node.metadata.type === 'subgraph') {
            return (
              <SubgraphNode
                key={nodeId}
                metadata={node.metadata as any}
                position={node.position}
                onPositionChange={handleNodePositionChange}
                onBoundsChange={updateNodeBoundsHook}
                onPortPositionUpdate={oldUpdatePortPosition}
                onPortDragStart={handlePortDragStart}
                onPortDragEnd={handlePortDragEnd}
                onClick={() => handleNodeSelect(nodeId)}
                isHighlighted={nodeId === highlightedNodeId}
                isNodeSelected={isNodeSelected(nodeId)}
                zoom={canvasZoom}
              />
            )
          }

          return (
            <DraggableNode
              key={nodeId}
              nodeId={nodeId}
              metadata={node.metadata}
              propertyValues={node.propertyValues}
              position={node.position}
              zoom={canvasZoom}
              onPositionChange={handleNodePositionChange}
              onBoundsChange={updateNodeBoundsHook}
              onPortPositionUpdate={oldUpdatePortPosition}
              onPortDragStart={handlePortDragStart}
              onPortDragEnd={handlePortDragEnd}
              onClick={handleNodeSelect}
              isHighlighted={nodeId === highlightedNodeId}
              isSelected={isNodeSelected(nodeId)}
              onNodeDropIntoGroup={handleNodeDropIntoGroup}
              onNodeHoverGroup={handleNodeHoverGroup}
              groups={groups}
              onPropertyChange={handleNodePropertyChange}
              onDragStart={handleNodeDragStart}
              onDragEnd={handleNodeDragEnd}
            />
          )
        })}
      </>
    )
  },
  // Memo bypassed (returns false) intentionally — preserves prior behaviour
  // while debug investigation continues.
  () => false
)

UngroupedNodes.displayName = 'UngroupedNodes'
