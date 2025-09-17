/**
 * Browser-compatible ZIP Client for Embed SDK
 * Directly calls ZIP protocol APIs without Node.js dependencies
 */

import type { NodeTemplate } from './types'

export interface ZIPClientConfig {
  baseUrl: string
  authToken?: string
  websocketPath?: string
}

// Re-export types needed for ZIP API
export interface RegisterTemplatesRequest {
  namespace: string
  templates: NodeTemplate[]
  webhookUrl?: string
}

export interface RegisterTemplatesResponse {
  success: boolean
  message?: string
  registeredCount?: number
}

export interface CreateWorkflowRequest {
  name: string
  description?: string
  namespace?: string
  metadata?: Record<string, any>
}

export interface CreateWorkflowResponse {
  workflowId: string
  workflow: any
}

export interface AddNodeRequest {
  workflowId: string
  graphId?: string
  templateId: string
  position: { x: number; y: number }
  properties?: Record<string, any>
}

export interface AddNodeResponse {
  nodeId: string
  node: any
}

export interface ConnectNodesRequest {
  workflowId: string
  graphId?: string
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
}

export interface CreateTraceSessionRequest {
  workflowId: string
  sessionId?: string
  metadata?: Record<string, any>
}

export interface TraceEvent {
  timestamp: number
  nodeId: string
  eventType: 'input' | 'output' | 'error' | 'progress'
  data?: any
  duration?: number
  metadata?: Record<string, any>
}

/**
 * Browser-compatible ZIP client with full API support
 */
export class ZIPClient {
  private baseUrl: string
  private authToken?: string
  private config: ZIPClientConfig
  public templates: TemplatesAPI
  public orchestrator: OrchestratorAPI
  public traces: TracesAPI
  public events: EventsAPI

  constructor(config: ZIPClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.authToken = config.authToken || sessionStorage.getItem('zealAuthToken') || undefined
    this.config = config

    // Initialize API modules
    this.templates = new TemplatesAPI(this.baseUrl, this.authToken)
    this.orchestrator = new OrchestratorAPI(this.baseUrl, this.authToken)
    this.traces = new TracesAPI(this.baseUrl, this.authToken)
    this.events = new EventsAPI(this.baseUrl, config.websocketPath || '/zip/events', this.authToken)
  }

  /**
   * Make authenticated request to ZIP API
   */
  static async request(
    url: string,
    options: RequestInit = {},
    authToken?: string
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    }

    // Add auth token if available
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: { message: response.statusText }
      }))
      throw new Error(error.error?.message || response.statusText)
    }

    return response.json()
  }

  /**
   * Health check
   */
  async health(): Promise<{
    status: 'healthy' | 'unhealthy'
    version: string
    services: Record<string, 'healthy' | 'unhealthy'>
  }> {
    return ZIPClient.request(`${this.baseUrl}/api/zip/health`, {}, this.authToken)
  }
}

/**
 * Templates API
 */
class TemplatesAPI {
  constructor(private baseUrl: string, private authToken?: string) {}

