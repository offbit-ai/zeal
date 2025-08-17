/**
 * WebSocket handler for embedded workflow interactions
 * Provides real-time communication for 3rd party applications
 */

import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { getDatabaseOperations } from '@/lib/database'
import { z } from 'zod'

// Event types for embed WebSocket
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

// Schemas for validation
const nodeSchema = z.object({
  id: z.string(),
  metadata: z.object({
    type: z.string(),
    title: z.string(),
    description: z.string().optional(),
    // ... other metadata fields
  }),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  propertyValues: z.record(z.any()).optional(),
})

const groupSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  nodeIds: z.array(z.string()),
  color: z.string().optional(),
})

interface EmbedClient {
  socket: Socket
  workflowId: string
  permissions: {
    canAddNodes: boolean
    canEditNodes: boolean
    canDeleteNodes: boolean
    canAddGroups: boolean
    canEditGroups: boolean
    canDeleteGroups: boolean
    canExecute: boolean
  }
}

export class EmbedWebSocketHandler {
  private io: SocketIOServer
  private clients: Map<string, EmbedClient> = new Map()

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      path: '/embed-ws',
      cors: {
        origin: '*', // Configure based on your security requirements
        methods: ['GET', 'POST'],
      },
    })

    this.setupHandlers()
  }

  private setupHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log('[Embed WS] Client connected:', socket.id)

      socket.on(EmbedEventType.JOIN_WORKFLOW, async data => {
        await this.handleJoinWorkflow(socket, data)
      })

      socket.on(EmbedEventType.LEAVE_WORKFLOW, async data => {
        await this.handleLeaveWorkflow(socket, data)
      })

      socket.on(EmbedEventType.ADD_NODE, async data => {
        await this.handleAddNode(socket, data)
      })

      socket.on(EmbedEventType.UPDATE_NODE, async data => {
        await this.handleUpdateNode(socket, data)
      })

      socket.on(EmbedEventType.DELETE_NODE, async data => {
        await this.handleDeleteNode(socket, data)
      })

      socket.on(EmbedEventType.ADD_GROUP, async data => {
        await this.handleAddGroup(socket, data)
      })

      socket.on(EmbedEventType.EXECUTE_WORKFLOW, async data => {
        await this.handleExecuteWorkflow(socket, data)
      })

      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })
    })
  }

  private async handleJoinWorkflow(socket: Socket, data: any) {
    try {
      const { workflowId, apiKey } = data

      // Validate API key and get permissions
      const permissions = await this.validateApiKey(apiKey, workflowId)
      if (!permissions) {
        socket.emit(EmbedEventType.ERROR, {
          message: 'Invalid API key or workflow access denied',
        })
        return
      }

      // Get workflow data
      const db = await getDatabaseOperations()
      const workflow = await db.getWorkflow(workflowId)

      if (!workflow || !workflow.settings?.allowEmbed) {
        socket.emit(EmbedEventType.ERROR, {
          message: 'Workflow not found or embedding not allowed',
        })
        return
      }

      // Store client info
      this.clients.set(socket.id, {
        socket,
        workflowId,
        permissions,
      })

      // Join Socket.IO room for this workflow
      socket.join(`embed:${workflowId}`)

      // Send current workflow state
      socket.emit(EmbedEventType.WORKFLOW_STATE, {
        workflow: {
          id: workflow.id,
          name: workflow.name,
          graphs: workflow.graphs,
        },
      })

      // Set up CRDT observer for real-time updates
      this.observeWorkflowChanges(workflowId, socket)
    } catch (error) {
      console.error('[Embed WS] Error joining workflow:', error)
      socket.emit(EmbedEventType.ERROR, {
        message: 'Failed to join workflow',
      })
    }
  }

  private async handleLeaveWorkflow(socket: Socket, data: any) {
    const client = this.clients.get(socket.id)
    if (!client) return

    socket.leave(`embed:${client.workflowId}`)
    this.clients.delete(socket.id)
  }

  private async handleAddNode(socket: Socket, data: any) {
    const client = this.clients.get(socket.id)
    if (!client || !client.permissions.canAddNodes) {
      socket.emit(EmbedEventType.ERROR, {
        message: 'Permission denied',
      })
      return
    }

    try {
      // Validate node data
      const nodeData = nodeSchema.parse(data.node)
      const graphId = data.graphId || 'main'

      // TODO: Implement node addition through proper workflow service
      // For now, just emit the event to notify clients

      // Notify all clients in the room
      this.io.to(`embed:${client.workflowId}`).emit(EmbedEventType.NODE_ADDED, {
        graphId,
        node: nodeData,
      })
    } catch (error) {
      console.error('[Embed WS] Error adding node:', error)
      socket.emit(EmbedEventType.ERROR, {
        message: 'Failed to add node',
      })
    }
  }

  private async handleUpdateNode(socket: Socket, data: any) {
    const client = this.clients.get(socket.id)
    if (!client || !client.permissions.canEditNodes) {
      socket.emit(EmbedEventType.ERROR, {
        message: 'Permission denied',
      })
      return
    }

    // Implementation similar to handleAddNode
  }

  private async handleDeleteNode(socket: Socket, data: any) {
    const client = this.clients.get(socket.id)
    if (!client || !client.permissions.canDeleteNodes) {
      socket.emit(EmbedEventType.ERROR, {
        message: 'Permission denied',
      })
      return
    }

    // Implementation similar to handleAddNode
  }

  private async handleAddGroup(socket: Socket, data: any) {
    const client = this.clients.get(socket.id)
    if (!client || !client.permissions.canAddGroups) {
      socket.emit(EmbedEventType.ERROR, {
        message: 'Permission denied',
      })
      return
    }

    try {
      // Validate group data
      const groupData = groupSchema.parse(data.group)
      const graphId = data.graphId || 'main'

      // Implementation similar to handleAddNode
    } catch (error) {
      console.error('[Embed WS] Error adding group:', error)
      socket.emit(EmbedEventType.ERROR, {
        message: 'Failed to add group',
      })
    }
  }

  private async handleExecuteWorkflow(socket: Socket, data: any) {
    const client = this.clients.get(socket.id)
    if (!client || !client.permissions.canExecute) {
      socket.emit(EmbedEventType.ERROR, {
        message: 'Permission denied',
      })
      return
    }

    try {
      const { graphId = 'main', inputs = {} } = data

      // Emit execution started event
      socket.emit(EmbedEventType.EXECUTION_STATUS, {
        status: 'started',
        graphId,
        timestamp: new Date().toISOString(),
      })

      // TODO: Implement actual workflow execution
      // This would integrate with your workflow execution engine

      // Simulate execution completion
      setTimeout(() => {
        socket.emit(EmbedEventType.WORKFLOW_EXECUTED, {
          graphId,
          status: 'completed',
          outputs: {
            // Execution results
          },
          timestamp: new Date().toISOString(),
        })
      }, 2000)
    } catch (error) {
      console.error('[Embed WS] Error executing workflow:', error)
      socket.emit(EmbedEventType.ERROR, {
        message: 'Failed to execute workflow',
      })
    }
  }

  private observeWorkflowChanges(workflowId: string, socket: Socket) {
    // Set up CRDT observers to emit real-time changes
    // This would observe the Y.Doc for the workflow and emit events
    // when nodes, connections, or groups change
  }

  private handleDisconnect(socket: Socket) {
    const client = this.clients.get(socket.id)
    if (client) {
      socket.leave(`embed:${client.workflowId}`)
      this.clients.delete(socket.id)
    }
    console.log('[Embed WS] Client disconnected:', socket.id)
  }

  private async validateApiKey(apiKey: string, workflowId: string): Promise<any> {
    try {
      const { EmbedApiKeyService } = await import('@/services/embedApiKeyService')
      const validKey = await EmbedApiKeyService.validateApiKey(apiKey, workflowId)

      if (!validKey) {
        return null
      }

      // Check rate limits
      const withinLimits = await EmbedApiKeyService.checkRateLimits(validKey.id)
      if (!withinLimits) {
        throw new Error('Rate limit exceeded')
      }

      return validKey.permissions
    } catch (error) {
      console.error('[Embed WS] API key validation error:', error)
      return null
    }
  }
}
