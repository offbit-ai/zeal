/**
 * WebSocket client for embedded workflow interactions
 * This can be used by 3rd party applications to interact with Zeal workflows
 */

import { io, Socket } from 'socket.io-client'
import { EventEmitter } from 'events'

export interface EmbedWebSocketConfig {
  workflowId: string
  apiKey: string
  serverUrl?: string
  autoConnect?: boolean
}

export interface NodeData {
  id: string
  metadata: {
    type: string
    title: string
    description?: string
    icon?: string
    category?: string
    inputs?: any[]
    outputs?: any[]
    properties?: any[]
    propertyValues?: Record<string, any>
  }
  position: {
    x: number
    y: number
  }
  propertyValues?: Record<string, any>
}

export interface GroupData {
  id: string
  title: string
  description?: string
  nodeIds: string[]
  color?: string
}

export interface WorkflowState {
  id: string
  name: string
  graphs: any[]
}

export enum EmbedEventType {
  // Client -> Server
  JOIN_WORKFLOW = 'embed:join_workflow',
  LEAVE_WORKFLOW = 'embed:leave_workflow',
  ADD_NODE = 'embed:add_node',
  UPDATE_NODE = 'embed:update_node',
  DELETE_NODE = 'embed:delete_node',
  ADD_GROUP = 'embed:add_group',
  UPDATE_GROUP = 'embed:update_group',
  DELETE_GROUP = 'embed:delete_group',
  EXECUTE_WORKFLOW = 'embed:execute_workflow',

  // Server -> Client
  WORKFLOW_STATE = 'embed:workflow_state',
  NODE_ADDED = 'embed:node_added',
  NODE_UPDATED = 'embed:node_updated',
  NODE_DELETED = 'embed:node_deleted',
  GROUP_ADDED = 'embed:group_added',
  GROUP_UPDATED = 'embed:group_updated',
  GROUP_DELETED = 'embed:group_deleted',
  WORKFLOW_EXECUTED = 'embed:workflow_executed',
  EXECUTION_STATUS = 'embed:execution_status',
  ERROR = 'embed:error',
}

export class EmbedWebSocketClient extends EventEmitter {
  private socket: Socket | null = null
  private config: EmbedWebSocketConfig
  private connected: boolean = false
  private workflowState: WorkflowState | null = null

  constructor(config: EmbedWebSocketConfig) {
    super()
    this.config = {
      serverUrl: '/embed-ws',
      autoConnect: true,
      ...config,
    }

    if (this.config.autoConnect) {
      this.connect()
    }
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.socket?.connected) {
      console.warn('[Embed WS Client] Already connected')
      return
    }

    this.socket = io(this.config.serverUrl!, {
      path: '/embed-ws',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    this.setupEventHandlers()
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
    }
  }

  /**
   * Join a workflow room
   */
  async joinWorkflow(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'))
        return
      }

      this.socket.emit(EmbedEventType.JOIN_WORKFLOW, {
        workflowId: this.config.workflowId,
        apiKey: this.config.apiKey,
      })

      // Wait for workflow state or error
      const handleState = (data: any) => {
        this.workflowState = data.workflow
        this.socket?.off(EmbedEventType.WORKFLOW_STATE, handleState)
        this.socket?.off(EmbedEventType.ERROR, handleError)
        resolve()
      }

      const handleError = (data: any) => {
        this.socket?.off(EmbedEventType.WORKFLOW_STATE, handleState)
        this.socket?.off(EmbedEventType.ERROR, handleError)
        reject(new Error(data.message))
      }

