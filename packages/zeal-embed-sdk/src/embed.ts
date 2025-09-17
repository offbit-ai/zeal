/**
 * Core Zeal Embed implementation
 */

import { EventEmitter } from 'eventemitter3'
import { ZIPClient } from './zip-client'
import {
  EmbedConfig,
  EmbedInstance,
  EmbedMessage,
  NodeTemplate,
  WorkflowExecutionRequest,
  WorkflowExecutionResult,
  WorkflowGraph
} from './types'
import { EmbedWebSocketHandler } from './websocket'
import { ZealReflowRuntime } from './worker/runtime/reflow-runtime'
import { ExecutionHandle } from './worker/bridge/execution-handle'
import type {
  NodeAddedEvent,
  NodeUpdatedEvent,
  NodeDeletedEvent,
  ConnectionAddedEvent,
  ConnectionDeletedEvent,
  ExecutionStartedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  WorkflowUpdatedEvent,
} from '../../../types/zip-events'

export class ZealEmbed extends EventEmitter implements EmbedInstance {
  private config: Required<EmbedConfig>
  private _iframe: HTMLIFrameElement | null = null
  private _client: ZIPClient
  private _runtime?: ZealReflowRuntime
  private _websocket?: EmbedWebSocketHandler
  private _isReady: boolean = false
  private _messageQueue: EmbedMessage[] = []
  private _readyPromise: Promise<void>
  private _readyResolve?: () => void
  private _activeExecutions: Map<string, ExecutionHandle> = new Map()

  constructor(config: EmbedConfig & { runtime?: ZealReflowRuntime }) {
    super()
    
    // Store runtime if provided
    this._runtime = config.runtime
    
    // Try to get authToken from config or session storage
    const authToken = config.authToken || sessionStorage.getItem('ZEAL_AUTH_TOKEN') || ''
    
    // Set defaults
    this.config = {
      container: config.container,
      baseUrl: config.baseUrl || 'http://localhost:3000',
      workflowId: config.workflowId || '',
      authToken: authToken,
      height: config.height || '600px',
      width: config.width || '100%',
      display: {
        minimap: true,
        zoomControls: true,
        subgraphTabs: true,
        nodeCreation: true,
        theme: 'light',
        ...config.display,
      },
      permissions: config.permissions || {
        canAddNodes: true,
        canEditNodes: true,
        canDeleteNodes: true,
        canAddGroups: true,
        canEditGroups: true,
        canDeleteGroups: true,
        canExecute: true,
        canViewWorkflow: true,
        canExportData: true,
      },
      nodeLibraries: config.nodeLibraries || [],
      hideElements: config.hideElements || [],
      readonly: config.readonly || false,
      allowedOrigins: config.allowedOrigins || [],
      rateLimits: config.rateLimits || {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        executionsPerHour: 100,
        executionsPerDay: 1000,
      },
      events: config.events || {},
    }

    // Initialize browser-compatible ZIP client with authToken
    this._client = new ZIPClient({
      baseUrl: this.config.baseUrl,
      authToken: this.config.authToken,
    })

    // Setup ready promise
    this._readyPromise = new Promise(resolve => {
      this._readyResolve = resolve
    })

    // Initialize embed
    this.initialize()
  }

