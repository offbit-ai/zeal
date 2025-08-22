export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    nodeCount?: number
    connectionCount?: number
    workflowId?: string
    pendingQuestions?: PropertyQuestion[]
    requiresInput?: boolean
    workflowReady?: boolean
  }
}

export interface AgentAction {
  tool: string
  arguments: Record<string, any>
  result?: any
}

export interface AgentResponse {
  message: string
  actions?: AgentAction[]
  workflowCreated?: boolean
  workflowId?: string
  metadata?: Record<string, any>
}

export interface StreamingAgentResponse {
  type: 'message' | 'action' | 'status' | 'complete' | 'error' | 'question' | 'workflow_ready' | 'crdt_sync_required'
  content?: string
  action?: AgentAction
  workflowId?: string
  metadata?: Record<string, any>
  questions?: PropertyQuestion[]
  requiresInput?: boolean
}

export interface PropertyQuestion {
  nodeId: string
  nodeTitle: string
  propertyName: string
  propertyType: string
  question: string
  currentValue?: any
  suggestedValue?: any
  required: boolean
}

export interface WorkflowContext {
  workflowId: string
  nodes: Map<string, any>  // Template definitions
  nodeMap?: Map<string, any>  // Actual node IDs and mappings
  connections: any[]
  pendingQuestions: PropertyQuestion[]
  propertyValues: Map<string, Record<string, any>>
  conversationHistory: ChatMessage[]
  lastUserRequest: string
  intent: WorkflowIntent
  questionRounds?: number  // Track how many times we've asked questions
  workflowSummary?: string  // Summary of why nodes were selected
  refinementSummary?: string | null  // Summary of any refinements made
}

export interface WorkflowIntent {
  description: string
  suggestedNodes: Array<{
    query: string
    position: { x: number; y: number }
    purpose?: string
    connections?: Array<{
      from: string
      to: string
    }>
  }>
  suggestedName?: string
  suggestedDescription?: string
}
