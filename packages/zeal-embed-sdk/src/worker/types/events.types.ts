/**
 * Event types for Reflow-Zeal communication
 * Based on Reflow NetworkEvent types
 */

// Import our simplified Reflow types to avoid incomplete definitions
import type { 
  NetworkEvent, 
  NetworkEventHandler, 
  NetworkEventFilter,
  REFLOW_EVENT_TYPES 
} from './reflow-types';
export type { 
  NetworkEvent, 
  NetworkEventHandler, 
  NetworkEventFilter 
};
export { REFLOW_EVENT_TYPES };

// Zeal Custom Events (for events not covered by Reflow)
export enum ZealEventType {
  // Actor Registration Events
  ACTOR_REGISTERED = 'ACTOR_REGISTERED',
  ACTOR_UNREGISTERED = 'ACTOR_UNREGISTERED',
  ACTOR_UPDATED = 'ACTOR_UPDATED',
  
  // Template Events
  TEMPLATE_REGISTERED = 'TEMPLATE_REGISTERED',
  TEMPLATE_UPDATED = 'TEMPLATE_UPDATED',
  
  // Workflow Management Events
  WORKFLOW_REGISTERED = 'WORKFLOW_REGISTERED',
  WORKFLOW_UNREGISTERED = 'WORKFLOW_UNREGISTERED',
  
  // System Events
  LOG = 'LOG',
  DEBUG = 'DEBUG',
  RUNTIME_ERROR = 'RUNTIME_ERROR'
}

// Zeal Custom Event Interface
export interface ZealCustomEvent {
  type: ZealEventType;
  timestamp: number;
  executionId?: string;
  data?: any;
  metadata?: Record<string, any>;
}

// Specific Zeal Event Types
export interface ActorRegistrationEvent extends ZealCustomEvent {
  type: ZealEventType.ACTOR_REGISTERED | 
        ZealEventType.ACTOR_UNREGISTERED |
        ZealEventType.ACTOR_UPDATED;
  templateId: string;
  actorConfig?: any;
}

export interface TemplateEvent extends ZealCustomEvent {
  type: ZealEventType.TEMPLATE_REGISTERED | ZealEventType.TEMPLATE_UPDATED;
  templateId: string;
  template?: any;
}

export interface LogEvent extends ZealCustomEvent {
  type: ZealEventType.LOG | ZealEventType.DEBUG;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  nodeId?: string;
  context?: any;
}

export interface RuntimeErrorEvent extends ZealCustomEvent {
  type: ZealEventType.RUNTIME_ERROR;
  error: string;
  nodeId?: string;
  stack?: string;
}

// Union type for all custom Zeal events
export type ZealEvent = ActorRegistrationEvent | TemplateEvent | LogEvent | RuntimeErrorEvent;

// These are now imported from reflow-types.ts

// Actor-specific execution state
export type ActorExecutionState = 
  | 'pending'      // Actor not yet started
  | 'running'      // Actor currently executing
  | 'completed'    // Actor finished successfully
  | 'failed';      // Actor failed with error

// Workflow state (long-running until shutdown)
export type WorkflowState = 
  | 'idle'         // Network not started
  | 'running'      // Network is active (long-running)
  | 'failed'       // One or more actors failed
  | 'shutdown';    // Network was shutdown/cancelled

// Actor execution tracking
export interface ActorExecutionStatus {
  actorId: string;
  state: ActorExecutionState;
  component?: string;
  startTime?: number;
  endTime?: number;
  outputs?: any;
  error?: string;
}

// Connection tracking
export interface ConnectionStatus {
  fromActor: string;
  fromPort: string;
  toActor: string;
  toPort: string;
  messagesSent: number;
  lastMessageTime?: number;
}

// Overall workflow execution status
export interface WorkflowExecutionStatus {
  workflowState: WorkflowState;
  networkStartTime?: number;
  networkShutdownTime?: number;
  actors: Map<string, ActorExecutionStatus>;
  connections: Map<string, ConnectionStatus>;
  totalMessages: number;
  failedActors: Array<{ actorId: string; error: string }>;
  
  // Derived states
  allActorsExecuted: boolean;  // All registered actors have been executed at least once
  hasFailures: boolean;        // Any actor has failed
  isLongRunning: boolean;      // Network is still active (not shutdown)
}

// Event Bridge Interface
export interface EventBridge {
  // Listen to Reflow network events
  onNetworkEvent(handler: NetworkEventHandler): void;
  offNetworkEvent(handler: NetworkEventHandler): void;
  
  // Emit custom Zeal events
  emitZealEvent(event: ZealEvent): void;
  onZealEvent(handler: (event: ZealEvent) => void): void;
  
  // Filter events
  filterNetworkEvents(filter: NetworkEventFilter): NetworkEventHandler;
  
  // Get execution status from events
  getExecutionStatus(): WorkflowExecutionStatus;
}

// REFLOW_EVENT_TYPES is now imported from reflow-types.ts