  /**
   * Register templates
   */
  async register(request: RegisterTemplatesRequest): Promise<RegisterTemplatesResponse> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/templates/register`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      this.authToken
    )
  }

  /**
   * List templates in a namespace
   */
  async list(namespace: string): Promise<{
    namespace: string
    templates: NodeTemplate[]
    count: number
  }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/templates/${namespace}`,
      {},
      this.authToken
    )
  }

  /**
   * Update a template
   */
  async update(
    namespace: string,
    templateId: string,
    updates: Partial<NodeTemplate>
  ): Promise<{ success: boolean; template: any }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/templates/${namespace}/${templateId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      },
      this.authToken
    )
  }

  /**
   * Delete a template
   */
  async delete(
    namespace: string,
    templateId: string
  ): Promise<{ success: boolean; message: string }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/templates/${namespace}/${templateId}`,
      {
        method: 'DELETE',
      },
      this.authToken
    )
  }
}

/**
 * Orchestrator API
 */
class OrchestratorAPI {
  constructor(private baseUrl: string, private authToken?: string) {}

  /**
   * Create a new workflow
   */
  async createWorkflow(request: CreateWorkflowRequest): Promise<CreateWorkflowResponse> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/workflows`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      this.authToken
    )
  }

  /**
   * List workflows
   */
  async listWorkflows(params?: {
    limit?: number
    offset?: number
  }): Promise<{
    workflows: any[]
    total: number
    limit: number
    offset: number
  }> {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.offset) searchParams.append('offset', params.offset.toString())

    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/workflows?${searchParams}`,
      {},
      this.authToken
    )
  }

  /**
   * Get workflow state
   */
  async getWorkflowState(
    workflowId: string,
    graphId = 'main'
  ): Promise<{
    workflowId: string
    graphId: string
    name: string
    description: string
    version: number
    state: {
      nodes: any[]
      connections: any[]
      groups: any[]
    }
    metadata: any
  }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/workflows/${workflowId}/state?graphId=${graphId}`,
      {},
      this.authToken
    )
  }

  /**
   * Add a node to a workflow
   */
  async addNode(request: AddNodeRequest): Promise<AddNodeResponse> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/nodes`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      this.authToken
    )
  }

  /**
   * Update node properties
   */
  async updateNode(
    nodeId: string,
    updates: {
      workflowId: string
      graphId?: string
      properties?: Record<string, any>
      position?: { x: number; y: number }
    }
  ): Promise<{ success: boolean }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/nodes/${nodeId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
      this.authToken
    )
  }

  /**
   * Delete a node
   */
  async deleteNode(
    nodeId: string,
    workflowId: string,
    graphId = 'main'
  ): Promise<{ success: boolean; message: string }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/nodes/${nodeId}?workflowId=${workflowId}&graphId=${graphId}`,
      {
        method: 'DELETE',
      },
      this.authToken
    )
  }

  /**
   * Connect two nodes
   */
  async connectNodes(request: ConnectNodesRequest): Promise<{
    connectionId: string
    connection: any
  }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/connections`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      this.authToken
    )
  }

  /**
   * Remove a connection between nodes
   */
  async removeConnection(request: {
    workflowId: string
    graphId?: string
    connectionId: string
  }): Promise<{
    success: boolean
    message: string
  }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/connections`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          ...request,
          graphId: request.graphId || 'main'
        }),
      },
      this.authToken
    )
  }

  /**
   * Create a node group
   */
  async createGroup(request: {
    workflowId: string
    graphId?: string
    title: string
    nodeIds: string[]
    color?: string
    description?: string
  }): Promise<{
    success: boolean
    groupId: string
    group: any
  }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/groups`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      this.authToken
    )
  }

  /**
   * Update group properties
   */
  async updateGroup(request: {
    workflowId: string
    graphId?: string
    groupId: string
    title?: string
    nodeIds?: string[]
    color?: string
    description?: string
  }): Promise<{
    success: boolean
    group: any
  }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/groups`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...request,
          graphId: request.graphId || 'main'
        }),
      },
      this.authToken
    )
  }

  /**
   * Remove a group
   */
  async removeGroup(request: {
    workflowId: string
    graphId?: string
    groupId: string
  }): Promise<{
    success: boolean
    message: string
  }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/groups`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          ...request,
          graphId: request.graphId || 'main'
        }),
      },
      this.authToken
    )
  }

  /**
   * Execute a workflow
   */
  async execute(request: {
    workflowId: string
    inputs?: Record<string, any>
    config?: {
      timeout?: number
      maxRetries?: number
      continueOnError?: boolean
    }
  }): Promise<{
    sessionId: string
    status: string
    outputs?: Record<string, any>
  }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/execute`,
      {
        method: 'POST',
        body: JSON.stringify(request)
      },
      this.authToken
    )
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(sessionId: string): Promise<{
    sessionId: string
    status: string
    progress?: number
    currentNode?: string
    outputs?: Record<string, any>
    errors?: any[]
  }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/status/${sessionId}`,
      {
        method: 'GET'
      },
      this.authToken
    )
  }

  /**
   * Cancel execution
   */
  async cancelExecution(sessionId: string): Promise<{ success: boolean }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/orchestrator/cancel/${sessionId}`,
      {
        method: 'POST'
      },
      this.authToken
    )
  }
}

/**
 * Traces API
 */
class TracesAPI {
  private sessionId: string | null = null

  constructor(private baseUrl: string, private authToken?: string) {}

  /**
   * Create a new trace session
   */
  async createSession(
    request: CreateTraceSessionRequest
  ): Promise<{ sessionId: string; startTime: string }> {
    const response = await ZIPClient.request(
      `${this.baseUrl}/api/zip/traces/sessions`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      this.authToken
    )

    this.sessionId = response.sessionId
    return response
  }

