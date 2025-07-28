import type { WorkflowSnapshot, WorkflowGraph, SerializedNode, SerializedConnection, SerializedGroup } from '@/types/snapshot'
import type { NodeMetadata, Connection, NodeGroup } from '@/types/workflow'

// Serialize a single node
export function serializeNode(node: { metadata: NodeMetadata; position: { x: number; y: number } }): SerializedNode {
  return {
    id: node.metadata.id,
    type: node.metadata.type,
    position: node.position,
    metadata: {
      ...node.metadata,
      // Icon is already a string, no conversion needed
      icon: node.metadata.icon
    }
  }
}

// Deserialize a single node
export function deserializeNode(serialized: SerializedNode): { metadata: NodeMetadata; position: { x: number; y: number } } {
  return {
    position: serialized.position,
    metadata: {
      ...serialized.metadata,
      // Icon is already a string, no conversion needed
      icon: serialized.metadata.icon || 'box' // Fallback to 'box' if undefined
    }
  }
}

// Serialize connections
export function serializeConnection(connection: Connection): SerializedConnection {
  return {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    state: connection.state
  }
}

// Serialize a single group
export function serializeGroup(group: NodeGroup): SerializedGroup {
  return {
    id: group.id,
    title: group.title,
    description: group.description,
    nodeIds: group.nodeIds,
    position: group.position,
    size: group.size,
    color: group.color,
    collapsed: group.collapsed,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  }
}

// Create a workflow graph
export function createWorkflowGraph(
  id: string,
  name: string,
  namespace: string,
  isMain: boolean,
  nodes: Array<{ metadata: NodeMetadata; position: { x: number; y: number } }>,
  connections: Connection[],
  groups: NodeGroup[] = [],
  canvasState?: { offset: { x: number; y: number }; zoom: number },
  portPositions?: Map<string, { nodeId: string; portId: string; x: number; y: number; position: 'top' | 'right' | 'bottom' | 'left' }>
): WorkflowGraph {
  return {
    id,
    name,
    namespace,
    isMain,
    nodes: (nodes || []).map(serializeNode),
    connections: (connections || []).map(serializeConnection),
    groups: (groups || []).map(serializeGroup),
    canvasState,
    portPositions: portPositions ? Array.from(portPositions.entries()).map(([key, value]) => ({
      key,
      nodeId: value.nodeId,
      portId: value.portId,
      x: value.x,
      y: value.y,
      position: value.position
    })) : undefined
  }
}

// Create a workflow snapshot with multiple graphs
export function createWorkflowSnapshot(
  graphs: WorkflowGraph[],
  activeGraphId: string | undefined,
  name: string = 'Untitled Workflow',
  id?: string,
  existingSnapshot?: WorkflowSnapshot,
  trigger?: any
): WorkflowSnapshot {
  const now = new Date().toISOString()
  
  // Calculate totals across all graphs
  const totalNodeCount = graphs.reduce((sum, g) => sum + (g.nodes?.length || 0), 0)
  const totalConnectionCount = graphs.reduce((sum, g) => sum + (g.connections?.length || 0), 0)
  const totalGroupCount = graphs.reduce((sum, g) => sum + (g.groups?.length || 0), 0)
  
  return {
    id: id || crypto.randomUUID(),
    name,
    createdAt: existingSnapshot?.createdAt || now,
    updatedAt: now,
    lastSavedAt: now,
    saveCount: (existingSnapshot?.saveCount || 0) + 1,
    isDraft: true,
    isPublished: existingSnapshot?.isPublished || false,
    publishedAt: existingSnapshot?.publishedAt,
    graphs,
    activeGraphId,
    trigger: trigger || existingSnapshot?.trigger,
    metadata: {
      version: '2.0.0', // Updated version for multi-graph support
      totalNodeCount,
      totalConnectionCount,
      totalGroupCount,
      graphCount: graphs.length,
      tags: existingSnapshot?.metadata?.tags || ['draft']
    }
  }
}

// Legacy single-graph snapshot support for backwards compatibility
export function createLegacyWorkflowSnapshot(
  nodes: Array<{ metadata: NodeMetadata; position: { x: number; y: number } }>,
  connections: Connection[],
  name: string = 'Untitled Workflow',
  id?: string,
  existingSnapshot?: WorkflowSnapshot,
  groups: NodeGroup[] = [],
  trigger?: any,
  canvasState?: { offset: { x: number; y: number }; zoom: number },
  portPositions?: Map<string, { nodeId: string; portId: string; x: number; y: number; position: 'top' | 'right' | 'bottom' | 'left' }>
): WorkflowSnapshot {
  // Create a single main graph
  const mainGraph = createWorkflowGraph(
    'main',
    'Main',
    'main',
    true,
    nodes,
    connections,
    groups,
    canvasState,
    portPositions
  )
  
  return createWorkflowSnapshot([mainGraph], 'main', name, id, existingSnapshot, trigger)
}

// Restore a single graph from serialized format
export function restoreGraphFromSerialized(graph: WorkflowGraph): {
  nodes: Array<{ metadata: NodeMetadata; position: { x: number; y: number } }>
  connections: Connection[]
  groups: NodeGroup[]
  canvasState?: { offset: { x: number; y: number }; zoom: number }
  portPositions?: Map<string, { nodeId: string; portId: string; x: number; y: number; position: 'top' | 'right' | 'bottom' | 'left' }>
} {
  const portPositionsMap = graph.portPositions ? new Map(
    graph.portPositions.map(pos => [pos.key, { nodeId: pos.nodeId, portId: pos.portId, x: pos.x, y: pos.y, position: pos.position }])
  ) : undefined

  return {
    nodes: graph.nodes.map(deserializeNode),
    connections: graph.connections,
    groups: graph.groups || [],
    canvasState: graph.canvasState,
    portPositions: portPositionsMap
  }
}

// Restore workflow from snapshot (multi-graph aware)
export function restoreWorkflowFromSnapshot(snapshot: WorkflowSnapshot): {
  graphs?: WorkflowGraph[]
  // Legacy single-graph fields for backwards compatibility
  nodes?: Array<{ metadata: NodeMetadata; position: { x: number; y: number } }>
  connections?: Connection[]
  groups?: NodeGroup[]
  canvasState?: { offset: { x: number; y: number }; zoom: number }
} {
  // Check if this is a multi-graph snapshot (v2.0.0+)
  if (snapshot.graphs && Array.isArray(snapshot.graphs)) {
    return {
      graphs: snapshot.graphs
    }
  }
  
  // Legacy single-graph snapshot (backwards compatibility)
  if (snapshot.nodes) {
    return {
      nodes: snapshot.nodes.map(deserializeNode),
      connections: snapshot.connections || [],
      groups: snapshot.groups || [],
      canvasState: snapshot.canvasState
    }
  }
  
  // Empty workflow
  return {
    graphs: [{
      id: 'main',
      name: 'Main',
      namespace: 'main',
      isMain: true,
      nodes: [],
      connections: [],
      groups: []
    }]
  }
}