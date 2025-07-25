import { Database, Code, Bot, Cloud, Zap, GitBranch, Shuffle, FileJson, Globe, Shield, Package, Terminal, MessageSquare, Wrench, type LucideIcon } from 'lucide-react'
import type { WorkflowSnapshot, SerializedNode, SerializedConnection } from '@/types/snapshot'
import type { NodeMetadata, Connection } from '@/types/workflow'

// Icon name to component mapping
const iconMap: Record<string, LucideIcon> = {
  Database,
  Code,
  Bot,
  Cloud,
  Zap,
  GitBranch,
  Shuffle,
  FileJson,
  Globe,
  Shield,
  Package,
  Terminal,
  MessageSquare,
  Wrench
}

// Get icon name from component
function getIconName(icon: LucideIcon): string {
  for (const [name, component] of Object.entries(iconMap)) {
    if (component === icon) return name
  }
  return 'Code' // Default icon
}

// Get icon component from name
function getIconComponent(name: string): LucideIcon {
  return iconMap[name] || Code // Default to Code icon
}

// Serialize a single node
export function serializeNode(node: { metadata: NodeMetadata; position: { x: number; y: number } }): SerializedNode {
  return {
    id: node.metadata.id,
    type: node.metadata.type,
    position: node.position,
    metadata: {
      ...node.metadata,
      icon: getIconName(node.metadata.icon)
    }
  }
}

// Deserialize a single node
export function deserializeNode(serialized: SerializedNode): { metadata: NodeMetadata; position: { x: number; y: number } } {
  return {
    position: serialized.position,
    metadata: {
      ...serialized.metadata,
      icon: getIconComponent(serialized.metadata.icon)
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