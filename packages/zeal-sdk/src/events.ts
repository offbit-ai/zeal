/**
 * Events API for ZIP SDK - WebSocket communication
 */

import { io, Socket } from 'socket.io-client'
import {
  ZealEvent,
  ZealEventType,
  RuntimeEvent,
  RuntimeEventType,
} from './types'

export interface EventHandlers {
  onZealEvent?: (event: ZealEvent) => void
  onRuntimeEvent?: (event: RuntimeEvent) => void
  onVisualStateUpdate?: (update: any) => void
  onError?: (error: any) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

export class EventsAPI {
  private socket: Socket | null = null
  private handlers: EventHandlers = {}
  
  constructor(
    private baseUrl: string,
    private websocketPath = '/zip/events'
  ) {}
  
  /**
   * Connect to WebSocket
   */
  connect(
    workflowId: string,
    handlers: EventHandlers = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.handlers = handlers
      
      // Create WebSocket connection
      const wsUrl = this.baseUrl.replace(/^http/, 'ws')
      this.socket = io(wsUrl, {
        path: this.websocketPath,
        transports: ['websocket'],
      })
      
      // Set up event handlers
      this.socket.on('connect', () => {
        console.log('Connected to Zeal WebSocket')
        
        // Authenticate
        this.socket?.emit('auth', {
          type: 'auth',
          workflowId,
        })
        
        if (this.handlers.onConnected) {
          this.handlers.onConnected()
        }
      })
      
      this.socket.on('auth.success', () => {
        console.log('Successfully authenticated with Zeal')
        resolve()
      })
      
      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error)
        if (this.handlers.onError) {
          this.handlers.onError(error)
        }
        reject(error)
      })
      
      this.socket.on('disconnect', () => {
        console.log('Disconnected from Zeal WebSocket')
        if (this.handlers.onDisconnected) {
          this.handlers.onDisconnected()
        }
      })
      
      // Handle Zeal events
      this.socket.on('zeal.event', (event: ZealEvent) => {
        if (this.handlers.onZealEvent) {
          this.handlers.onZealEvent(event)
        }
      })
      
      // Handle runtime events
      this.socket.on('runtime.event', (event: RuntimeEvent) => {
        if (this.handlers.onRuntimeEvent) {
          this.handlers.onRuntimeEvent(event)
        }
      })
      
      // Handle visual state updates
      this.socket.on('visual.state.update', (update: any) => {
        if (this.handlers.onVisualStateUpdate) {
          this.handlers.onVisualStateUpdate(update)
        }
      })
      
      // Handle workflow state
      this.socket.on('workflow.state', (state: any) => {
        console.log('Received workflow state:', state)
      })
    })
  }
  
  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
  
  /**
   * Emit runtime event
   */
  emitRuntimeEvent(event: RuntimeEvent): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to WebSocket')
    }
    
    this.socket.emit('runtime.event', event)
  }
  
  /**
   * Update visual state of elements
   */
  updateVisualState(elements: Array<{
    id: string
    elementType: 'node' | 'connection'
    state: 'idle' | 'pending' | 'running' | 'success' | 'error' | 'warning'
    progress?: number
    message?: string
    highlight?: boolean
    color?: string
  }>): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to WebSocket')
    }
    
    this.socket.emit('visual.state.update', {
      type: 'visual.state.update',
      elements,
    })
  }
  
  /**
   * Helper to emit node execution events
   */
  emitNodeExecution(
    workflowId: string,
    nodeId: string,
    status: 'start' | 'success' | 'error' | 'progress',
    data?: any
  ): void {
    const typeMap = {
      start: RuntimeEventType.NODE_EXECUTION_START,
      success: RuntimeEventType.NODE_EXECUTION_SUCCESS,
      error: RuntimeEventType.NODE_EXECUTION_ERROR,
      progress: RuntimeEventType.NODE_EXECUTION_PROGRESS,
    }
    
    this.emitRuntimeEvent({
      type: typeMap[status],
      workflowId,
      timestamp: Date.now(),
      data: {
        nodeId,
        ...data,
      },
    })
  }
  
  /**
   * Helper to emit connection flow events
   */
  emitConnectionFlow(
    workflowId: string,
    connectionId: string,
    status: 'start' | 'end' | 'error',
    data?: any
  ): void {
    const typeMap = {
      start: RuntimeEventType.CONNECTION_FLOW_START,
      end: RuntimeEventType.CONNECTION_FLOW_END,
      error: RuntimeEventType.CONNECTION_FLOW_ERROR,
    }
    
    this.emitRuntimeEvent({
      type: typeMap[status],
      workflowId,
      timestamp: Date.now(),
      data: {
        connectionId,
        ...data,
      },
    })
  }
}