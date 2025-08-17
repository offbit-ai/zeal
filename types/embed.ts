/**
 * Types for embedded workflow functionality
 */

export interface EmbedApiKey {
  id: string
  key: string // The actual API key (hashed in DB)
  name: string
  description?: string
  workflowId: string
  permissions: EmbedPermissions
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
  expiresAt?: string
  isActive: boolean
  usageCount: number
  rateLimits?: RateLimits
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
  allowedNodeTypes?: string[] // If specified, only these node types can be added
  maxNodes?: number // Maximum number of nodes that can be added
  maxGroups?: number // Maximum number of groups that can be created
}

export interface RateLimits {
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
  executionsPerHour: number
  executionsPerDay: number
}

export interface WorkflowEmbedSettings {
  allowEmbed: boolean
  embedPermissions: EmbedPermissions
  requireApiKey: boolean
  allowedOrigins?: string[] // CORS origins that can embed
  customCSS?: string // Custom CSS to inject into embedded view
  hideElements?: string[] // CSS selectors of elements to hide
  theme?: 'light' | 'dark' | 'auto'
}

export interface EmbedSession {
  id: string
  apiKeyId: string
  workflowId: string
  origin: string
  userAgent: string
  ipAddress: string
  startedAt: string
  lastActivityAt: string
  actionsCount: number
  actions: EmbedAction[]
}

export interface EmbedAction {
  type:
    | 'node_added'
    | 'node_updated'
    | 'node_deleted'
    | 'group_added'
    | 'group_updated'
    | 'group_deleted'
    | 'workflow_executed'
  timestamp: string
  data: any
  success: boolean
  error?: string
}
