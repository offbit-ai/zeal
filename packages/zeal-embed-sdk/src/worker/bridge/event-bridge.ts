/**
 * Event bridge placeholder for Reflow-Zeal event mapping
 * Since we're using native Reflow NetworkEvents, this is simplified
 */

import {
  ZealEvent,
  EventBridge as IEventBridge,
  NetworkEventHandler,
  NetworkEventFilter,
  WorkflowExecutionStatus
} from '../types/events.types';

export class EventBridge implements IEventBridge {
  private networkHandlers: Set<NetworkEventHandler> = new Set();
  private zealHandlers: Set<(event: ZealEvent) => void> = new Set();
  private workflowStatus: WorkflowExecutionStatus = {
    workflowState: 'idle',
    networkStartTime: undefined,
    networkShutdownTime: undefined,
    actors: new Map(),
    connections: new Map(),
    totalMessages: 0,
    failedActors: [],
    allActorsExecuted: false,
    hasFailures: false,
    isLongRunning: false
  };

  // Listen to Reflow network events
  onNetworkEvent(handler: NetworkEventHandler): void {
    this.networkHandlers.add(handler);
  }

  offNetworkEvent(handler: NetworkEventHandler): void {
    this.networkHandlers.delete(handler);
  }

  // Emit custom Zeal events
  emitZealEvent(event: ZealEvent): void {
    this.zealHandlers.forEach(handler => handler(event));
  }

  onZealEvent(handler: (event: ZealEvent) => void): void {
    this.zealHandlers.add(handler);
  }

  // Filter events
  filterNetworkEvents(filter: NetworkEventFilter): NetworkEventHandler {
    return (event) => {
      // Apply filter logic here
      if (filter.eventTypes && !filter.eventTypes.includes(event._type)) {
        return;
      }
      if (filter.actorIds && 'actorId' in event) {
        if (!filter.actorIds.includes(event.actorId)) {
          return;
        }
      }
      // Event passes filter, notify handlers
      this.networkHandlers.forEach(handler => handler(event));
    };
  }

  // Get execution status from events
  getExecutionStatus(): WorkflowExecutionStatus {
    // Return a deep copy with Map conversions
    return {
      ...this.workflowStatus,
      actors: new Map(this.workflowStatus.actors),
      connections: new Map(this.workflowStatus.connections),
      failedActors: [...this.workflowStatus.failedActors]
    };
  }

  // Update execution status based on network event
  updateFromNetworkEvent(event: import('../types/reflow-types').NetworkEvent): void {
    switch (event._type) {
      case 'NetworkStarted':
        this.workflowStatus.workflowState = 'running';
        this.workflowStatus.networkStartTime = event.timestamp;
        this.workflowStatus.isLongRunning = true;
        break;
        
      case 'NetworkShutdown':
        this.workflowStatus.workflowState = 'shutdown';
        this.workflowStatus.networkShutdownTime = event.timestamp;
        this.workflowStatus.isLongRunning = false;
        break;
        
      case 'ActorStarted': {
        let actor = this.workflowStatus.actors.get(event.actorId);
        if (!actor) {
          actor = {
            actorId: event.actorId,
            state: 'running',
            component: event.component,
            startTime: event.timestamp
          };
          this.workflowStatus.actors.set(event.actorId, actor);
        } else {
          actor.state = 'running';
          actor.startTime = event.timestamp;
        }
        break;
      }
        
      case 'ActorCompleted': {
        let actor = this.workflowStatus.actors.get(event.actorId);
        if (!actor) {
          actor = {
            actorId: event.actorId,
            state: 'completed',
            component: event.component,
            endTime: event.timestamp,
            outputs: event.outputs
          };
          this.workflowStatus.actors.set(event.actorId, actor);
        } else {
          actor.state = 'completed';
          actor.endTime = event.timestamp;
          actor.outputs = event.outputs;
        }
        
        // Check if all actors have been executed
        this.updateActorsExecutedStatus();
        break;
      }
        
      case 'ActorFailed': {
        let actor = this.workflowStatus.actors.get(event.actorId);
        if (!actor) {
          actor = {
            actorId: event.actorId,
            state: 'failed',
            component: event.component,
            endTime: event.timestamp,
            error: event.error
          };
          this.workflowStatus.actors.set(event.actorId, actor);
        } else {
          actor.state = 'failed';
          actor.endTime = event.timestamp;
          actor.error = event.error;
        }
        
        // Add to failed actors list
        this.workflowStatus.failedActors.push({
          actorId: event.actorId,
          error: event.error
        });
        
        // Update workflow state to failed
        this.workflowStatus.workflowState = 'failed';
        this.workflowStatus.hasFailures = true;
        break;
      }
        
      case 'MessageSent': {
        // Track connection completion
        const connectionKey = `${event.fromActor}:${event.fromPort}->${event.toActor}:${event.toPort}`;
        let connection = this.workflowStatus.connections.get(connectionKey);
        
        if (!connection) {
          connection = {
            fromActor: event.fromActor,
            fromPort: event.fromPort,
            toActor: event.toActor,
            toPort: event.toPort,
            messagesSent: 1,
            lastMessageTime: event.timestamp
          };
          this.workflowStatus.connections.set(connectionKey, connection);
        } else {
          connection.messagesSent++;
          connection.lastMessageTime = event.timestamp;
        }
        
        this.workflowStatus.totalMessages++;
        break;
      }
        
      case 'MessageReceived':
        this.workflowStatus.totalMessages++;
        break;
    }
  }
  
  // Helper to update allActorsExecuted status
  private updateActorsExecutedStatus(): void {
    // Check if all registered actors have been executed at least once
    const allCompleted = Array.from(this.workflowStatus.actors.values())
      .every(actor => actor.state === 'completed' || actor.state === 'failed');
    
    this.workflowStatus.allActorsExecuted = allCompleted;
  }
}