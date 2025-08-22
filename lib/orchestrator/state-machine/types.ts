/**
 * Dynamic State Machine Types for Orchestrator Agent
 * This provides a flexible, LLM-driven state machine architecture
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: any
}

export interface WorkflowIntent {
  description: string
  suggestedName: string
  suggestedDescription: string
  suggestedNodes: Array<{
    query: string
    position: { x: number; y: number }
    purpose: string
    expectedPorts?: {
      inputs?: string[]
      outputs?: string[]
    }
  }>
  suggestedConnections?: Array<{
    fromNode: number
    fromPort: string
    toNode: number
    toPort: string
    dataType?: string
  }>
  suggestedGroups?: Array<{
    name: string
    nodeIndices: number[]
    purpose?: string
  }>
}

/**
 * Core state types that the system can be in
 */
export enum StateType {
  // Initial states
  IDLE = 'IDLE',
  ANALYZE_CONTEXT = 'ANALYZE_CONTEXT',
  
  // Intent and planning states
  DETECT_INTENT = 'DETECT_INTENT',
  CLARIFY_INTENT = 'CLARIFY_INTENT',
  PLAN_WORKFLOW = 'PLAN_WORKFLOW',
  
  // Creation states
  SEARCH_TEMPLATES = 'SEARCH_TEMPLATES',
  CREATE_NODES = 'CREATE_NODES',
  CONNECT_NODES = 'CONNECT_NODES',
  CREATE_GROUPS = 'CREATE_GROUPS',
  CREATE_SUBGRAPH = 'CREATE_SUBGRAPH',
  
  // Configuration states
  EVALUATE_WORKFLOW = 'EVALUATE_WORKFLOW',
  COLLECT_PROPERTIES = 'COLLECT_PROPERTIES',
  UPDATE_PROPERTIES = 'UPDATE_PROPERTIES',
  
  // Modification states
  ANALYZE_MODIFICATION = 'ANALYZE_MODIFICATION',
  EXECUTE_MODIFICATION = 'EXECUTE_MODIFICATION',
  REMOVE_NODES = 'REMOVE_NODES',
  
  // Feedback and recovery states
  HANDLE_FEEDBACK = 'HANDLE_FEEDBACK',
  HANDLE_INTERRUPTION = 'HANDLE_INTERRUPTION',
  ERROR_RECOVERY = 'ERROR_RECOVERY',
  
  // Completion states
  GENERATE_SUMMARY = 'GENERATE_SUMMARY',
  COMPLETE = 'COMPLETE'
}

/**
 * Action types that can be performed in a state
 */
export type ActionType = 'llm' | 'tool' | 'collect' | 'decide' | 'composite'

/**
 * LLM action configuration
 */
export interface LLMAction {
  type: 'llm'
  prompt: string
  systemPrompt?: string
  contextKeys: string[] // Which context variables to include
  expectedOutput: 'json' | 'text' | 'decision'
  parseResponse?: (response: string) => any
}

/**
 * Tool action configuration
 */
export interface ToolAction {
  type: 'tool'
  toolName: string
  toolMethod: string
  parameters: Record<string, any> | ((context: StateContext) => Record<string, any>)
  handleResponse?: (response: any) => any
}

/**
 * Input collection action
 */
export interface CollectAction {
  type: 'collect'
  questions: PropertyQuestion[]
  validators?: ((input: string) => boolean)[]
  allowInterruption: boolean
}

/**
 * Decision action
 */
export interface DecisionAction {
  type: 'decide'
  decisionLogic: (context: StateContext) => string // Returns next state
}

/**
 * Composite action that can perform multiple sub-actions
 */
export interface CompositeAction {
  type: 'composite'
  actions: (LLMAction | ToolAction | CollectAction | DecisionAction)[]
  parallel?: boolean // Execute actions in parallel if possible
}

/**
 * State transition condition
 */
