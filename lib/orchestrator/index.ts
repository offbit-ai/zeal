/**
 * Orchestrator Module Entry Point
 * Exports the state machine-based orchestrator agent
 */

export { OrchestratorAgentStateMachine as OrchestratorAgent } from './agent-state-machine'
export type { AgentConfig } from './agent-state-machine'

// Export state machine types for external use
export type {
  StateContext,
  StreamingResponse,
  PropertyQuestion,
  StateMachineConfig,
  DynamicState
} from './state-machine/types'

export { StateType } from './state-machine/types'

// Export state generator for custom configurations
export { 
  DynamicStateGenerator,
  StateMachineTemplates 
} from './state-machine/state-generator'

// Export workflow types
export type {
  WorkflowIntent,
  WorkflowContext,
  ChatMessage,
  AgentResponse,
  AgentAction,
  StreamingAgentResponse
} from './types'

// Helper function to create agent with default configuration
export function createOrchestratorAgent(
  apiKey: string,
  options?: {
    workflowId?: string
    graphId?: string
    enableAutosave?: boolean
    useStateMachine?: boolean
  }
) {
  const { OrchestratorAgentStateMachine } = require('./agent-state-machine')
  
  return new OrchestratorAgentStateMachine({
    apiKey,
    workflowId: options?.workflowId,
    graphId: options?.graphId || 'main',
    enableAutosave: options?.enableAutosave ?? true,
    enableStreaming: true
  })
}

// Export prompts for external use
export {
  SYSTEM_PROMPT,
  INTENT_EXTRACTION_PROMPT,
  WORKFLOW_PLANNING_PROMPT,
  MODIFICATION_INTERPRETATION_PROMPT,
  ERROR_RECOVERY_PROMPT
} from './prompts'