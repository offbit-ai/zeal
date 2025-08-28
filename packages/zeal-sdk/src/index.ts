/**
 * Zeal Integration Protocol (ZIP) SDK
 * TypeScript client for integrating with Zeal workflow editor
 */

export * from './client'
export * from './templates'
export * from './orchestrator'
export * from './traces'
export * from './events'
export * from './webhooks'
export * from './webhook-subscription'
export * from './types'

// Re-export event types for SDK users
export type {
  ZipWebSocketEvent,
  ZipWebhookEvent,
  ZipExecutionEvent,
  ZipWorkflowEvent,
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
} from '../../../types/zip-events'

export {
  isExecutionEvent,
  isWorkflowEvent,
  isControlEvent,
  isNodeEvent,
  createNodeExecutingEvent,
  createNodeCompletedEvent,
  createNodeFailedEvent,
  createExecutionStartedEvent,
} from '../../../types/zip-events'

import { ZealClient } from './client'

// Default export for convenience
export default ZealClient