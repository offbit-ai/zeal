/**
 * WebSocket handler for real-time embed communication
 * Integrates with ZIP SDK events
 */

import { EventEmitter } from 'eventemitter3'
import {
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
  ZipWebSocketEvent,
  ZipWebhookEvent,
} from '../../../types/zip-events'

export type ZipEvent = ZipWebSocketEvent | ZipWebhookEvent

export interface WebSocketConfig {
  url: string
  workflowId: string
  authToken?: string
  reconnect?: boolean
  reconnectDelay?: number
  maxReconnectAttempts?: number
}

export class EmbedWebSocketHandler extends EventEmitter {
  private ws: WebSocket | null = null
  private config: Required<WebSocketConfig>
  private reconnectAttempts = 0
  private reconnectTimer?: NodeJS.Timeout
  private connected = false
  private messageQueue: any[] = []

  constructor(config: WebSocketConfig) {
    super()
    
    this.config = {
      url: config.url,
      workflowId: config.workflowId,
      authToken: config.authToken || sessionStorage.getItem('zealAuthToken') || '',
      reconnect: config.reconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
    }
  }

  /**
   * Connect to WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL with auth
        const wsUrl = new URL(this.config.url)
        wsUrl.protocol = wsUrl.protocol.replace('http', 'ws')
        wsUrl.pathname = '/api/zip/websocket'
        
        if (this.config.authToken) {
          wsUrl.searchParams.set('authToken', this.config.authToken)
        }

        // Create WebSocket connection
        this.ws = new WebSocket(wsUrl.toString())

        // Setup event handlers
        this.ws.onopen = () => {
          this.onOpen()
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.onMessage(event)
        }

        this.ws.onerror = (error) => {
          this.onError(error)
          if (!this.isConnected) {
            reject(error)
          }
        }

        this.ws.onclose = () => {
          this.onClose()
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private onOpen(): void {
    this.connected = true
    this.reconnectAttempts = 0
    
    // Send authentication if needed
    if (this.config.authToken) {
      this.send({
        type: 'auth',
        token: this.config.authToken,
      })
    }

    // Subscribe to workflow
    this.send({
      type: 'subscribe',
      workflowId: this.config.workflowId,
    })

    // Flush message queue
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      this.send(message)
    }

    this.emit('connected')
  }

  private onMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data)
      
      // Handle different event types based on ZIP protocol
      if (this.isZipEvent(data)) {
        this.handleZipEvent(data)
      } else {
        // Generic message
        this.emit('message', data)
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
      this.emit('error', error)
    }
  }

  private isZipEvent(data: any): data is ZipEvent {
    return data && typeof data.type === 'string' && (
      data.type.startsWith('node.') ||
      data.type.startsWith('execution.') ||
      data.type.startsWith('workflow.') ||
      data.type.startsWith('connection.') ||
      data.type.startsWith('group.') ||
      data.type === 'subscribe' ||
      data.type === 'unsubscribe' ||
      data.type === 'ping' ||
      data.type === 'pong'
    )
  }

  private handleZipEvent(event: ZipEvent): void {
    // Emit specific event type
    this.emit(event.type, event)

    // Emit categorized events
    if (event.type.startsWith('node.')) {
      this.handleNodeEvent(event as any)
    } else if (event.type.startsWith('execution.')) {
      this.handleExecutionEvent(event as any)
    } else if (event.type.startsWith('workflow.')) {
      this.handleWorkflowEvent(event as any)
    } else if (event.type.startsWith('connection.')) {
      this.handleConnectionEvent(event as any)
    } else if (event.type.startsWith('group.')) {
      this.handleGroupEvent(event as any)
    }
  }

  private handleNodeEvent(event: NodeExecutingEvent | NodeCompletedEvent | NodeFailedEvent | NodeWarningEvent | NodeAddedEvent | NodeUpdatedEvent | NodeDeletedEvent): void {
    switch (event.type) {
      case 'node.executing':
        this.emit('nodeExecuting', event)
        break
      case 'node.completed':
        this.emit('nodeCompleted', event)
        break
      case 'node.failed':
        this.emit('nodeFailed', event)
        break
      case 'node.warning':
        this.emit('nodeWarning', event)
        break
      case 'node.added':
        this.emit('nodeAdded', event)
        break
      case 'node.updated':
        this.emit('nodeUpdated', event)
        break
      case 'node.deleted':
        this.emit('nodeDeleted', event)
        break
    }
  }

  private handleExecutionEvent(event: ExecutionStartedEvent | ExecutionCompletedEvent | ExecutionFailedEvent): void {
    switch (event.type) {
      case 'execution.started':
        this.emit('executionStarted', event)
        break
      case 'execution.completed':
        this.emit('executionCompleted', event)
        break
      case 'execution.failed':
        this.emit('executionFailed', event)
        break
    }
  }

  private handleWorkflowEvent(event: WorkflowCreatedEvent | WorkflowUpdatedEvent | WorkflowDeletedEvent): void {
    switch (event.type) {
      case 'workflow.created':
        this.emit('workflowCreated', event)
        break
      case 'workflow.updated':
        this.emit('workflowUpdated', event)
        break
      case 'workflow.deleted':
        this.emit('workflowDeleted', event)
        break
    }
  }

  private handleConnectionEvent(event: ConnectionAddedEvent | ConnectionDeletedEvent | ConnectionStateEvent): void {
    switch (event.type) {
      case 'connection.added':
        this.emit('connectionAdded', event)
        break
      case 'connection.deleted':
        this.emit('connectionDeleted', event)
        break
      case 'connection.state':
        this.emit('connectionState', event)
        break
    }
  }

  private handleGroupEvent(event: GroupCreatedEvent | GroupUpdatedEvent | GroupDeletedEvent): void {
    switch (event.type) {
      case 'group.created':
        this.emit('groupCreated', event)
        break
      case 'group.updated':
        this.emit('groupUpdated', event)
        break
      case 'group.deleted':
        this.emit('groupDeleted', event)
        break
    }
  }

  private onError(error: Event): void {
    console.error('WebSocket error:', error)
    this.emit('error', error)
  }

  private onClose(): void {
    this.connected = false
    this.emit('disconnected')

    // Attempt reconnection if enabled
    if (this.config.reconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      
      console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`)
      
      this.reconnectTimer = setTimeout(() => {
        this.connect().catch(console.error)
      }, delay)
    }
  }

  /**
   * Send a message through WebSocket
   */
  send(message: any): void {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message if not connected
      this.messageQueue.push(message)
      return
    }

    try {
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('Failed to send WebSocket message:', error)
      this.emit('error', error)
    }
  }

  /**
   * Subscribe to a workflow
   */
  subscribe(workflowId: string, graphId?: string): void {
    this.send({
      type: 'subscribe',
      workflowId,
      graphId,
    })
  }

  /**
   * Unsubscribe from a workflow
   */
  unsubscribe(workflowId?: string): void {
    this.send({
      type: 'unsubscribe',
      workflowId,
    })
  }

  /**
   * Send a ping
   */
  ping(): void {
    this.send({
      type: 'ping',
      timestamp: Date.now(),
    })
  }

  /**
   * Execute a workflow
   */
  executeWorkflow(workflowId: string, inputs?: Record<string, any>): void {
    this.send({
      type: 'execute',
      workflowId,
      inputs,
      timestamp: Date.now(),
    })
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.config.reconnect = false
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.connected = false
    this.messageQueue = []
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected
  }
}