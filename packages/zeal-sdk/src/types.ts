/**
 * ZIP SDK Type Definitions
 * Matches the server-side types in @/types/zip
 */

export interface DisplayComponent {
  element: string
  bundleId?: string
  source?: string
  shadow?: boolean
  observedProps?: string[]
  width?: string
}

export interface UploadBundleRequest {
  namespace: string
  source: string
}

export interface UploadBundleResponse {
  bundleId: string
  namespace: string
  url: string
  size: number
}

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
  ports: Port[]
  properties?: Record<string, PropertyDefinition>
  propertyRules?: PropertyRules
  runtime?: RuntimeRequirements
  display?: DisplayComponent
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

export interface SubcategoryDefinition {
  id: string
  label: string
  description: string
}

export interface CategoryDefinition {
  id: string
  label: string
  description: string
  icon: string
  subcategories: SubcategoryDefinition[]
}

export interface ListCategoriesResponse {
  categories: CategoryDefinition[]
  count: number
}

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

export interface CreateWorkflowRequest {
  name: string
  description?: string
  metadata?: Record<string, any>
}

export interface CreateWorkflowResponse {
  workflowId: string
  graphId: string
  embedUrl: string
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

export enum ZealEventType {
  WORKFLOW_CREATED = 'workflow.created',
  WORKFLOW_UPDATED = 'workflow.updated',
  WORKFLOW_DELETED = 'workflow.deleted',
  NODE_ADDED = 'node.added',
  NODE_UPDATED = 'node.updated',
  NODE_DELETED = 'node.deleted',
  NODE_PROPERTIES_CHANGED = 'node.properties.changed',
  CONNECTION_CREATED = 'connection.created',
  CONNECTION_DELETED = 'connection.deleted',
  EXECUTION_START = 'execution.start',
  EXECUTION_STOP = 'execution.stop',
  EXECUTION_PAUSE = 'execution.pause',
  EXECUTION_RESUME = 'execution.resume',
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
  NODE_EXECUTION_START = 'node.execution.start',
  NODE_EXECUTION_SUCCESS = 'node.execution.success',
  NODE_EXECUTION_ERROR = 'node.execution.error',
  NODE_EXECUTION_PROGRESS = 'node.execution.progress',
  CONNECTION_FLOW_START = 'connection.flow.start',
  CONNECTION_FLOW_END = 'connection.flow.end',
  CONNECTION_FLOW_ERROR = 'connection.flow.error',
  WORKFLOW_EXECUTION_START = 'workflow.execution.start',
  WORKFLOW_EXECUTION_COMPLETE = 'workflow.execution.complete',
  WORKFLOW_EXECUTION_ERROR = 'workflow.execution.error',
  // Stream lifecycle events
  STREAM_OPENED = 'stream.opened',
  STREAM_CLOSED = 'stream.closed',
  STREAM_ERROR = 'stream.error',
}

/**
 * Stream event interfaces
 */
export interface StreamOpenedEvent {
  type: 'stream.opened'
  workflowId: string
  executionId?: string
  nodeId: string
  port: string
  streamId: number
  contentType?: string
  sizeHint?: number
}

export interface StreamClosedEvent {
  type: 'stream.closed'
  workflowId: string
  executionId?: string
  nodeId: string
  streamId: number
  totalBytes: number
}

export interface StreamErrorEvent {
  type: 'stream.error'
  workflowId: string
  executionId?: string
  nodeId: string
  streamId: number
  error: string
}

export type StreamEvent = StreamOpenedEvent | StreamClosedEvent | StreamErrorEvent

/**
 * Parsed binary stream frame
 */
export interface StreamFrame {
  type: 'begin' | 'data' | 'end' | 'error'
  streamId: number
  payload: Uint8Array
  metadata?: any
  message?: string
}

export interface RuntimeEvent {
  type: RuntimeEventType
  workflowId: string
  timestamp: number
  data: any
}

export interface WebhookConfig {
  namespace: string
  url: string
  events?: string[]
  headers?: Record<string, string>
  metadata?: Record<string, any>
}

export interface ZealClientConfig {
  baseUrl: string
  websocketPath?: string
  authToken?: string
}