export interface WorkflowGraph {
  id: string
  name: string
  namespace: string // Used for referencing in subgraph nodes
  isMain: boolean
  nodes: SerializedNode[]
  connections: SerializedConnection[]
  groups: SerializedGroup[]
  canvasState?: {
    offset: { x: number; y: number }
    zoom: number
  }
  portPositions?: Array<{
    key: string // nodeId-portId
    nodeId: string
    portId: string
    x: number
    y: number
    position: 'top' | 'right' | 'bottom' | 'left'
  }>
}

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
  graphs: WorkflowGraph[] // Changed from single graph to array of graphs
  activeGraphId?: string // Currently active graph tab
  triggerConfig?: any // Will store TriggerConfig from TriggerModal
  metadata?: {
    version: string
    author?: string
    tags?: string[]
    totalNodeCount?: number // Total across all graphs
    totalConnectionCount?: number
    totalGroupCount?: number
    graphCount?: number
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
    // Subgraph-specific fields
    graphId?: string
    graphNamespace?: string
    templateId?: string
    requiredEnvVars?: string[]
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
  state?: 'pending' | 'warning' | 'error' | 'success'| 'running',
  metadata?: any
}

export interface SerializedGroup {
  id: string
  title: string
  description: string
  nodeIds: string[]
  position: { x: number; y: number }
  size: { width: number; height: number }
  color?: string
  isCollapsed?: boolean
  createdAt: string
  updatedAt: string
}