export interface StateTransition {
  condition: string | ((context: StateContext, result: any) => boolean)
  nextState: StateType
  priority?: number
  saveToContext?: Record<string, string> // Map result fields to context keys
}

/**
 * Dynamic state definition
 */
export interface DynamicState {
  id: StateType
  name: string
  description: string
  
  // What this state does
  action: LLMAction | ToolAction | CollectAction | DecisionAction | CompositeAction
  
  // Possible transitions from this state
  transitions: StateTransition[]
  
  // State behavior configuration
  config: {
    interruptible: boolean // Can this state be interrupted?
    resumable: boolean // Can we return to this state after interruption?
    timeout?: number // Max time in ms before timeout
    retryable?: boolean // Can retry on failure?
    maxRetries?: number
  }
  
  // Optional lifecycle hooks
  onEnter?: (context: StateContext) => Promise<void>
  onExit?: (context: StateContext) => Promise<void>
  onError?: (context: StateContext, error: Error) => Promise<StateType>
}

/**
 * Property question for collecting user input
 */
export interface PropertyQuestion {
  nodeId: string
  nodeTitle: string
  propertyName: string
  propertyType: 'text' | 'number' | 'boolean' | 'code' | 'url' | 'cron' | 'rules'
  question: string
  currentValue?: any
  suggestedValue?: any
  required: boolean
}

/**
 * Goal stack entry for handling interruptions
 */
export interface Goal {
  id: string
  type: 'workflow_creation' | 'property_collection' | 'modification' | 'error_recovery'
  state: StateType
  description: string
  context: Map<string, any> // Snapshot of context when goal was created
  priority: number
}

/**
 * Complete state context
 */
export interface StateContext {
  // Current state information
  currentState: StateType
  previousState?: StateType
  stateHistory: StateType[]
  
  // Workflow context
  workflowId?: string
  workflowName?: string
  graphId: string
  
  // Available resources
  existingNodes: any[]
  existingConnections: any[]
  existingGroups: any[]
  existingGraphs: string[]
  
  // User interaction context
  originalRequest: string
  currentInput?: string
  chatHistory: ChatMessage[]
  
  // Planning and intent
  intent?: WorkflowIntent
  workflowPlan?: any
  
  // Node and template mappings
  nodeMap: Map<string, string> // query -> nodeId
  templateMap: Map<string, any> // query -> template
  
  // Property collection
  pendingQuestions: PropertyQuestion[]
  collectedProperties: Map<string, Record<string, any>> // nodeId -> properties
  
  // Goal and interruption management
  goalStack: Goal[]
  currentGoal?: Goal
  
  // Evaluation results
  evaluationResult?: {
    hasIssues: boolean
    issues: any[]
    missingProperties: any[]
    fixes: any[]
  }
  
  // Error context
  lastError?: Error
  errorCount: number
  
  // Additional dynamic context
  dynamicContext: Map<string, any>
}

/**
 * State machine configuration
 */
export interface StateMachineConfig {
  states: Map<StateType, DynamicState>
  initialState: StateType
  maxGoalStackDepth: number
  defaultTimeout: number
  enableLogging: boolean
  enableVisualization: boolean
}

/**
 * State execution result
 */
export interface StateExecutionResult {
  success: boolean
  nextState?: StateType
  output?: any
  error?: Error
  shouldYield?: boolean
  yieldValue?: any
}

/**
 * Streaming response types
 */
export interface StreamingResponse {
  type: 'status' | 'message' | 'question' | 'error' | 'complete' | 'state_change' | 'action' | 'crdt_sync_required' | 'workflow_ready' | 'force_reload'
  content: string
  metadata?: any
  questions?: PropertyQuestion[]
  workflowId?: string
}

/**
 * State graph for visualization
 */
export interface StateGraph {
  nodes: {
    id: StateType
    label: string
    type: 'start' | 'process' | 'decision' | 'end'
  }[]
  edges: {
    from: StateType
    to: StateType
    label: string
    condition?: string
  }[]
  currentState?: StateType
}