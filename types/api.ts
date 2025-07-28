// Base API response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    pagination?: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
    timestamp: string
    requestId: string
  }
}

// API Error types
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Common API request/response patterns
export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface FilterParams {
  search?: string
  category?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}

// Environment Variables API types
export interface EnvVarCreateRequest {
  key: string
  value: string
  isSecret: boolean
  description?: string
  category: 'environment' | 'secrets'
}

export interface EnvVarUpdateRequest {
  value?: string
  isSecret?: boolean
  description?: string
}

export interface EnvVarResponse {
  id: string
  key: string
  value: string
  isSecret: boolean
  description?: string
  category: 'environment' | 'secrets'
  createdAt: string
  updatedAt: string
  createdBy: string
}

// Workflow API types
export interface WorkflowCreateRequest {
  name: string
  description?: string
  graphs: WorkflowGraphData[]
  activeGraphId?: string
  triggerConfig?: any
  metadata?: Record<string, any>
}

export interface WorkflowGraphData {
  id: string
  name: string
  namespace: string
  isMain: boolean
  nodes: WorkflowNodeData[]
  connections: WorkflowConnectionData[]
  groups?: WorkflowGroupData[]
  canvasState?: {
    offset: { x: number; y: number }
    zoom: number
  }
}

export interface WorkflowUpdateRequest {
  name?: string
  description?: string
  graphs?: WorkflowGraphData[]
  activeGraphId?: string
  triggerConfig?: any
  metadata?: Record<string, any>
}

export interface WorkflowNodeData {
  id: string
  type: string
  title: string
  subtitle?: string
  position: { x: number; y: number }
  properties: Record<string, any>
  requiredEnvVars?: string[]
}

export interface WorkflowConnectionData {
  id: string
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
  state?: 'pending' | 'warning' | 'error' | 'success'
}

export interface WorkflowResponse {
  id: string
  name: string
  description?: string
  nodes: WorkflowNodeData[]
  connections: WorkflowConnectionData[]
  metadata?: Record<string, any>
  status: 'draft' | 'published' | 'archived'
  version: number
  createdAt: string
  updatedAt: string
  publishedAt?: string
  createdBy: string
  lastModifiedBy: string
}

// Node Repository API types
export interface NodeTemplateResponse {
  id: string
  name: string
  description: string
  category: string
  subcategory?: string
  version: string
  author: string
  isBuiltIn: boolean
  isInstalled: boolean
  metadata: {
    type: string
    title: string
    subtitle?: string
    iconName: string
    variant: string
    shape: string
    size: string
    ports: NodePortData[]
    properties: NodePropertyData[]
    requiredEnvVars?: string[]
  }
  documentation?: string
  keywords: string[]
  tags: string[]
  downloadCount: number
  rating: number
  createdAt: string
  updatedAt: string
}

export interface NodePortData {
  id: string
  label: string
  type: 'input' | 'output'
  position: 'top' | 'right' | 'bottom' | 'left'
  dataType?: string
  required?: boolean
}

export interface NodePropertyData {
  id: string
  label: string
  type: string
  defaultValue?: any
  options?: string[]
  placeholder?: string
  required?: boolean
  description?: string
  validation?: {
    min?: number
    max?: number
    pattern?: string
    custom?: string
  }
}

// Flow Tracing API types
export interface FlowTraceSession {
  id: string
  workflowId: string
  workflowName: string
  status: 'running' | 'completed' | 'failed'
  startTime: string
  endTime?: string
  triggeredBy: string
  metadata?: Record<string, any>
  summary: {
    totalTraces: number
    successCount: number
    errorCount: number
    warningCount: number
    averageDuration: number
    totalDataSize: number
  }
}

export interface FlowTraceResponse {
  id: string
  sessionId: string
  timestamp: string
  duration: number
  status: 'success' | 'error' | 'warning'
  source: {
    nodeId: string
    nodeName: string
    nodeType: string
    portId: string
    portName: string
    portType: 'input' | 'output'
  }
  target: {
    nodeId: string
    nodeName: string
    nodeType: string
    portId: string
    portName: string
    portType: 'input' | 'output'
  }
  data: {
    type: string
    size: number
    payload: any
    metadata?: Record<string, any>
  }
  error?: {
    code: string
    message: string
    stack?: string
  }
}

// Execution API types
export interface WorkflowExecutionRequest {
  workflowId: string
  input?: Record<string, any>
  configuration?: {
    timeout?: number
    retryCount?: number
    environment?: string
  }
}

export interface WorkflowExecutionResponse {
  id: string
  workflowId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: string
  endTime?: string
  input?: Record<string, any>
  output?: Record<string, any>
  error?: {
    code: string
    message: string
    stack?: string
  }
  traceSessionId?: string
  metadata?: Record<string, any>
}