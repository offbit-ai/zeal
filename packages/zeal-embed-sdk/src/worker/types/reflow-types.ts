/**
 * Simplified Reflow types based on actual usage
 * This avoids the incomplete type definitions in the official package
 */

// Core Reflow Network Event types
export type NetworkEvent = 
  | { _type: "ActorEmit"; actorId: string; message: any }
  | { _type: "ActorStarted"; actorId: string; component: string; timestamp: number }
  | { _type: "ActorCompleted"; actorId: string; component: string; outputs?: any; timestamp: number }
  | { _type: "ActorFailed"; actorId: string; component: string; error: string; timestamp: number }
  | { _type: "MessageSent"; fromActor: string; fromPort: string; toActor: string; toPort: string; message: any; timestamp: number }
  | { _type: "MessageReceived"; actorId: string; port: string; message: any; timestamp: number }
  | { _type: "NetworkStarted"; timestamp: number }
  | { _type: "NetworkIdle"; timestamp: number }
  | { _type: "NetworkShutdown"; timestamp: number };

// Network Event Handler Type
export type NetworkEventHandler = (event: NetworkEvent) => void;

// Event Filter for specific event types
export type NetworkEventFilter = {
  actorIds?: string[];
  eventTypes?: Array<NetworkEvent['_type']>;
  components?: string[];
};

// Reflow Event Type Constants
export const REFLOW_EVENT_TYPES = {
  ACTOR_EMIT: 'ActorEmit' as const,
  ACTOR_STARTED: 'ActorStarted' as const,
  ACTOR_COMPLETED: 'ActorCompleted' as const,
  ACTOR_FAILED: 'ActorFailed' as const,
  MESSAGE_SENT: 'MessageSent' as const,
  MESSAGE_RECEIVED: 'MessageReceived' as const,
  NETWORK_STARTED: 'NetworkStarted' as const,
  NETWORK_IDLE: 'NetworkIdle' as const,
  NETWORK_SHUTDOWN: 'NetworkShutdown' as const,
} as const;

// Helper functions for event type checking
export function isActorEvent(event: NetworkEvent): event is Extract<NetworkEvent, { actorId: string }> {
  return 'actorId' in event;
}

export function isNetworkEvent(event: NetworkEvent): event is Extract<NetworkEvent, { _type: 'NetworkStarted' | 'NetworkIdle' | 'NetworkShutdown' }> {
  return event._type.startsWith('Network');
}

export function isMessageEvent(event: NetworkEvent): event is Extract<NetworkEvent, { _type: 'MessageSent' | 'MessageReceived' }> {
  return event._type.startsWith('Message');
}

// Execution state mapping from events
export function getExecutionStateFromEvent(event: NetworkEvent): string {
  switch (event._type) {
    case 'NetworkStarted':
      return 'started';
    case 'NetworkIdle':
      return 'idle';
    case 'NetworkShutdown':
      return 'completed';
    case 'ActorFailed':
      return 'failed';
    default:
      return 'running';
  }
}