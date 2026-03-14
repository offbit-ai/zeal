/**
 * Shared type definitions for ZIP WebSocket and Webhook events
 * These types ensure consistency between SDK, backend, and frontend
 */

/**
 * Base event structure
 */
export interface ZipEventBase {
  /** Unique event ID */
  id: string
  /** Event timestamp */
  timestamp: string
  /** Workflow ID this event relates to */
  workflowId: string
  /** Graph ID (optional, defaults to 'main') */
  graphId?: string
  /** Event metadata */
  metadata?: Record<string, any>,
  source?: 'webhook' | 'websocket'
}

/**
 * Node execution events
 */
export interface NodeExecutingEvent extends ZipEventBase {
  type: 'node.executing'
  /** Node ID that's executing */
  nodeId: string
  /** IDs of connections bringing input data to this node */
  inputConnections: string[]
}

export interface NodeCompletedEvent extends ZipEventBase {
  type: 'node.completed'
  /** Node ID that completed */
  nodeId: string
  /** IDs of connections that can now carry output data */
  outputConnections: string[]
  /** Execution duration in ms */
  duration?: number
  /** Output data size in bytes */
  outputSize?: number
}

export interface NodeFailedEvent extends ZipEventBase {
  type: 'node.failed'
  /** Node ID that failed */
  nodeId: string
  /** IDs of output connections that won't receive data */
  outputConnections: string[]
  /** Error information */
  error?: {
    message: string
    code?: string
    stack?: string
  }
}

export interface NodeWarningEvent extends ZipEventBase {
  type: 'node.warning'
  /** Node ID that completed with warnings */
  nodeId: string
  /** IDs of output connections (data available but with warnings) */
  outputConnections: string[]
  /** Warning information */
  warning?: {
    message: string
    code?: string
  }
}

/**
 * Workflow execution events
 */
export interface ExecutionStartedEvent extends ZipEventBase {
  type: 'execution.started'
  /** Execution session ID */
  sessionId: string
  /** Workflow name */
  workflowName: string
  /** Trigger information */
  trigger?: {
    type: string
    source?: string
  }
}

export interface ExecutionCompletedEvent extends ZipEventBase {
  type: 'execution.completed'
  /** Execution session ID */
  sessionId: string
  /** Total execution duration in ms */
  duration: number
  /** Number of nodes executed */
  nodesExecuted: number
  /** Summary statistics */
  summary?: {
    successCount: number
    errorCount: number
    warningCount: number
  }
}

export interface ExecutionFailedEvent extends ZipEventBase {
  type: 'execution.failed'
  /** Execution session ID */
  sessionId: string
  /** Duration before failure in ms */
  duration?: number
  /** Error information */
  error?: {
    message: string
    code?: string
    nodeId?: string
  }
}

/**
 * Workflow lifecycle events (for webhooks)
 */
export interface WorkflowCreatedEvent extends ZipEventBase {
  type: 'workflow.created'
  /** Workflow name */
  workflowName: string
  /** User who created it */
  userId?: string
}

export interface WorkflowUpdatedEvent extends ZipEventBase {
  type: 'workflow.updated'
  /** What was updated */
  data?: {
    version?: number
    graphs?: any
    changes?: {
      nodes?: boolean
      connections?: boolean
      properties?: boolean
    }
    metadata?: Record<string, any>
  }
}

export interface WorkflowDeletedEvent extends ZipEventBase {
  type: 'workflow.deleted'
  /** Workflow name before deletion */
  workflowName?: string
}

/**
 * CRDT events for real-time collaboration
 */
export interface NodeAddedEvent extends ZipEventBase {
  type: 'node.added'
  /** Node ID that was added */
  nodeId: string
  /** Node data */
  data: any
}

export interface NodeUpdatedEvent extends ZipEventBase {
  type: 'node.updated'
  /** Node ID that was updated */
  nodeId: string
  /** Node data */
  data: any
}

export interface NodeDeletedEvent extends ZipEventBase {
  type: 'node.deleted'
  /** Node ID that was deleted */
  nodeId: string
}

export interface ConnectionAddedEvent extends ZipEventBase {
  type: 'connection.added'
  /** Connection data */
  data: any
}

export interface ConnectionDeletedEvent extends ZipEventBase {
  type: 'connection.deleted'
  /** Connection data */
  data: any
}

export interface GroupCreatedEvent extends ZipEventBase {
  type: 'group.created'
  /** Group data */
  data: any
}

export interface GroupUpdatedEvent extends ZipEventBase {
  type: 'group.updated'
  /** Group data */
  data: any
}

export interface GroupDeletedEvent extends ZipEventBase {
  type: 'group.deleted'
  /** Group data */
  data: any
}