  /**
   * Submit trace events
   */
  async submitEvents(
    sessionId: string,
    events: TraceEvent[]
  ): Promise<{ success: boolean; eventsProcessed: number }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/traces/${sessionId}/events`,
      {
        method: 'POST',
        body: JSON.stringify({ events }),
      },
      this.authToken
    )
  }

  /**
   * Submit a single trace event
   */
  async submitEvent(
    sessionId: string,
    event: TraceEvent
  ): Promise<{ success: boolean; eventsProcessed: number }> {
    return this.submitEvents(sessionId, [event])
  }

  /**
   * Complete a trace session
   */
  async completeSession(
    sessionId: string,
    request: {
      status: 'success' | 'error' | 'cancelled'
      summary?: {
        totalNodes: number
        successfulNodes: number
        failedNodes: number
        totalDuration: number
        totalDataProcessed: number
      }
      error?: {
        message: string
        nodeId?: string
        stack?: string
      }
    }
  ): Promise<{ success: boolean; sessionId: string; status: string }> {
    const response = await ZIPClient.request(
      `${this.baseUrl}/api/zip/traces/${sessionId}/complete`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      this.authToken
    )

    if (this.sessionId === sessionId) {
      this.sessionId = null
    }

    return response
  }

  /**
   * Helper method to trace node execution
   */
  async traceNodeExecution(
    sessionId: string,
    nodeId: string,
    type: 'input' | 'output' | 'error',
    data: any,
    duration?: number
  ): Promise<void> {
    await this.submitEvent(sessionId, {
      timestamp: Date.now(),
      nodeId,
      eventType: type,
      data: {
        size: JSON.stringify(data).length,
        type: typeof data,
        preview: data,
      },
      duration,
    })
  }

  /**
   * Batch trace submission
   */
  async submitBatch(request: {
    sessionId: string
    events: TraceEvent[]
    isComplete?: boolean
  }): Promise<{ success: boolean }> {
    return ZIPClient.request(
      `${this.baseUrl}/api/zip/traces/batch`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      this.authToken
    )
  }
}

/**
 * Events API - Browser-compatible WebSocket only
 */
class EventsAPI {
  private socket: WebSocket | null = null
  private handlers: Map<string, Set<Function>> = new Map()
  private reconnectTimer?: number
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10

  constructor(
    private baseUrl: string,
    private websocketPath: string,
    private authToken?: string
  ) {}

  /**
   * Connect to WebSocket
   */
  connect(workflowId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL
        const wsUrl = new URL(this.baseUrl)
        wsUrl.protocol = wsUrl.protocol.replace('http', 'ws')
        wsUrl.pathname = this.websocketPath
        
        if (this.authToken) {
          wsUrl.searchParams.set('authToken', this.authToken)
        }
        wsUrl.searchParams.set('workflowId', workflowId)

        // Create WebSocket connection
        this.socket = new WebSocket(wsUrl.toString())

        this.socket.onopen = () => {
          console.log('Connected to Zeal WebSocket')
          this.reconnectAttempts = 0
          
          // Send auth message if needed
          if (this.authToken) {
            this.socket?.send(JSON.stringify({
              type: 'auth',
              token: this.authToken,
              workflowId
            }))
          }
          
          resolve()
        }

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error)
          if (this.socket?.readyState === WebSocket.CONNECTING) {
            reject(error)
          }
        }

        this.socket.onclose = () => {
          console.log('Disconnected from Zeal WebSocket')
          this.attemptReconnect(workflowId)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    
    this.handlers.clear()
  }

  /**
   * Subscribe to events
   */
  on(eventType: string, handler: Function): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)?.add(handler)
  }

  /**
   * Unsubscribe from events
   */
  off(eventType: string, handler: Function): void {
    this.handlers.get(eventType)?.delete(handler)
  }

  /**
   * Send a message
   */
  send(message: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }

  private handleMessage(data: any): void {
    // Emit to specific handlers
    const handlers = this.handlers.get(data.type)
    if (handlers) {
      handlers.forEach(handler => handler(data))
    }

    // Emit to wildcard handlers
    const wildcardHandlers = this.handlers.get('*')
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => handler(data))
    }
  }

  private attemptReconnect(workflowId: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000)
      
      console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      
      this.reconnectTimer = window.setTimeout(() => {
        this.connect(workflowId).catch(console.error)
      }, delay)
    }
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
    this.send({
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
    this.send({
      type: `node.execution.${status}`,
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
    this.send({
      type: `connection.flow.${status}`,
      workflowId,
      timestamp: Date.now(),
      data: {
        connectionId,
        ...data,
      },
    })
  }
}