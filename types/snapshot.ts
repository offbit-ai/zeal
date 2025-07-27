export interface WorkflowSnapshot {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  lastSavedAt: string
  saveCount: number
  isDraft: boolean
  isPublished: boolean
  publishedAt?: string
  nodes: SerializedNode[]
  connections: SerializedConnection[]
  groups: SerializedGroup[]
  trigger?: any // Will store TriggerConfig from TriggerModal
  canvasState?: {
    offset: { x: number; y: number }
    zoom: number
  }
  metadata?: {
    version: string
    author?: string
    tags?: string[]
    nodeCount?: number
    connectionCount?: number
    groupCount?: number
  }
}

export interface SerializedNode {
  id: string
  type: string
  position: { x: number; y: number }
  metadata: {
    id: string
    type: string
    title: string
    subtitle?: string
    icon: string // Icon name as string
    variant: 'black' | 'gray-700' | 'gray-600' | 'gray-500'
    shape: 'rectangle' | 'circle' | 'diamond'
    size: 'small' | 'medium' | 'large'
    ports: Array<{
      id: string
      label: string
      type: 'input' | 'output'
      position: 'top' | 'right' | 'bottom' | 'left'
    }>
    properties: Array<{
      id: string
      label: string
      type: string
      [key: string]: any
    }>
    propertyValues: Record<string, any>
  }
}

export interface SerializedConnection {
  id: string
  source: {
    nodeId: string
    portId: string
  }
  target: {
    nodeId: string
    portId: string
  }
  state: 'pending' | 'warning' | 'error' | 'success'
}

export interface SerializedGroup {
  id: string
  title: string
  description: string
  nodeIds: string[]
  position: { x: number; y: number }
  size: { width: number; height: number }
  color?: string
  collapsed?: boolean
  createdAt: string
  updatedAt: string
}