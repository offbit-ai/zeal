export interface TemplateNode {
  id: string
  type: 'template'
  data: {
    title: string
    description: string
    category: string
    subcategory?: string
    tags: string[]
    capabilities: string[]
    inputs: Record<string, any>
    outputs: Record<string, any>
  }
}

export interface ServiceNode {
  id: string
  type: 'service'
  data: {
    name: string
    serviceType: string // 'messaging', 'vcs', 'database', etc.
    aliases: string[]
  }
}

export interface CapabilityNode {
  id: string
  type: 'capability'
  data: {
    name: string
    description: string
  }
}

export interface DataTypeNode {
  id: string
  type: 'datatype'
  data: {
    name: string
    schema: any
  }
}

export type GraphNode = TemplateNode | ServiceNode | CapabilityNode | DataTypeNode

export interface GraphEdge {
  source: string
  target: string
  type: 'CAN_CONNECT_TO' | 'HAS_CAPABILITY' | 'INTEGRATES_WITH' | 'ACCEPTS' | 'OUTPUTS' | 'ALTERNATIVE_TO' | 'COMMONLY_USED_WITH'
  data?: {
    port?: string
    confidence?: number
    [key: string]: any
  }
}

export interface GraphQuery {
  services?: string[]
  capabilities?: string[]
  excludeServices?: string[]
  excludeCapabilities?: string[]
  maxDepth?: number
}

export interface RelevanceScore {
  nodeId: string
  score: number
  reasons: string[]
  connections: string[]
  metadata?: {
    role?: string
    sequence?: number
    [key: string]: any
  }
}