      this.socket.once(EmbedEventType.WORKFLOW_STATE, handleState)
      this.socket.once(EmbedEventType.ERROR, handleError)
    })
  }

  /**
   * Add a node to the workflow
   */
  async addNode(node: NodeData, graphId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'))
        return
      }

      this.socket.emit(EmbedEventType.ADD_NODE, {
        node,
        graphId,
      })

      // Wait for confirmation or error
      const handleAdded = (data: any) => {
        if (data.node.id === node.id) {
          this.socket?.off(EmbedEventType.NODE_ADDED, handleAdded)
          this.socket?.off(EmbedEventType.ERROR, handleError)
          resolve()
        }
      }

      const handleError = (data: any) => {
        this.socket?.off(EmbedEventType.NODE_ADDED, handleAdded)
        this.socket?.off(EmbedEventType.ERROR, handleError)
        reject(new Error(data.message))
      }

      this.socket.on(EmbedEventType.NODE_ADDED, handleAdded)
      this.socket.once(EmbedEventType.ERROR, handleError)
    })
  }

  /**
   * Update a node in the workflow
   */
  async updateNode(nodeId: string, updates: Partial<NodeData>, graphId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'))
        return
      }

      this.socket.emit(EmbedEventType.UPDATE_NODE, {
        nodeId,
        updates,
        graphId,
      })

      // Similar event handling as addNode
      resolve()
    })
  }

  /**
   * Delete a node from the workflow
   */
  async deleteNode(nodeId: string, graphId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'))
        return
      }

      this.socket.emit(EmbedEventType.DELETE_NODE, {
        nodeId,
        graphId,
      })

      resolve()
    })
  }

  /**
   * Add a group to the workflow
   */
  async addGroup(group: GroupData, graphId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'))
        return
      }

      this.socket.emit(EmbedEventType.ADD_GROUP, {
        group,
        graphId,
      })

      resolve()
    })
  }

  /**
   * Execute the workflow
   */
  async executeWorkflow(graphId?: string, inputs?: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'))
        return
      }

      this.socket.emit(EmbedEventType.EXECUTE_WORKFLOW, {
        graphId,
        inputs,
      })

      // Wait for execution result
      const handleExecuted = (data: any) => {
        this.socket?.off(EmbedEventType.WORKFLOW_EXECUTED, handleExecuted)
        this.socket?.off(EmbedEventType.ERROR, handleError)
        resolve(data)
      }

      const handleError = (data: any) => {
        this.socket?.off(EmbedEventType.WORKFLOW_EXECUTED, handleExecuted)
        this.socket?.off(EmbedEventType.ERROR, handleError)
        reject(new Error(data.message))
      }

      this.socket.once(EmbedEventType.WORKFLOW_EXECUTED, handleExecuted)
      this.socket.once(EmbedEventType.ERROR, handleError)
    })
  }

  /**
   * Get the current workflow state
   */
  getWorkflowState(): WorkflowState | null {
    return this.workflowState
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected
  }

  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('[Embed WS Client] Connected')
      this.connected = true
      this.emit('connected')
    })

    this.socket.on('disconnect', () => {
      console.log('[Embed WS Client] Disconnected')
      this.connected = false
      this.emit('disconnected')
    })

    this.socket.on('error', (error: any) => {
      console.error('[Embed WS Client] Error:', error)
      this.emit('error', error)
    })

    // Workflow events
    this.socket.on(EmbedEventType.NODE_ADDED, data => {
      this.emit('nodeAdded', data)
    })

    this.socket.on(EmbedEventType.NODE_UPDATED, data => {
      this.emit('nodeUpdated', data)
    })

    this.socket.on(EmbedEventType.NODE_DELETED, data => {
      this.emit('nodeDeleted', data)
    })

    this.socket.on(EmbedEventType.GROUP_ADDED, data => {
      this.emit('groupAdded', data)
    })

    this.socket.on(EmbedEventType.GROUP_UPDATED, data => {
      this.emit('groupUpdated', data)
    })

    this.socket.on(EmbedEventType.GROUP_DELETED, data => {
      this.emit('groupDeleted', data)
    })

    this.socket.on(EmbedEventType.EXECUTION_STATUS, data => {
      this.emit('executionStatus', data)
    })
  }
}

// Export a factory function for easy usage
export function createEmbedClient(config: EmbedWebSocketConfig): EmbedWebSocketClient {
  return new EmbedWebSocketClient(config)
}
