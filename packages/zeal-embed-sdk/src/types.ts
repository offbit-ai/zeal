/**
 * Zeal Embed SDK Types
 */

import { ZIPClient } from './zip-client'

/**
 * ZIP SDK Type Definitions
 * Matches the server-side types in @/types/zip
 */

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


export interface EmbedDisplay {
  minimap?: boolean
  zoomControls?: boolean
  subgraphTabs?: boolean
  nodeCreation?: boolean
  theme?: 'light' | 'dark' | 'auto'
}

export interface EmbedConfig {
  /**
   * Container element or selector where the embed will be mounted
   */
  container: HTMLElement | string
  
  /**
   * Base URL of the Zeal instance
   */
  baseUrl?: string
  
  /**
   * Workflow ID to embed
   */
  workflowId?: string
  
  /**
   * Auth token for SDK operations (will fallback to sessionStorage if not provided)
   */
  authToken?: string
  
  /**
   * Height of the embed (CSS value)
   */
  height?: string
  
  /**
   * Width of the embed (CSS value)
   */
  width?: string
  
  /**
   * Display options
   */
  display?: EmbedDisplay
  
  /**
   * Permissions for the embed
   */
  permissions?: EmbedPermissions
  
  /**
   * Custom node libraries to load
   */
  nodeLibraries?: string[]
  
  /**
   * Elements to hide (CSS selectors)
   */
  hideElements?: string[]
  
  /**
   * Enable read-only mode
   */
  readonly?: boolean
  
  /**
   * Allowed origins for CORS
   */
  allowedOrigins?: string[]
  
  /**
   * Rate limits
   */
  rateLimits?: EmbedRateLimits
  
  /**
   * Event handlers
   */
  events?: {
    onReady?: () => void
    onError?: (error: Error) => void
    onNodeAdded?: (node: any) => void
    onNodeUpdated?: (node: any) => void
    onNodeDeleted?: (nodeId: string) => void
    onConnectionCreated?: (connection: any) => void
    onConnectionDeleted?: (connectionId: string) => void
    onWorkflowSaved?: (workflow: any) => void
    onExecutionStarted?: (sessionId: string) => void
    onExecutionCompleted?: (result: any) => void
    onExecutionFailed?: (error: any) => void
  }
}

export interface EmbedPermissions {
  canAddNodes: boolean
  canEditNodes: boolean
  canDeleteNodes: boolean
  canAddGroups: boolean
  canEditGroups: boolean
  canDeleteGroups: boolean
  canExecute: boolean
  canViewWorkflow: boolean
  canExportData: boolean
  allowedNodeTypes?: string[]
  maxNodes?: number
  maxGroups?: number
}

export interface EmbedRateLimits {
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
  executionsPerHour: number
  executionsPerDay: number
}

export interface EmbedMessage {
  type: string
  data?: any
  error?: string
  timestamp: number
}


export interface WorkflowExecutionRequest {
  workflowId: string
  inputs?: Record<string, any>
  config?: {
    timeout?: number
    maxRetries?: number
    continueOnError?: boolean
  }
}

export interface WorkflowExecutionResult {
  sessionId: string
  status: 'completed' | 'failed' | 'cancelled'
  outputs?: Record<string, any>
  errors?: Array<{
    nodeId: string
    error: string
    timestamp: string
  }>
  duration: number
  executedNodes: number
}

export interface EmbedInstance {
  /**
   * The iframe element
   */
  iframe: HTMLIFrameElement
  
  /**
   * ZIP SDK client instance (browser-compatible)
   */
  client: ZIPClient
  
  /**
   * Send a message to the embed
   */
  postMessage: (message: EmbedMessage) => void
  
  /**
   * Execute a workflow
   */
  execute: (request?: WorkflowExecutionRequest) => Promise<WorkflowExecutionResult>
  
  /**
   * Save the current workflow
   */
  save: () => Promise<void>
  
  /**
   * Load a workflow
   */
  load: (workflowId: string) => Promise<void>
  
  /**
   * Get current workflow data
   */
  getWorkflow: () => Promise<any>
  
  /**
   * Set workflow data
   */
  setWorkflow: (workflow: any) => Promise<void>
  
  /**
   * Add a custom node template
   */
  addNodeTemplate: (template: NodeTemplate) => Promise<void>
  
  /**
   * Register multiple node templates
   */
  registerNodeTemplates: (templates: NodeTemplate[]) => Promise<void>
  
  /**
   * Update display options
   */
  updateDisplay: (options: EmbedConfig['display']) => void
  
  /**
   * Destroy the embed instance
   */
  destroy: () => void
  
  /**
   * Check if embed is ready
   */
  isReady: () => boolean
  
  /**
   * Wait for embed to be ready
   */
  waitForReady: () => Promise<void>
}

