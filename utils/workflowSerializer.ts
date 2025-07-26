import type { WorkflowSnapshot, SerializedNode, SerializedConnection } from '@/types/snapshot'
import type { NodeMetadata, Connection } from '@/types/workflow'

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

// Create a workflow snapshot
export function createWorkflowSnapshot(
  nodes: Array<{ metadata: NodeMetadata; position: { x: number; y: number } }>,
  connections: Connection[],
  name: string = 'Untitled Workflow',
  id?: string,
  existingSnapshot?: WorkflowSnapshot
): WorkflowSnapshot {
  const now = new Date().toISOString()
  
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
    nodes: nodes.map(serializeNode),
    connections: connections.map(serializeConnection),
    metadata: {
      version: '1.0.0',
      nodeCount: nodes.length,
      connectionCount: connections.length,
      tags: existingSnapshot?.metadata?.tags || ['draft']
    }
  }
}

// Restore workflow from snapshot
export function restoreWorkflowFromSnapshot(snapshot: WorkflowSnapshot): {
  nodes: Array<{ metadata: NodeMetadata; position: { x: number; y: number } }>
  connections: Connection[]
} {
  return {
    nodes: snapshot.nodes.map(deserializeNode),
    connections: snapshot.connections
  }
}