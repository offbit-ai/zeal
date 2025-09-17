/**
 * Message protocol for worker communication
 */

export enum MessageType {
  // Initialization
  INIT = 'INIT',
  READY = 'READY',
  ERROR = 'ERROR',
  
  // Actor registration
  REGISTER_ACTOR = 'REGISTER_ACTOR',
  ACTOR_REGISTERED = 'ACTOR_REGISTERED',
  UNREGISTER_ACTOR = 'UNREGISTER_ACTOR',
  
  // Template management
  REGISTER_TEMPLATE = 'REGISTER_TEMPLATE',
  TEMPLATE_REGISTERED = 'TEMPLATE_REGISTERED',
  
  // Execution
  EXECUTE_GRAPH = 'EXECUTE_GRAPH',
  EXECUTION_STARTED = 'EXECUTION_STARTED',
  EXECUTION_PROGRESS = 'EXECUTION_PROGRESS',
  EXECUTION_COMPLETE = 'EXECUTION_COMPLETE',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  EXECUTION_IDLE = 'EXECUTION_IDLE',
  
  // Execution control (only start/shutdown supported)
  CANCEL_EXECUTION = 'CANCEL_EXECUTION',
  
  // Node execution
  NODE_EXECUTE = 'NODE_EXECUTE',
  NODE_RESULT = 'NODE_RESULT',
  NODE_ERROR = 'NODE_ERROR',
  NODE_PROGRESS = 'NODE_PROGRESS',
  
  // Events
  REFLOW_EVENT = 'REFLOW_EVENT',
  NETWORK_EVENT = 'NETWORK_EVENT',
  ZEAL_EVENT = 'ZEAL_EVENT',
  
  // State sync
  STATE_UPDATE = 'STATE_UPDATE',
  STATE_SYNC = 'STATE_SYNC'
}

export interface WorkerMessage<T = any> {
  id: string;
  type: MessageType;
  payload: T;
  timestamp: number;
  source: 'main' | 'worker';
  error?: string;
  transferables?: Transferable[];
}

export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class MessageProtocol {
  private pendingMessages = new Map<string, PendingMessage>();
  private messageHandlers = new Map<MessageType, MessageHandler>();
  private defaultTimeout = 30000; // 30 seconds
  
  constructor(private source: 'main' | 'worker' = 'main') {}
  
  /**
   * Send a message and wait for response
   */
  async sendMessage<T = any>(
    port: MessagePort,
    type: MessageType,
    payload: any,
    transferables?: Transferable[]
  ): Promise<T> {
    const id = this.generateMessageId();
    const message: WorkerMessage = {
      id,
      type,
      payload,
      timestamp: Date.now(),
      source: this.source,
      transferables
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error(`Message ${type} timed out after ${this.defaultTimeout}ms`));
      }, this.defaultTimeout);
      
      this.pendingMessages.set(id, {
        resolve,
        reject,
        timeout,
        type,
        timestamp: Date.now()
      });
      
      port.postMessage(message, transferables || []);
    });
  }
  
  /**
   * Send a message without waiting for response
   */
  sendOneWay(
    port: MessagePort,
    type: MessageType,
    payload: any,
    transferables?: Transferable[]
  ): void {
    const message: WorkerMessage = {
      id: this.generateMessageId(),
      type,
      payload,
      timestamp: Date.now(),
      source: this.source,
      transferables
    };
    
    port.postMessage(message, transferables || []);
  }
  
  /**
   * Register a handler for a message type
   */
  onMessage(type: MessageType, handler: MessageHandler): void {
    this.messageHandlers.set(type, handler);
  }
  
  /**
   * Handle incoming message
   */
  async handleMessage(
    message: WorkerMessage,
    port: MessagePort
  ): Promise<void> {
    // Check if this is a response to a pending message
    const pending = this.pendingMessages.get(message.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingMessages.delete(message.id);
      
      if (message.error) {
        pending.reject(new Error(message.error));
      } else {
        pending.resolve(message.payload);
      }
      return;
    }
    
    // Handle new message
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      try {
        const result = await handler(message.payload, port);
        
        // Send response if handler returned a value
        if (result !== undefined) {
          const response: WorkerMessage = {
            id: message.id,
            type: message.type,
            payload: result,
            timestamp: Date.now(),
            source: this.source
          };
          port.postMessage(response);
        }
      } catch (error) {
        // Send error response
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorResponse: WorkerMessage = {
          id: message.id,
          type: MessageType.ERROR,
          payload: null,
          error: errorMessage,
          timestamp: Date.now(),
          source: this.source
        };
        port.postMessage(errorResponse);
      }
    }
  }
  
  /**
   * Set timeout for messages
   */
  setTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }
  
  /**
   * Clear all pending messages
   */
  clearPending(): void {
    Array.from(this.pendingMessages.values()).forEach(pending => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Protocol shutdown'));
    });
    this.pendingMessages.clear();
  }
  
  private generateMessageId(): string {
    return `${this.source}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

interface PendingMessage {
  resolve: Function;
  reject: Function;
  timeout: NodeJS.Timeout;
  type: MessageType;
  timestamp: number;
}

type MessageHandler = (
  payload: any,
  port: MessagePort
) => Promise<any> | any;