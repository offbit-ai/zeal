'use client'

import React from 'react'
import { DraggableNode } from '@/components/DraggableNode'
import { SubgraphNode } from '@/components/SubgraphNode'

interface GroupNodesProps {
  group: any
  groupNodes: any[]
  groupNodePositions: any
  readyGroupContainers: Set<string>
  newlyCreatedGroups: Set<string>
  canvasZoom: number
  handleNodePositionInGroup: (nodeId: string, groupId: string, position: any) => void
  updateNodeBoundsHook: (nodeId: string, bounds: any) => void
  oldUpdatePortPosition: any
  handlePortDragStart: any
  handlePortDragEnd: any
  handleNodeSelect: any
  isNodeSelected: (id: string) => boolean
  handleNodeDropIntoGroup: any
  handleNodeHoverGroup: any
  groups: any[]
  handleNodePropertyChange: any
  handleNodeDragStart: any
  handleNodeDragEnd: any
  highlightedNodeId: string | null
  updateGroup: any
  setGraphDirty: any
  currentGraphId: string
  getNodeId: (node: any) => string
}

/**
 * Renders the nodes that live inside a single group container.
 * Memoised with a custom comparator that bypasses unstable handler refs.
 */
export const GroupNodes = React.memo(
  ({
    group,
    groupNodes,
    groupNodePositions,
    readyGroupContainers,
    newlyCreatedGroups,
    canvasZoom,
    handleNodePositionInGroup,
    updateNodeBoundsHook,
    oldUpdatePortPosition,
    handlePortDragStart,
    handlePortDragEnd,
    handleNodeSelect,
    isNodeSelected,
    handleNodeDropIntoGroup,
    handleNodeHoverGroup,
    groups,
    handleNodePropertyChange,
    handleNodeDragStart,
    handleNodeDragEnd,
    highlightedNodeId,
    getNodeId,
  }: GroupNodesProps) => {
    const canRender = readyGroupContainers.has(group.id) || newlyCreatedGroups.has(group.id)

    if (!canRender) return null

    return (
      <>
        {groupNodes.map((node: any) => {
          if (!node || !node.metadata) return null

          const nodeId = getNodeId(node)
          if (!nodeId) return null

          const storedPosition = group.nodePositions?.[nodeId]
          const localPos = groupNodePositions[group.id]?.[nodeId]

          const relativePosition =
            localPos ||
            storedPosition ||
            (() => {
              const nodePos = node.position || {
                x: group.position?.x + 50,
                y: group.position?.y + 50,
              }
              const groupPos = group.position || { x: 100, y: 100 }
              const headerOffset = group.description ? 100 : 32

              return {
                x: nodePos.x - groupPos.x,
                y: nodePos.y - groupPos.y - headerOffset,
              }
            })()

          if (node.metadata.type === 'subgraph') {
            return (
              <SubgraphNode
                key={`group-${group.id}-node-${nodeId}`}
                metadata={node.metadata as any}
                position={relativePosition}
                onPositionChange={(nodeId, position) => {
                  handleNodePositionInGroup(nodeId, group.id, position)
                }}
                onBoundsChange={(nodeId, bounds) => {
                  updateNodeBoundsHook(nodeId, bounds)
                }}
                onPortPositionUpdate={oldUpdatePortPosition}
                onPortDragStart={handlePortDragStart}
                onPortDragEnd={handlePortDragEnd}
                onClick={() => handleNodeSelect(nodeId)}
                isHighlighted={node.metadata.id === highlightedNodeId}
                isNodeSelected={isNodeSelected(node.metadata.id)}
                zoom={canvasZoom}
                isInGroup={true}
              />
            )
          }

          return (
            <DraggableNode
              key={`group-${group.id}-node-${nodeId}`}
              nodeId={nodeId}
              metadata={node.metadata}
              propertyValues={node.propertyValues}
              position={relativePosition}
              zoom={canvasZoom}
              onPositionChange={(nodeId, position) => {
                handleNodePositionInGroup(nodeId, group.id, position)
              }}
              onBoundsChange={(nodeId, bounds) => {
                updateNodeBoundsHook(nodeId, bounds)
              }}
              onPortPositionUpdate={oldUpdatePortPosition}
              onPortDragStart={handlePortDragStart}
              onPortDragEnd={handlePortDragEnd}
              onClick={handleNodeSelect}
              isHighlighted={node.metadata.id === highlightedNodeId}
              isSelected={isNodeSelected(node.metadata.id)}
              onNodeDropIntoGroup={handleNodeDropIntoGroup}
              onNodeHoverGroup={handleNodeHoverGroup}
              groups={groups}
              isInGroup={true}
              currentGroup={group}
              onPropertyChange={handleNodePropertyChange}
              onDragStart={handleNodeDragStart}
              onDragEnd={handleNodeDragEnd}
              onNodeNearGroupBoundary={() => {
                // Group resize is local-only during node drag; no CRDT update here.
              }}
            />
          )
        })}
      </>
    )
  },
  (prevProps, nextProps) => {
    if (prevProps.group?.id !== nextProps.group?.id) return false
    if (prevProps.groupNodes?.length !== nextProps.groupNodes?.length) return false

    const prevNodeIds = prevProps.groupNodes?.map((n: any) => n?.metadata?.id).join(',') || ''
    const nextNodeIds = nextProps.groupNodes?.map((n: any) => n?.metadata?.id).join(',') || ''
    if (prevNodeIds !== nextNodeIds) return false

    for (let i = 0; i < (prevProps.groupNodes?.length || 0); i++) {
      const prevNode = prevProps.groupNodes?.[i]
      const nextNode = nextProps.groupNodes?.[i]

      if (JSON.stringify(prevNode?.propertyValues) !== JSON.stringify(nextNode?.propertyValues))
        return false

      if (
        prevNode?.position?.x !== nextNode?.position?.x ||
        prevNode?.position?.y !== nextNode?.position?.y
      )
        return false
    }

    if (
      JSON.stringify(prevProps.groupNodePositions?.[prevProps.group?.id]) !==
      JSON.stringify(nextProps.groupNodePositions?.[nextProps.group?.id])
    )
      return false

    if (
      prevProps.readyGroupContainers?.has(prevProps.group?.id) !==
      nextProps.readyGroupContainers?.has(nextProps.group?.id)
    )
      return false

    if (
      prevProps.newlyCreatedGroups?.has(prevProps.group?.id) !==
      nextProps.newlyCreatedGroups?.has(nextProps.group?.id)
    )
      return false

    if (prevProps.canvasZoom !== nextProps.canvasZoom) return false
    if (prevProps.highlightedNodeId !== nextProps.highlightedNodeId) return false
    if (prevProps.currentGraphId !== nextProps.currentGraphId) return false

    return true
  }
)

GroupNodes.displayName = 'GroupNodes'
