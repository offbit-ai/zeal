/**
 * ZIP WebSocket handler for bidirectional event system
 * Provides real-time communication for 3rd party runtime integrations
 */

import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { z } from 'zod'
import { 
  ZipWebSocketEvent,
  WorkflowUpdatedEvent,
  createNodeExecutingEvent,
  createNodeCompletedEvent,
  createNodeFailedEvent,
  createExecutionStartedEvent,
  createExecutionCompletedEvent,
  createExecutionFailedEvent,
  isExecutionEvent,
  isNodeEvent,
} from '@/types/zip-events'
import { WorkflowDatabase } from '@/services/workflowDatabase'
import { getZipWebhookOperations } from '@/lib/database-zip-operations'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'
import { v4 as uuidv4 } from 'uuid'

// Auth message schema
const authMessageSchema = z.object({
  type: z.literal('auth'),
  workflowId: z.string(),
  // Since it's self-hosted, we don't need API key
  metadata: z.record(z.any()).optional(),
})

// Runtime event schema - now uses typed events
const runtimeEventSchema = z.object({
  type: z.enum([
    'node.executing',
    'node.completed',
    'node.failed',
    'node.warning',
    'execution.started',
    'execution.completed',
    'execution.failed',
    'connection.state',
  ]),
  workflowId: z.string(),
  timestamp: z.string(),
  nodeId: z.string().optional(),
  graphId: z.string().optional(),
  data: z.any().optional(),
  metadata: z.any().optional(),
})

// Visual state update interface
interface VisualStateUpdate {
  type: 'visual.state.update'
  elements: Array<{
    id: string
    elementType: 'node' | 'connection'
    state: 'idle' | 'pending' | 'running' | 'success' | 'error' | 'warning'
    progress?: number
    message?: string
    highlight?: boolean
    color?: string
  }>
}

// Visual state update schema
const visualStateUpdateSchema = z.object({
  type: z.literal('visual.state.update'),
  elements: z.array(z.object({
    id: z.string(),
    elementType: z.enum(['node', 'connection']),
    state: z.enum(['idle', 'pending', 'running', 'success', 'error', 'warning']),
    progress: z.number().optional(),
    message: z.string().optional(),
    highlight: z.boolean().optional(),
    color: z.string().optional(),
  })),
})

interface ZipClient {
  socket: Socket
  workflowId: string
  namespace?: string
  metadata?: Record<string, any>
  authenticated: boolean
}