export interface TemplateRegisteredEvent extends ZipEventBase {
  type: 'template.registered'
  /** Template data */
  data: any
}

export interface TraceEvent extends ZipEventBase {
  type: 'trace.event'
  /** Session ID */
  sessionId: string
  /** Node ID */
  nodeId: string
  /** Event data */
  data: any
}

/**
 * Stream display events (from Reflow binary streaming infrastructure)
 */
export interface StreamOpenedEvent extends ZipEventBase {
  type: 'stream.opened'
  /** Node ID producing the stream */
  nodeId: string
  /** Output port name */
  port: string
  /** Process-local stream identifier */
  streamId: number
  /** MIME content type of the stream data */
  contentType?: string
  /** Expected total size in bytes */
  sizeHint?: number
}

export interface StreamClosedEvent extends ZipEventBase {
  type: 'stream.closed'
  /** Node ID that produced the stream */
  nodeId: string
  /** Stream identifier */
  streamId: number
  /** Total bytes transferred */
  totalBytes: number
}

export interface StreamErrorEvent extends ZipEventBase {
  type: 'stream.error'
  /** Node ID that produced the stream */
  nodeId: string
  /** Stream identifier */
  streamId: number
  /** Error description */
  error: string
}

export type ZipStreamEvent =
  | StreamOpenedEvent
  | StreamClosedEvent
  | StreamErrorEvent

/**
 * Type guard for stream events
 */
export function isStreamEvent(event: any): event is ZipStreamEvent {
  return event?.type?.startsWith('stream.')
}

/**
 * Parse a binary stream frame from an ArrayBuffer.
 * Wire format: [1 byte: frame_type] [8 bytes: stream_id LE u64] [payload...]
 */
export function parseStreamFrame(data: ArrayBuffer): {
  type: 'begin' | 'data' | 'end' | 'error'
  streamId: number
  payload: Uint8Array
  metadata?: any
  message?: string
} {
  const view = new DataView(data)
  const frameType = view.getUint8(0)
  const streamIdLow = view.getUint32(1, true)
  const streamIdHigh = view.getUint32(5, true)
  const streamId = streamIdLow + streamIdHigh * 0x100000000
  const payload = new Uint8Array(data.slice(9))

  switch (frameType) {
    case 0x01:
      return { type: 'begin', streamId, payload, metadata: JSON.parse(new TextDecoder().decode(payload)) }
    case 0x02:
      return { type: 'data', streamId, payload }
    case 0x03:
      return { type: 'end', streamId, payload }
    case 0x04:
      return { type: 'error', streamId, payload, message: new TextDecoder().decode(payload) }
    default:
      return { type: 'data', streamId, payload }
  }
}

/**
 * WebSocket control events
 */
export interface SubscribeEvent {
  type: 'subscribe'
  workflowId: string
  graphId?: string
}

export interface UnsubscribeEvent {
  type: 'unsubscribe'
  workflowId?: string
}

export interface PingEvent {
  type: 'ping'
  timestamp: number
}

export interface PongEvent {
  type: 'pong'
  timestamp: number
}

/**
 * Union types for all events
 */
export type ZipExecutionEvent = 
  | NodeExecutingEvent
  | NodeCompletedEvent
  | NodeFailedEvent
  | NodeWarningEvent
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent

export type ZipWorkflowEvent =
  | WorkflowCreatedEvent
  | WorkflowUpdatedEvent
  | WorkflowDeletedEvent

export type ZipCRDTEvent =
  | NodeAddedEvent
  | NodeUpdatedEvent
  | NodeDeletedEvent
  | ConnectionAddedEvent
  | ConnectionDeletedEvent
  | GroupCreatedEvent
  | GroupUpdatedEvent
  | GroupDeletedEvent
  | TemplateRegisteredEvent
  | TraceEvent

export type ZipControlEvent =
  | SubscribeEvent
  | UnsubscribeEvent
  | PingEvent
  | PongEvent

// Connection state event for real-time visualization
export interface ConnectionStateEvent extends ZipEventBase {
  type: 'connection.state'
  connectionId: string
  state: 'idle' | 'active' | 'success' | 'error'
  sourceNodeId: string
  targetNodeId: string
}

export type ZipWebSocketEvent = ZipExecutionEvent | ZipControlEvent | WorkflowUpdatedEvent | ConnectionStateEvent | ZipCRDTEvent | ZipStreamEvent
export type ZipWebhookEvent = ZipExecutionEvent | ZipWorkflowEvent | ZipCRDTEvent | ZipStreamEvent

/**
 * Type guards
 */
export function isExecutionEvent(event: any): event is ZipExecutionEvent {
  return event && typeof event.type === 'string' && (
    event.type.startsWith('node.') || 
    event.type.startsWith('execution.')
  )
}

