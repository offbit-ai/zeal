// Zeal Integration Protocol (ZIP) Types

// Node Template Types
export interface NodeTemplate {
  id: string
  type: string
  title: string
  subtitle?: string
  category: string
  subcategory?: string
  description: string
  icon: string
  variant?: string
  shape?: 'rectangle' | 'circle' | 'diamond'
  size?: 'small' | 'medium' | 'large'
  
  // Port definitions
  ports: Port[]
  
  // Property definitions
  properties?: Record<string, PropertyDefinition>
  
  // Dynamic property rules
  propertyRules?: PropertyRules
  
  // Runtime requirements
  runtime?: RuntimeRequirements
}

export interface Port {
  id: string
  label: string
  type: 'input' | 'output'
  position: 'left' | 'right' | 'top' | 'bottom'
  dataType?: string
  required?: boolean
  multiple?: boolean
}

export interface PropertyDefinition {
  type: 'string' | 'number' | 'boolean' | 'select' | 'code-editor'
  label?: string
  description?: string
  defaultValue?: any
  options?: any[]
  validation?: PropertyValidation
}

export interface PropertyValidation {
  required?: boolean
  min?: number
  max?: number
  pattern?: string
}

export interface PropertyRules {
  triggers: string[]
  rules: PropertyRule[]
}

export interface PropertyRule {
  when: string
  updates: Record<string, any>
}

export interface RuntimeRequirements {
  executor: string
  version?: string
  requiredEnvVars?: string[]
  capabilities?: string[]
}

// Request/Response Types
export interface RegisterTemplatesRequest {
  namespace: string
  templates: NodeTemplate[]
  webhookUrl?: string
}

export interface RegisterTemplatesResponse {
  registered: number
  templates: Array<{
    id: string
    globalId: string
    status: 'registered' | 'updated' | 'error'
    error?: string
  }>
}

// Orchestrator Types
export interface CreateWorkflowRequest {
  name: string
  description?: string
  metadata?: Record<string, any>
}

export interface CreateWorkflowResponse {
  workflowId: string
  graphId: string
  embedUrl: string
  version: number
  apiKey?: string
}

export interface AddNodeRequest {
  workflowId: string
  graphId?: string
  templateId: string
  position: { x: number; y: number }
  propertyValues?: Record<string, any>
}

export interface AddNodeResponse {
  nodeId: string
  node: {
    id: string
    type: string
    position: { x: number; y: number }
    metadata: any
  }
}

export interface ConnectNodesRequest {
  workflowId: string
  graphId?: string
  source: {
    nodeId: string
    portId: string
  }
  target: {
    nodeId: string
    portId: string
  }
}

export interface ConnectNodesResponse {
  connectionId: string
  connection: any
}

export interface UpdateNodeRequest {
  workflowId: string
  graphId?: string
  properties?: Record<string, any>
  position?: { x: number; y: number }
}

export interface CreateGroupRequest {
  workflowId: string
  graphId?: string
  title: string
  nodeIds: string[]
  color?: string
  description?: string
}

// Event Types
export enum ZealEventType {
  // Workflow events
  WORKFLOW_CREATED = 'workflow.created',
  WORKFLOW_UPDATED = 'workflow.updated',
  WORKFLOW_DELETED = 'workflow.deleted',
  
  // Node events
  NODE_ADDED = 'node.added',
  NODE_UPDATED = 'node.updated',
  NODE_DELETED = 'node.deleted',
  NODE_PROPERTIES_CHANGED = 'node.properties.changed',
  
  // Connection events
  CONNECTION_CREATED = 'connection.created',
  CONNECTION_DELETED = 'connection.deleted',
  
  // Execution control
  EXECUTION_START = 'execution.start',
  EXECUTION_STOP = 'execution.stop',
  EXECUTION_PAUSE = 'execution.pause',
  EXECUTION_RESUME = 'execution.resume',
  
  // User events
  USER_JOINED = 'user.joined',
  USER_LEFT = 'user.left',
  USER_CURSOR_MOVED = 'user.cursor.moved'
}

export interface ZealEvent {
  id: string
  timestamp: number
  workflowId: string
  type: ZealEventType
  data: any
}