export class ZipWebSocketHandler {
  private io: SocketIOServer
  private clients: Map<string, ZipClient> = new Map()
  private workflowClients: Map<string, Set<string>> = new Map()

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      path: '/zip/events',
      cors: {
        origin: '*', // Self-hosted, so allow all origins
        methods: ['GET', 'POST'],
      },
    })

    this.setupHandlers()
    this.setupCRDTSync()
  }

  private setupHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`ZIP client connected: ${socket.id}`)

      // Initialize client
      this.clients.set(socket.id, {
        socket,
        workflowId: '',
        authenticated: false,
      })

      // Handle authentication
      socket.on('auth', async (data) => {
        await this.handleAuth(socket, data)
      })

      // Handle runtime events
      socket.on('runtime.event', async (data) => {
        await this.handleRuntimeEvent(socket, data)
      })

      // Handle visual state updates
      socket.on('visual.state.update', async (data) => {
        await this.handleVisualStateUpdate(socket, data)
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })

      // Handle errors
      socket.on('error', (error) => {
        console.error(`ZIP WebSocket error for ${socket.id}:`, error)
      })
    })

    // Subscribe to CRDT events for workflow changes
    this.subscribeToCRDTEvents()
  }

  private async handleAuth(socket: Socket, data: any) {
    try {
      const validation = authMessageSchema.safeParse(data)
      if (!validation.success) {
        socket.emit('error', {
          code: 'AUTH_ERROR',
          message: 'Invalid auth message',
          details: validation.error.errors,
        })
        return
      }

      const { workflowId, metadata } = validation.data
      
      // Verify workflow exists
      const workflow = await WorkflowDatabase.getWorkflow(workflowId)
      if (!workflow) {
        socket.emit('error', {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow ${workflowId} not found`,
        })
        return
      }

      // Update client info
      const client = this.clients.get(socket.id)
      if (client) {
        client.workflowId = workflowId
        client.metadata = metadata
        client.authenticated = true

        // Add to workflow clients
        if (!this.workflowClients.has(workflowId)) {
          this.workflowClients.set(workflowId, new Set())
        }
        this.workflowClients.get(workflowId)?.add(socket.id)

        // Join workflow room
        socket.join(`workflow:${workflowId}`)

        // Send initial workflow state
        await this.sendWorkflowState(socket, workflowId)

        // Send auth success
        socket.emit('auth.success', {
          workflowId,
          message: 'Successfully authenticated',
          timestamp: Date.now(),
        })
      }
    } catch (error) {
      console.error('Auth error:', error)
      socket.emit('error', {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      })
    }
  }

  private async handleRuntimeEvent(socket: Socket, data: any) {
    const client = this.clients.get(socket.id)
    if (!client?.authenticated) {
      socket.emit('error', {
        code: 'NOT_AUTHENTICATED',
        message: 'Please authenticate first',
      })
      return
    }

    try {
      const validation = runtimeEventSchema.safeParse(data)
      if (!validation.success) {
        socket.emit('error', {
          code: 'VALIDATION_ERROR',
          message: 'Invalid runtime event',
          details: validation.error.errors,
        })
        return
      }

      const eventData = validation.data
      
      // Create properly typed event based on type
      let typedEvent: ZipWebSocketEvent | null = null
      
      switch (eventData.type) {
        case 'node.executing':
          typedEvent = createNodeExecutingEvent(
            eventData.workflowId,
            eventData.nodeId || '',
            eventData.data?.inputConnections || [],
            eventData.graphId || 'main'
          )
          break
        case 'node.completed':
          typedEvent = createNodeCompletedEvent(
            eventData.workflowId,
            eventData.nodeId || '',
            eventData.data?.outputConnections || [],
            {
              graphId: eventData.graphId || 'main',
              duration: eventData.data?.duration,
              outputSize: eventData.data?.outputSize,
              metadata: eventData.metadata
            }
          )
          break
        case 'node.failed':
          typedEvent = createNodeFailedEvent(
            eventData.workflowId,
            eventData.nodeId || '',
            eventData.data?.outputConnections || [],
            eventData.data?.error,
            eventData.graphId || 'main'
          )
          break
        case 'execution.started':
          typedEvent = createExecutionStartedEvent(
            eventData.workflowId,
            eventData.data?.sessionId || '',
            eventData.data?.workflowName || `Workflow ${eventData.workflowId}`,
            {
              graphId: eventData.graphId || 'main',
              metadata: eventData.metadata
            }
          )
          break
        case 'execution.completed':
          typedEvent = createExecutionCompletedEvent(
            eventData.workflowId,
            eventData.data?.sessionId || '',
            eventData.data?.duration || 0,
            eventData.data?.nodesExecuted || 0,
            {
              graphId: eventData.graphId || 'main',
              summary: eventData.data?.summary,
              metadata: eventData.metadata
            }
          )
          break
        case 'execution.failed':
          typedEvent = createExecutionFailedEvent(
            eventData.workflowId,
            eventData.data?.sessionId || '',
            eventData.data?.error,
            {
              graphId: eventData.graphId || 'main',
              duration: eventData.data?.duration,
              metadata: eventData.metadata
            }
          )
          break
      }
      
      if (typedEvent) {
        // Broadcast typed event to all clients in the workflow room
        this.io.to(`workflow:${eventData.workflowId}`).emit('zip.event', typedEvent)
      }

      // Store event for replay
      if (typedEvent) {
        await this.storeRuntimeEvent(typedEvent)
      }

      socket.emit('event.acknowledged', {
        type: eventData.type,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error('Runtime event error:', error)
      socket.emit('error', {
        code: 'EVENT_ERROR',
        message: 'Failed to process runtime event',
      })
    }
  }

  private async handleVisualStateUpdate(socket: Socket, data: any) {
    const client = this.clients.get(socket.id)
    if (!client?.authenticated) {
      socket.emit('error', {
        code: 'NOT_AUTHENTICATED',
        message: 'Please authenticate first',
      })
      return
    }

    try {
      const validation = visualStateUpdateSchema.safeParse(data)
      if (!validation.success) {
        socket.emit('error', {
          code: 'VALIDATION_ERROR',
          message: 'Invalid visual state update',
          details: validation.error.errors,
        })
        return
      }

      const update = validation.data as VisualStateUpdate

      // Broadcast to all clients in the workflow room
      this.io.to(`workflow:${client.workflowId}`).emit('visual.state.update', update)

      socket.emit('update.acknowledged', {
        type: 'visual.state.update',
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error('Visual state update error:', error)
      socket.emit('error', {
        code: 'UPDATE_ERROR',
        message: 'Failed to process visual state update',
      })
    }
  }

  private handleDisconnect(socket: Socket) {
    const client = this.clients.get(socket.id)
    if (client?.workflowId) {
      // Remove from workflow clients
      const workflowClients = this.workflowClients.get(client.workflowId)
      if (workflowClients) {
        workflowClients.delete(socket.id)
        if (workflowClients.size === 0) {
          this.workflowClients.delete(client.workflowId)
        }
      }

      // Leave workflow room
      socket.leave(`workflow:${client.workflowId}`)
    }

    // Remove client
    this.clients.delete(socket.id)
    console.log(`ZIP client disconnected: ${socket.id}`)
  }

  private async sendWorkflowState(socket: Socket, workflowId: string) {
    try {
      const { versions } = await WorkflowDatabase.getWorkflowVersions(workflowId, { limit: 1 })
      const latestVersion = versions[0]

      if (latestVersion) {
        const workflowEvent: WorkflowUpdatedEvent = {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          type: 'workflow.updated',
          workflowId,
          graphId: 'main',
          data: {
            version: latestVersion.version,
            graphs: latestVersion.graphs,
            metadata: latestVersion.metadata,
          },
          metadata: {
            namespace: latestVersion.metadata?.namespace || 'default',
          },
        }

        socket.emit('workflow.state', workflowEvent)
      }
    } catch (error) {
      console.error('Error sending workflow state:', error)
    }
  }

  private subscribeToCRDTEvents() {
    // Poll for CRDT updates periodically
    setInterval(() => {
      this.checkCRDTUpdates()
    }, 1000) // Check every second
    
    console.log('ZIP WebSocket handler subscribed to CRDT events')
  }
  
  private async checkCRDTUpdates() {
    // Check for pending CRDT updates for each workflow
    for (const workflowId of this.workflowClients.keys()) {
      if (typeof globalThis !== 'undefined' && (globalThis as any).pendingCRDTUpdates) {
        const updates = (globalThis as any).pendingCRDTUpdates as Map<string, any[]>
        const workflowUpdates = updates.get(workflowId)
        
        if (workflowUpdates && workflowUpdates.length > 0) {
          // Process and emit updates
          for (const update of workflowUpdates) {
            await this.handleCRDTUpdate(workflowId, update)
          }
          
          // Clear processed updates
          updates.set(workflowId, [])
        }
      }
    }
  }
  
  private async handleCRDTUpdate(workflowId: string, update: any) {
    // Convert CRDT update to typed ZIP event
    let zipEvent: ZipWebSocketEvent | null = null
    
    switch (update.type) {
      case 'node-added':
      case 'node-updated':
        // Emit node executing event when node is updated
        if (update.data?.state === 'executing') {
          zipEvent = createNodeExecutingEvent(
            workflowId,
            update.data.nodeId,
            [],  // Input connections not available in CRDT update
            update.data.graphId || 'main'
          )
        }
        break
      case 'node-removed':
        // Node removal doesn't have a specific event type
        break
      case 'connection-added':
      case 'connection-removed':
        // Connection events are handled separately
        break
    }
    
    if (zipEvent) {
      // Emit to all clients in the workflow room
      this.io.to(`workflow:${workflowId}`).emit('zip.event', zipEvent)
      
      // Trigger webhooks if configured
      await this.triggerWebhooks(workflowId, zipEvent)
    }
  }

  private async storeRuntimeEvent(event: ZipWebSocketEvent) {
    // Store event in database for replay functionality
    // Only store execution events
    if (!isExecutionEvent(event)) return
    
    try {
      // Find or create active trace session for this workflow
      const sessions = await FlowTraceDatabase.listSessions({
        workflowId: event.workflowId,
        status: 'running',
        limit: 1,
        offset: 0,
      })
      
      let sessionId: string
      
      if (sessions.sessions.length > 0) {
        sessionId = sessions.sessions[0].id
      } else {
        // Create new session if none exists
        const session = await FlowTraceDatabase.createSession({
          workflowId: event.workflowId,
          workflowName: `Workflow ${event.workflowId}`,
          userId: 'zip-integration',
        })
        sessionId = session.id
      }
      
      // Store the event
      await FlowTraceDatabase.addEvent({
        id: uuidv4(),
        sessionId,
        timestamp: new Date(event.timestamp).toISOString(),
        nodeId: isNodeEvent(event) ? event.nodeId : 'workflow',
        eventType: this.mapRuntimeEventToTraceType(event.type),
        data: {
          size: JSON.stringify(event).length,  // Stringify the entire event since data property doesn't exist on all types
          type: 'runtime-event',
          preview: event,  // Use the entire event as preview
        },
        metadata: {
          eventType: event.type,
          workflowId: event.workflowId,
        },
      })
      
      console.log('Stored runtime event:', event.type, 'in session:', sessionId)
    } catch (error) {
      console.error('Error storing runtime event:', error)
    }
  }
  
  private mapRuntimeEventToTraceType(type: string): 'input' | 'output' | 'error' | 'log' {
    if (type.includes('error')) return 'error'
    if (type.includes('start')) return 'input'
    if (type.includes('success') || type.includes('complete')) return 'output'
    return 'log'
  }

  // Method to emit ZIP events to connected clients
  public emitZipEvent(workflowId: string, event: ZipWebSocketEvent | any) {
    this.io.to(`workflow:${workflowId}`).emit('zip.event', event)
  }

  // Method to broadcast execution control events
  public broadcastExecutionControl(workflowId: string, eventType: string, data: any) {
    // Emit as a generic control event, not typed as ZipWebSocketEvent
    const event = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: `control.${eventType}`,
      workflowId,
      data,
      metadata: {
        namespace: 'default',
      },
    }

    this.io.to(`workflow:${workflowId}`).emit('control.event', event)
  }

  // Method to get connected clients for a workflow
  public getWorkflowClients(workflowId: string): string[] {
    return Array.from(this.workflowClients.get(workflowId) || [])
  }
  
  // Setup CRDT synchronization
  private setupCRDTSync() {
    // Monitor CRDT updates and sync with connected clients
    setInterval(async () => {
      for (const [workflowId, clientIds] of this.workflowClients.entries()) {
        if (clientIds.size > 0) {
          try {
            // Get latest workflow state
            const { versions } = await WorkflowDatabase.getWorkflowVersions(workflowId, { limit: 1 })
            const latestVersion = versions[0]
            
            if (latestVersion && this.hasStateChanged(workflowId, latestVersion)) {
              // Emit state update to all clients
              const workflowEvent: WorkflowUpdatedEvent = {
                id: uuidv4(),
                timestamp: new Date().toISOString(),
                type: 'workflow.updated',
                workflowId,
                graphId: 'main',
                data: {
                  version: latestVersion.version,
                  graphs: latestVersion.graphs,
                  metadata: latestVersion.metadata,
                },
                metadata: {
                  namespace: latestVersion.metadata?.namespace || 'default',
                },
              }
              
              this.io.to(`workflow:${workflowId}`).emit('workflow.state', workflowEvent)
              this.updateStoredState(workflowId, latestVersion)
            }
          } catch (error) {
            console.error(`Error syncing CRDT for workflow ${workflowId}:`, error)
          }
        }
      }
    }, 2000) // Sync every 2 seconds
  }
  
  private workflowStates: Map<string, any> = new Map()
  
  private hasStateChanged(workflowId: string, newState: any): boolean {
    const oldState = this.workflowStates.get(workflowId)
    if (!oldState) return true
    
    // Simple comparison - can be made more sophisticated
    return JSON.stringify(oldState) !== JSON.stringify(newState)
  }
  
  private updateStoredState(workflowId: string, state: any) {
    this.workflowStates.set(workflowId, state)
  }
  
  // Trigger webhooks for events
  private async triggerWebhooks(workflowId: string, event: ZipWebSocketEvent) {
    try {
      // Extract namespace from workflow metadata
      const workflow = await WorkflowDatabase.getWorkflow(workflowId)
      if (!workflow) return
      
      // Get webhook operations
      const webhookOps = await getZipWebhookOperations()
      
      // Find namespace from workflow metadata (if available)
      const { versions } = await WorkflowDatabase.getWorkflowVersions(workflowId, { limit: 1 })
      const latestVersion = versions[0]
      const namespace = latestVersion?.metadata?.namespace || 'default'
      
      // Get active webhooks for this event
      const webhooks = await webhookOps.getActiveWebhooksForEvent(namespace, event.type)
      
      // Trigger each webhook
      for (const webhook of webhooks) {
        this.sendWebhookEvent(webhook, event).catch(error => {
          console.error(`Failed to send webhook ${webhook.id}:`, error)
        })
      }
    } catch (error) {
      console.error('Error triggering webhooks:', error)
    }
  }
  
  private async sendWebhookEvent(webhook: any, event: ZipWebSocketEvent) {
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zeal-Event': event.type,
          'X-Zeal-Webhook-Id': webhook.id,
          'X-Zeal-Namespace': webhook.namespace,
          ...webhook.headers,
        },
        body: JSON.stringify(event),
      })
      
      if (!response.ok) {
        console.error(`Webhook ${webhook.id} returned ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      console.error(`Failed to send webhook ${webhook.id}:`, error)
    }
  }
}