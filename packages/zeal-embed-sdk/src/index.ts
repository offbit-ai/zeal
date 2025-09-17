/**
 * Zeal Embed SDK
 * Wrapper SDK for embedding Zeal workflow editor in web applications
 */

export { ZealEmbed } from './embed'
export { EmbedConfigBuilder } from './builder'
export { EmbedWebSocketHandler } from './websocket'
export { ZIPClient } from './zip-client'

// Export runtime for optional worker-based execution
export { ZealReflowRuntime } from './worker/runtime/reflow-runtime'
export { TemplateActorBuilder } from './worker/runtime/reflow-runtime'
export type { ExecutionHandle } from './worker/bridge/execution-handle'

export type {
  EmbedConfig,
  EmbedInstance,
  EmbedMessage,
  EmbedDisplay,
  EmbedPermissions,
  EmbedRateLimits,
  NodeTemplate,
  WorkflowExecutionRequest,
  WorkflowExecutionResult,
} from './types'

// Re-export ZIP event types for consumers
export type {
  NodeExecutingEvent,
  NodeCompletedEvent,
  NodeFailedEvent,
  NodeWarningEvent,
  ExecutionStartedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  WorkflowCreatedEvent,
  WorkflowUpdatedEvent,
  WorkflowDeletedEvent,
  NodeAddedEvent,
  NodeUpdatedEvent,
  NodeDeletedEvent,
  ConnectionAddedEvent,
  ConnectionDeletedEvent,
  GroupCreatedEvent,
  GroupUpdatedEvent,
  GroupDeletedEvent,
  ConnectionStateEvent,
} from '../../../types/zip-events'