export function isWorkflowEvent(event: any): event is ZipWorkflowEvent {
  return event && typeof event.type === 'string' && event.type.startsWith('workflow.')
}

export function isControlEvent(event: any): event is ZipControlEvent {
  return event && typeof event.type === 'string' && [
    'subscribe', 'unsubscribe', 'ping', 'pong'
  ].includes(event.type)
}

export function isNodeEvent(event: ZipExecutionEvent): event is NodeExecutingEvent | NodeCompletedEvent | NodeFailedEvent | NodeWarningEvent {
  return event.type.startsWith('node.')
}

/**
 * Event creation helpers
 */
export function createNodeExecutingEvent(
  workflowId: string,
  nodeId: string,
  inputConnections: string[],
  graphId?: string
): NodeExecutingEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type: 'node.executing',
    timestamp: new Date().toISOString(),
    workflowId,
    graphId,
    nodeId,
    inputConnections,
  }
}

export function createNodeCompletedEvent(
  workflowId: string,
  nodeId: string,
  outputConnections: string[],
  options?: {
    graphId?: string
    duration?: number
    outputSize?: number
    metadata?: Record<string, any>
  }
): NodeCompletedEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type: 'node.completed',
    timestamp: new Date().toISOString(),
    workflowId,
    graphId: options?.graphId,
    nodeId,
    outputConnections,
    duration: options?.duration,
    outputSize: options?.outputSize,
    metadata: options?.metadata,
  }
}

export function createNodeFailedEvent(
  workflowId: string,
  nodeId: string,
  outputConnections: string[],
  error?: { message: string; code?: string; stack?: string },
  graphId?: string
): NodeFailedEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type: 'node.failed',
    timestamp: new Date().toISOString(),
    workflowId,
    graphId,
    nodeId,
    outputConnections,
    error,
  }
}

export function createExecutionStartedEvent(
  workflowId: string,
  sessionId: string,
  workflowName: string,
  options?: {
    graphId?: string
    trigger?: { type: string; source?: string }
    metadata?: Record<string, any>
  }
): ExecutionStartedEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type: 'execution.started',
    timestamp: new Date().toISOString(),
    workflowId,
    graphId: options?.graphId,
    sessionId,
    workflowName,
    trigger: options?.trigger,
    metadata: options?.metadata,
  }
}

export function createExecutionCompletedEvent(
  workflowId: string,
  sessionId: string,
  duration: number,
  nodesExecuted: number,
  options?: {
    graphId?: string
    summary?: { successCount: number; errorCount: number; warningCount: number }
    metadata?: Record<string, any>
  }
): ExecutionCompletedEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type: 'execution.completed',
    timestamp: new Date().toISOString(),
    workflowId,
    graphId: options?.graphId,
    sessionId,
    duration,
    nodesExecuted,
    summary: options?.summary,
    metadata: options?.metadata,
  }
}

export function createExecutionFailedEvent(
  workflowId: string,
  sessionId: string,
  error?: { message: string; code?: string; nodeId?: string },
  options?: {
    graphId?: string
    duration?: number
    metadata?: Record<string, any>
  }
): ExecutionFailedEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type: 'execution.failed',
    timestamp: new Date().toISOString(),
    workflowId,
    graphId: options?.graphId,
    sessionId,
    duration: options?.duration,
    error,
    metadata: options?.metadata,
  }
}

/**
 * Stream event creation helpers
 */
export function createStreamOpenedEvent(
  workflowId: string,
  nodeId: string,
  port: string,
  streamId: number,
  options?: {
    graphId?: string
    contentType?: string
    sizeHint?: number
    metadata?: Record<string, any>
  }
): StreamOpenedEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type: 'stream.opened',
    timestamp: new Date().toISOString(),
    workflowId,
    graphId: options?.graphId,
    nodeId,
    port,
    streamId,
    contentType: options?.contentType,
    sizeHint: options?.sizeHint,
    metadata: options?.metadata,
  }
}

export function createStreamClosedEvent(
  workflowId: string,
  nodeId: string,
  streamId: number,
  totalBytes: number,
  options?: {
    graphId?: string
    metadata?: Record<string, any>
  }
): StreamClosedEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type: 'stream.closed',
    timestamp: new Date().toISOString(),
    workflowId,
    graphId: options?.graphId,
    nodeId,
    streamId,
    totalBytes,
    metadata: options?.metadata,
  }
}

export function createStreamErrorEvent(
  workflowId: string,
  nodeId: string,
  streamId: number,
  error: string,
  options?: {
    graphId?: string
    metadata?: Record<string, any>
  }
): StreamErrorEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type: 'stream.error',
    timestamp: new Date().toISOString(),
    workflowId,
    graphId: options?.graphId,
    nodeId,
    streamId,
    error,
    metadata: options?.metadata,
  }
}