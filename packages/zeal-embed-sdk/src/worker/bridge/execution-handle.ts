/**
 * Execution handle for tracking workflow execution
 */

import { EventEmitter } from 'eventemitter3';
import { MessageProtocol, MessageType } from './message-protocol';
import { WorkflowState, ActorExecutionState, ActorExecutionStatus } from '../types/events.types';

// Define local types for execution progress tracking
export interface NodeProgress {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  duration?: number;
  output?: any;
  error?: string;
}

export interface ExecutionProgress {
  state: WorkflowState;
  nodes: NodeProgress[];
  completedNodes: number;
  totalNodes: number;
  percentage: number;
  actors: ActorExecutionStatus[];
  hasFailures: boolean;
  isLongRunning: boolean;
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export class ExecutionHandle extends EventEmitter {
  private state: WorkflowState = 'idle'; // WorkflowState starts with 'idle'
  private progress = new Map<string, NodeProgress>();
  private actorStatuses = new Map<string, ActorExecutionStatus>();
  private result?: ExecutionResult;
  private error?: Error;
  private startTime = Date.now();
  private isLongRunning = false;
  
  constructor(
    public readonly id: string,
    private protocol: MessageProtocol,
    private port: MessagePort
  ) {
    super();
  }
  
  /**
   * Handle events from worker
   */
  handleEvent(event: string, payload: any): void {
    switch (event) {
      case 'start':
        this.state = 'running';
        this.isLongRunning = true;
        this.emit('start', payload);
        break;
        
      case 'progress':
        this.updateProgress(payload);
        this.emit('progress', payload);
        break;
        
      case 'actor-started':
        this.updateActorStatus(payload.actorId, 'running', payload);
        this.emit('actor:started', payload);
        break;
        
      case 'actor-completed':
        this.updateActorStatus(payload.actorId, 'completed', payload);
        this.emit('actor:completed', payload);
        break;
        
      case 'actor-failed':
        this.updateActorStatus(payload.actorId, 'failed', payload);
        this.state = 'failed'; // If any actor fails, workflow fails
        this.emit('actor:failed', payload);
        break;
        
      case 'complete':
        this.state = 'shutdown'; // Network shutdown means completion
        this.isLongRunning = false;
        this.result = {
          success: !this.hasFailures(),
          data: payload.result,
          duration: Date.now() - this.startTime,
          metadata: payload.metadata
        };
        this.emit('complete', this.result);
        break;
        
      case 'error':
        this.state = 'failed';
        this.isLongRunning = false;
        this.error = new Error(payload.error || 'Execution failed');
        this.result = {
          success: false,
          error: payload.error,
          duration: Date.now() - this.startTime
        };
        this.emit('error', this.error);
        break;
    }
  }
  
  /**
   * Update progress tracking
   */
  private updateProgress(payload: any): void {
    if (payload.nodeId) {
      this.progress.set(payload.nodeId, {
        nodeId: payload.nodeId,
        status: payload.status || 'running',
        startTime: payload.startTime,
        endTime: payload.endTime,
        duration: payload.duration,
        output: payload.output,
        error: payload.error
      });
    }
  }
  
  /**
   * Update actor status
   */
  private updateActorStatus(actorId: string, state: ActorExecutionState, payload: any): void {
    let status = this.actorStatuses.get(actorId);
    if (!status) {
      status = {
        actorId,
        state,
        component: payload.component
      };
      this.actorStatuses.set(actorId, status);
    } else {
      status.state = state;
    }
    
    if (state === 'running') {
      status.startTime = payload.timestamp || Date.now();
    } else if (state === 'completed') {
      status.endTime = payload.timestamp || Date.now();
      status.outputs = payload.outputs;
    } else if (state === 'failed') {
      status.endTime = payload.timestamp || Date.now();
      status.error = payload.error;
    }
  }
  
  /**
   * Check if any actors have failed
   */
  private hasFailures(): boolean {
    return Array.from(this.actorStatuses.values()).some(actor => actor.state === 'failed');
  }
  
  // Pause/Resume not supported - only start/shutdown
  // These methods are kept for API compatibility but throw errors
  
  /**
   * Pause execution - NOT SUPPORTED
   */
  async pause(): Promise<void> {
    throw new Error('Pause is not supported. Only start/shutdown operations are available.');
  }
  
  /**
   * Resume execution - NOT SUPPORTED
   */
  async resume(): Promise<void> {
    throw new Error('Resume is not supported. Only start/shutdown operations are available.');
  }
  
  /**
   * Cancel execution
   */
  async cancel(): Promise<void> {
    if (this.state === 'shutdown' || this.state === 'failed') {
      return;
    }
    
    await this.protocol.sendMessage(
      this.port,
      MessageType.CANCEL_EXECUTION,
      { executionId: this.id }
    );
    
    this.state = 'shutdown'; // Use 'shutdown' for cancelled execution
    this.emit('cancel');
  }
  
  /**
   * Get current progress
   */
  getProgress(): ExecutionProgress {
    const nodes = Array.from(this.progress.values());
    const completed = nodes.filter(n => n.status === 'completed').length;
    const total = nodes.length;
    const actors = Array.from(this.actorStatuses.values());
    
    return {
      state: this.state,
      nodes,
      completedNodes: completed,
      totalNodes: total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      actors,
      hasFailures: this.hasFailures(),
      isLongRunning: this.isLongRunning
    };
  }
  
  /**
   * Get execution state
   */
  getState(): WorkflowState {
    return this.state;
  }
  
  /**
   * Get execution result
   */
  getResult(): ExecutionResult | undefined {
    return this.result;
  }
  
  /**
   * Get execution error
   */
  getError(): Error | undefined {
    return this.error;
  }
  
  /**
   * Wait for completion
   */
  async waitForCompletion(): Promise<ExecutionResult> {
    if (this.state === 'shutdown') {
      return this.result!;
    }
    
    if (this.state === 'failed') {
      throw this.error || new Error('Execution failed');
    }
    
    return new Promise((resolve, reject) => {
      this.once('complete', resolve);
      this.once('error', reject);
    });
  }
  
  /**
   * Check if execution is running
   */
  isRunning(): boolean {
    return this.state === 'running';
  }
  
  /**
   * Check if execution is completed
   */
  isCompleted(): boolean {
    return this.state === 'shutdown' && !this.hasFailures();
  }
  
  /**
   * Check if execution failed
   */
  isFailed(): boolean {
    return this.state === 'failed';
  }
}