export enum RuntimeEventType {
  // Node execution events
  NODE_EXECUTION_START = 'node.execution.start',
  NODE_EXECUTION_SUCCESS = 'node.execution.success',
  NODE_EXECUTION_ERROR = 'node.execution.error',
  NODE_EXECUTION_PROGRESS = 'node.execution.progress',
  
  // Connection flow events
  CONNECTION_FLOW_START = 'connection.flow.start',
  CONNECTION_FLOW_END = 'connection.flow.end',
  CONNECTION_FLOW_ERROR = 'connection.flow.error',
  
  // Workflow execution events
  WORKFLOW_EXECUTION_START = 'workflow.execution.start',
  WORKFLOW_EXECUTION_COMPLETE = 'workflow.execution.complete',
  WORKFLOW_EXECUTION_ERROR = 'workflow.execution.error'
}

export interface RuntimeEvent {
  type: RuntimeEventType
  workflowId: string
  timestamp: number
  data: any
}

export interface VisualStateUpdate {
  type: 'visual.state.update'
  elements: Array<{
    id: string
    elementType: 'node' | 'connection'
    state: 'idle' | 'pending' | 'running' | 'success' | 'error' | 'warning'
    progress?: number
    message?: string
    highlight?: boolean
    color?: string
  }>
}

// Trace Types
export interface CreateTraceSessionRequest {
  workflowId: string
  workflowVersionId?: string
  executionId: string
  metadata?: {
    trigger?: string
    environment?: string
    tags?: string[]
  }
}

export interface CreateTraceSessionResponse {
  sessionId: string
  startTime: string
}

export interface TraceEvent {
  timestamp: number
  nodeId: string
  portId?: string
  eventType: 'input' | 'output' | 'error' | 'log'
  data: {
    size: number
    type: string
    preview?: any
    fullData?: any
  }
  duration?: number
  metadata?: {
    cpuUsage?: number
    memoryUsage?: number
    custom?: Record<string, any>
  }
  error?: {
    message: string
    stack?: string
    code?: string
  }
}

export interface SubmitTraceEventsRequest {
  events: TraceEvent[]
}

export interface CompleteTraceSessionRequest {
  status: 'success' | 'error' | 'cancelled'
  summary?: {
    totalNodes: number
    successfulNodes: number
    failedNodes: number
    totalDuration: number
    totalDataProcessed: number
  }
  error?: {
    message: string
    nodeId?: string
    stack?: string
  }
}

export interface BatchTraceSubmission {
  sessionId: string
  events: TraceEvent[]
  isComplete?: boolean
}

// Execution History Types
export interface ListExecutionsRequest {
  workflowId?: string
  status?: 'running' | 'completed' | 'failed'
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export interface ExecutionSummary {
  sessionId: string
  workflowId: string
  workflowName: string
  startTime: string
  endTime?: string
  status: string
  summary: {
    totalNodes: number
    successfulNodes: number
    failedNodes: number
    totalDuration: number
  }
}

export interface ReplayData {
  sessionId: string
  workflowSnapshot: any
  events: Array<{
    timestamp: number
    relativeTime: number
    nodeId: string
    eventType: string
    data: any
  }>
  timeline: {
    totalDuration: number
    nodeTimings: Record<string, {
      startTime: number
      endTime: number
      duration: number
    }>
  }
}

// Authentication Types
export interface CreateApiKeyRequest {
  name: string
  permissions: string[]
  expiresAt?: string
  metadata?: Record<string, any>
}

export interface ApiKeyResponse {
  id: string
  key: string
  name: string
  permissions: string[]
  createdAt: string
  expiresAt?: string
}

export type PermissionScope = 
  | 'templates:read'
  | 'templates:write'
  | 'workflows:read'
  | 'workflows:write'
  | 'orchestrator:execute'
  | 'traces:write'
  | 'traces:read'
  | 'events:subscribe'
  | 'events:publish'

// Error Response
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
    traceId?: string
  }
}

export type ErrorCode = 
  | 'AUTH_INVALID_KEY'
  | 'AUTH_INSUFFICIENT_PERMISSIONS'
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'

// Health Check
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  version: string
  services: {
    api: 'healthy' | 'unhealthy'
    crdt: 'healthy' | 'unhealthy'
    database: 'healthy' | 'unhealthy'
    websocket: 'healthy' | 'unhealthy'
  }
}