  private initialize(): void {
    // Get container element
    const container = typeof this.config.container === 'string'
      ? document.querySelector(this.config.container) as HTMLElement
      : this.config.container

    if (!container) {
      throw new Error('Container element not found')
    }

    // Create iframe
    this._iframe = document.createElement('iframe')
    this._iframe.style.width = this.config.width
    this._iframe.style.height = this.config.height
    this._iframe.style.border = 'none'
    this._iframe.allow = 'fullscreen'

    // Build embed URL
    const params = new URLSearchParams({
      minimap: String(this.config.display.minimap),
      zoom: String(this.config.display.zoomControls),
      tabs: String(this.config.display.subgraphTabs),
      nodeCreation: String(this.config.display.nodeCreation),
      theme: this.config.display.theme || 'light',
      readonly: String(this.config.readonly),
    })

    // Add node libraries
    if (this.config.nodeLibraries.length > 0) {
      params.append('libraries', this.config.nodeLibraries.join(','))
    }

    // Set iframe source
    const embedPath = this.config.workflowId 
      ? `/embed/${this.config.workflowId}`
      : '/embed/new'
    this._iframe.src = `${this.config.baseUrl}${embedPath}?${params}`

    // Setup message listener
    this.setupMessageListener()

    // Append to container
    container.appendChild(this._iframe)

    // Setup load handler
    this._iframe.addEventListener('load', () => {
      this.onIframeLoad()
    })
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      // Verify origin
      if (event.origin !== new URL(this.config.baseUrl).origin) {
        return
      }

      const message = event.data as EmbedMessage

      // Handle different message types
      // Handle embed control messages
      switch (message.type) {
        case 'ready':
          this.onEmbedReady()
          break
        case 'error':
          this.onEmbedError(new Error(message.error || 'Unknown error'))
          break
        case 'workflowSaved':
          this.config.events?.onWorkflowSaved?.(message.data)
          this.emit('workflowSaved', message.data)
          break
        default:
          // Emit generic event
          this.emit('message', message)
      }
    })
  }

  private onIframeLoad(): void {
    // Hide specified elements
    if (this.config.hideElements.length > 0) {
      this.postMessage({
        type: 'hideElements',
        data: this.config.hideElements,
        timestamp: Date.now(),
      })
    }

    // Send permissions
    this.postMessage({
      type: 'setPermissions',
      data: this.config.permissions,
      timestamp: Date.now(),
    })

    // Send queued messages
    this.flushMessageQueue()
  }

  private async onEmbedReady(): Promise<void> {
    this._isReady = true
    
    // Setup runtime if provided
    if (this._runtime) {
      await this.setupRuntimeIntegration()
    }
    
    // Setup WebSocket connection for real-time events
    if (this.config.workflowId) {
      await this.setupWebSocket()
    }
    
    this._readyResolve?.()
    this.config.events?.onReady?.()
    this.emit('ready')
    this.flushMessageQueue()
  }
  
  private async setupRuntimeIntegration(): Promise<void> {
    if (!this._runtime) return
    
    // Wait for runtime to be ready
    await this._runtime.waitForReady()
    
    // Setup runtime event forwarding
    this._runtime.on('ready', () => this.emit('runtime:ready'))
    this._runtime.on('error', (error) => this.emit('runtime:error', error))
    
    // Register default templates if runtime has them
    const templates = this._runtime.getTemplates()
    if (templates.length > 0) {
      await this.registerNodeTemplates(templates)
    }
  }

  private async setupWebSocket(): Promise<void> {
    this._websocket = new EmbedWebSocketHandler({
      url: this.config.baseUrl,
      workflowId: this.config.workflowId,
      authToken: this.config.authToken,
    })

    // Setup ZIP event handlers
    this._websocket.on('node.added', (event: NodeAddedEvent) => {
      this.config.events?.onNodeAdded?.(event)
      this.emit('nodeAdded', event)
    })

    this._websocket.on('node.updated', (event: NodeUpdatedEvent) => {
      this.config.events?.onNodeUpdated?.(event)
      this.emit('nodeUpdated', event)
    })

    this._websocket.on('node.deleted', (event: NodeDeletedEvent) => {
      this.config.events?.onNodeDeleted?.(event.nodeId)
      this.emit('nodeDeleted', event.nodeId)
    })

    this._websocket.on('connection.added', (event: ConnectionAddedEvent) => {
      this.config.events?.onConnectionCreated?.(event.data)
      this.emit('connectionCreated', event.data)
    })

    this._websocket.on('connection.deleted', (event: ConnectionDeletedEvent) => {
      this.config.events?.onConnectionDeleted?.(event.data)
      this.emit('connectionDeleted', event.data)
    })

    this._websocket.on('execution.started', (event: ExecutionStartedEvent) => {
      this.config.events?.onExecutionStarted?.(event.sessionId)
      this.emit('executionStarted', event.sessionId)
    })

    this._websocket.on('execution.completed', (event: ExecutionCompletedEvent) => {
      const result: WorkflowExecutionResult = {
        sessionId: event.sessionId,
        status: 'completed',
        duration: event.duration,
        executedNodes: event.nodesExecuted,
        outputs: event.summary,
      }
      this.config.events?.onExecutionCompleted?.(result)
      this.emit('executionCompleted', result)
    })

    this._websocket.on('execution.failed', (event: ExecutionFailedEvent) => {
      const result = {
        sessionId: event.sessionId,
        status: 'failed' as const,
        error: event.error,
        duration: event.duration || 0,
      }
      this.config.events?.onExecutionFailed?.(result)
      this.emit('executionFailed', result)
    })

    this._websocket.on('workflow.updated', (event: WorkflowUpdatedEvent) => {
      this.emit('workflowUpdated', event)
    })

    // Connect to WebSocket
    try {
      await this._websocket.connect()
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
      // Non-fatal - embed can still work without real-time updates
    }
  }

  private onEmbedError(error: Error): void {
    this.config.events?.onError?.(error)
    this.emit('error', error)
  }

  private flushMessageQueue(): void {
    while (this._messageQueue.length > 0) {
      const message = this._messageQueue.shift()
      if (message) {
        this.postMessage(message)
      }
    }
  }

  // Public API

  get iframe(): HTMLIFrameElement {
    if (!this._iframe) {
      throw new Error('Embed not initialized')
    }
    return this._iframe
  }

  get client(): ZIPClient {
    return this._client
  }
  
  get runtime(): ZealReflowRuntime | undefined {
    return this._runtime
  }

  postMessage(message: EmbedMessage): void {
    if (!this._isReady) {
      this._messageQueue.push(message)
      return
    }

    if (!this._iframe?.contentWindow) {
      throw new Error('Iframe not available')
    }

    this._iframe.contentWindow.postMessage(
      message,
      new URL(this.config.baseUrl).origin
    )
  }

  async execute(request?: WorkflowExecutionRequest): Promise<WorkflowExecutionResult> {
    await this.waitForReady()
    
    // If runtime is available and we have a workflow graph, use runtime execution
    if (this._runtime && request?.workflow) {
      return this.executeWithRuntime(request.workflow, request.inputs)
    }
    
    // Otherwise use iframe/API execution
    return new Promise((resolve, reject) => {
      // Setup one-time listeners
      const onCompleted = (result: any) => {
        this.off('executionCompleted', onCompleted)
        this.off('executionFailed', onFailed)
        resolve(result)
      }

      const onFailed = (error: any) => {
        this.off('executionCompleted', onCompleted)
        this.off('executionFailed', onFailed)
        reject(error)
      }

      this.once('executionCompleted', onCompleted)
      this.once('executionFailed', onFailed)

      // Send execution request
      this.postMessage({
        type: 'executeWorkflow',
        data: request || { workflowId: this.config.workflowId },
        timestamp: Date.now(),
      })
    })
  }
  
  private async executeWithRuntime(
    workflow: WorkflowGraph,
    inputs?: any
  ): Promise<WorkflowExecutionResult> {
    if (!this._runtime) {
      throw new Error('Runtime not available')
    }
    
    // Execute workflow using runtime
    const handle = await this._runtime.execute(workflow, inputs)
    
    // Store execution handle
    this._activeExecutions.set(handle.id, handle)
    
    // Setup event forwarding from runtime execution
    handle.on('start', (data) => {
      this.emit('executionStarted', handle.id)
      this.config.events?.onExecutionStarted?.(handle.id)
    })
    
    handle.on('progress', (data) => {
      this.emit('executionProgress', { sessionId: handle.id, ...data })
    })
    
    handle.on('actor:started', (data) => {
      this.emit('nodeExecuting', { sessionId: handle.id, nodeId: data.actorId })
    })
    
    handle.on('actor:completed', (data) => {
      this.emit('nodeCompleted', { sessionId: handle.id, nodeId: data.actorId, outputs: data.outputs })
    })
    
    handle.on('actor:failed', (data) => {
      this.emit('nodeFailed', { sessionId: handle.id, nodeId: data.actorId, error: data.error })
    })
    
    handle.on('complete', (result) => {
      const executionResult: WorkflowExecutionResult = {
        sessionId: handle.id,
        status: 'completed',
        duration: result.duration || 0,
        executedNodes: handle.getProgress().completedNodes,
        outputs: result.data
      }
      
      this._activeExecutions.delete(handle.id)
      this.emit('executionCompleted', executionResult)
      this.config.events?.onExecutionCompleted?.(executionResult)
    })
    
    handle.on('error', (error) => {
      const executionResult = {
        sessionId: handle.id,
        status: 'failed' as const,
        error: error.message,
        duration: 0
      }
      
      this._activeExecutions.delete(handle.id)
      this.emit('executionFailed', executionResult)
      this.config.events?.onExecutionFailed?.(executionResult)
    })
    
    // Wait for execution to complete
    try {
      const result = await handle.waitForCompletion()
      return {
        sessionId: handle.id,
        status: 'completed',
        duration: result.duration || 0,
        executedNodes: handle.getProgress().completedNodes,
        outputs: result.data
      }
    } catch (error) {
      throw {
        sessionId: handle.id,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      }
    }
  }

  async save(): Promise<void> {
    await this.waitForReady()

    return new Promise((resolve, reject) => {
      const onSaved = () => {
        this.off('workflowSaved', onSaved)
        this.off('error', onError)
        resolve()
      }

      const onError = (error: Error) => {
        this.off('workflowSaved', onSaved)
        this.off('error', onError)
        reject(error)
      }

      this.once('workflowSaved', onSaved)
      this.once('error', onError)

      this.postMessage({
        type: 'saveWorkflow',
        timestamp: Date.now(),
      })
    })
  }

  async load(workflowId: string): Promise<void> {
    await this.waitForReady()

    this.postMessage({
      type: 'loadWorkflow',
      data: { workflowId },
      timestamp: Date.now(),
    })
  }

  async getWorkflow(): Promise<any> {
    await this.waitForReady()

    return new Promise((resolve) => {
      const onWorkflowData = (event: MessageEvent) => {
        if (event.data.type === 'workflowData') {
          window.removeEventListener('message', onWorkflowData)
          resolve(event.data.data)
        }
      }

      window.addEventListener('message', onWorkflowData)

      this.postMessage({
        type: 'getWorkflow',
        timestamp: Date.now(),
      })
    })
  }

  async setWorkflow(workflow: any): Promise<void> {
    await this.waitForReady()

    this.postMessage({
      type: 'setWorkflow',
      data: workflow,
      timestamp: Date.now(),
    })
  }

  async addNodeTemplate(template: NodeTemplate): Promise<void> {
    await this.waitForReady()

    // Register with ZIP SDK
    await this._client.templates.register({
      namespace: 'custom',
      templates: [template]
    })

    // Send to embed
    this.postMessage({
      type: 'addNodeTemplate',
      data: template,
      timestamp: Date.now(),
    })
  }

  async registerNodeTemplates(templates: NodeTemplate[]): Promise<void> {
    await this.waitForReady()

    // Register with ZIP SDK
    await this._client.templates.register({
      namespace: 'custom',
      templates: templates
    })
    
    // Register with runtime if available
    if (this._runtime) {
      for (const template of templates) {
        // Runtime registration is handled through bindTemplate
        // This ensures templates are available for execution
        this._runtime.getTemplates() // Just ensure runtime knows about them
      }
    }

    // Send to embed
    this.postMessage({
      type: 'registerNodeTemplates',
      data: templates,
      timestamp: Date.now(),
    })
  }
  
  /**
   * Bind an actor implementation to a template for runtime execution
   * This is only available when a runtime is provided
   */
  async bindActor(
    templateId: string,
    handler: (inputs: any, context: any) => any
  ): Promise<void> {
    if (!this._runtime) {
      throw new Error('Runtime not available. Provide a runtime to the constructor to use actor binding.')
    }
    
    await this.waitForReady()
    
    // Verify template exists
    const templates = this._runtime.getTemplates()
    const hasTemplate = templates.some(t => t.id === templateId)
    if (!hasTemplate) {
      throw new Error(`Template ${templateId} not found. Register it first with registerNodeTemplates()`)
    }
    
    // Bind actor to template in runtime
    await this._runtime.bindTemplate(templateId)
      .handler(handler)
      .register()
    
    this.emit('actorBound', { templateId })
  }
  
  /**
   * Register a streaming actor for template
   */
  async bindStreamingActor(
    templateId: string,
    handler: (inputs: any, context: any) => AsyncGenerator<any>
  ): Promise<void> {
    if (!this._runtime) {
      throw new Error('Runtime not available. Provide a runtime to the constructor to use actor binding.')
    }
    
    await this.waitForReady()
    
    // Verify template exists
    const templates = this._runtime.getTemplates()
    const hasTemplate = templates.some(t => t.id === templateId)
    if (!hasTemplate) {
      throw new Error(`Template ${templateId} not found. Register it first with registerNodeTemplates()`)
    }
    
    // Bind streaming actor
    await this._runtime.bindTemplate(templateId)
      .handler(handler)
      .streaming()
      .register()
    
    this.emit('actorBound', { templateId, streaming: true })
  }
  
  /**
   * Get active execution handle by ID
   */
  getExecution(sessionId: string): ExecutionHandle | undefined {
    return this._activeExecutions.get(sessionId)
  }
  
  /**
   * Cancel an active execution
   */
  async cancelExecution(sessionId: string): Promise<void> {
    const handle = this._activeExecutions.get(sessionId)
    if (handle) {
      await handle.cancel()
      this._activeExecutions.delete(sessionId)
    }
  }

  updateDisplay(options: EmbedConfig['display']): void {
    this.postMessage({
      type: 'updateDisplay',
      data: options,
      timestamp: Date.now(),
    })
  }

  destroy(): void {
    // Cancel active runtime executions
    for (const handle of this._activeExecutions.values()) {
      handle.cancel().catch(() => {})
    }
    this._activeExecutions.clear()
    
    // Cleanup runtime listeners
    if (this._runtime) {
      this._runtime.removeAllListeners()
    }
    
    // Disconnect WebSocket
    if (this._websocket) {
      this._websocket.disconnect()
      this._websocket = undefined
    }

    // Remove iframe
    if (this._iframe) {
      this._iframe.remove()
      this._iframe = null
    }

    // Clear listeners
    this.removeAllListeners()

    // Clear message queue
    this._messageQueue = []

    this._isReady = false
  }

  isReady(): boolean {
    return this._isReady
  }

  async waitForReady(): Promise<void> {
    return this._readyPromise
  }

  // Static factory method
  static async create(config: EmbedConfig): Promise<ZealEmbed> {
    const embed = new ZealEmbed(config)
    await embed.waitForReady()
    return embed
  }
}