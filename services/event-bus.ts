import { EventEmitter } from 'events'
import { getZipWebhookOperations } from '@/lib/database-zip-operations'
import type { ZipWebhook } from '@/lib/database-zip-operations'
import { 
  createNodeExecutingEvent,
  createNodeCompletedEvent,
  createNodeFailedEvent,
  createExecutionStartedEvent,
  createExecutionCompletedEvent,
  createExecutionFailedEvent,
  ZipWebhookEvent
} from '@/types/zip-events'

export type EventSource = 
  | 'crdt'
  | 'workflow' 
  | 'trace'
  | 'template'
  | 'execution'
  | 'orchestrator'
  | 'system'

export type EventType = 
  | 'workflow.created'
  | 'workflow.updated'
  | 'workflow.deleted'
  | 'workflow.published'
  | 'workflow.executed'
  | 'node.added'
  | 'node.updated'
  | 'node.deleted'
  | 'node.executed'
  | 'connection.added'
  | 'connection.deleted'
  | 'group.created'
  | 'group.updated'
  | 'group.deleted'
  | 'template.registered'
  | 'template.updated'
  | 'template.deleted'
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'trace.event'
  | 'error.occurred'
  | 'system.health'

// For backward compatibility, we keep the WebhookEvent interface
// but it now extends from the typed ZIP events
export type WebhookEvent = ZipWebhookEvent & {
  source?: EventSource // Optional for backward compatibility
}

export interface WebhookDeliveryResult {
  webhookId: string
  success: boolean
  statusCode?: number
  error?: string
  retryCount: number
  timestamp: string
}

interface EventBatch {
  events: WebhookEvent[]
  timer: NodeJS.Timeout | null
}

class WebhookEventBus extends EventEmitter {
  private static instance: WebhookEventBus | null = null
  private eventBatches: Map<string, EventBatch> = new Map()
  private readonly batchInterval = 100 // ms
  private readonly maxBatchSize = 50
  private readonly maxRetries = 3
  private readonly retryDelay = 1000 // ms
  
  private constructor() {
    super()
    this.setMaxListeners(100) // Allow many webhook listeners
  }
  
  static getInstance(): WebhookEventBus {
    if (!WebhookEventBus.instance) {
      WebhookEventBus.instance = new WebhookEventBus()
    }
    return WebhookEventBus.instance
  }
  
  /**
   * Emit an event that should be sent to webhooks
   */
  async emitWebhookEvent(event: Omit<WebhookEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: WebhookEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...event
    }
    
    // Emit locally for any internal listeners
    this.emit('webhook:event', fullEvent)
    
    // Queue for webhook delivery
    await this.queueEventForWebhooks(fullEvent)
  }
  
  /**
   * Queue event for batch delivery to webhooks
   */
  private async queueEventForWebhooks(event: WebhookEvent): Promise<void> {
    const namespace = event.metadata?.namespace || 'default'
    
    if (!this.eventBatches.has(namespace)) {
      this.eventBatches.set(namespace, {
        events: [],
        timer: null
      })
    }
    
    const batch = this.eventBatches.get(namespace)!
    batch.events.push(event)
    
    // Send immediately if batch is full
    if (batch.events.length >= this.maxBatchSize) {
      if (batch.timer) {
        clearTimeout(batch.timer)
        batch.timer = null
      }
      await this.flushBatch(namespace)
    } else if (!batch.timer) {
      // Schedule batch send
      batch.timer = setTimeout(async () => {
        await this.flushBatch(namespace)
      }, this.batchInterval)
    }
  }
  
  /**
   * Flush a batch of events to webhooks
   */
  private async flushBatch(namespace: string): Promise<void> {
    const batch = this.eventBatches.get(namespace)
    if (!batch || batch.events.length === 0) return
    
    const events = [...batch.events]
    batch.events = []
    if (batch.timer) {
      clearTimeout(batch.timer)
      batch.timer = null
    }
    
    try {
      // Get active webhooks for this namespace
      const webhookOps = await getZipWebhookOperations()
      const webhooks = await webhookOps.getWebhooksByNamespace(namespace)
      
      // Filter active webhooks that match the event types
      const activeWebhooks = webhooks.filter((w: ZipWebhook) => 
        w.isActive && this.shouldSendToWebhook(events, w)
      )
      
      // Send to each webhook
      await Promise.allSettled(
        activeWebhooks.map((webhook: ZipWebhook) => this.sendToWebhook(webhook, events))
      )
    } catch (error) {
      console.error('Error flushing webhook batch:', error)
    }
  }
  
  /**
   * Check if events should be sent to a specific webhook
   */
  private shouldSendToWebhook(events: WebhookEvent[], webhook: ZipWebhook): boolean {
    // If webhook listens to all events
    if (webhook.events.includes('*')) return true
    
    // Check if any event matches webhook's subscribed events
    return events.some(event => {
      const eventPattern = `${event.source}.${event.type}`
      return webhook.events.some(pattern => {
        if (pattern === eventPattern) return true
        if (pattern.endsWith('.*') && eventPattern.startsWith(pattern.slice(0, -2))) return true
        return false
      })
    })
  }
  
  /**
   * Send events to a webhook with retry logic
   */
  private async sendToWebhook(
    webhook: ZipWebhook, 
    events: WebhookEvent[],
    retryCount = 0
  ): Promise<WebhookDeliveryResult> {
    const deliveryResult: WebhookDeliveryResult = {
      webhookId: webhook.id,
      success: false,
      retryCount,
      timestamp: new Date().toISOString()
    }
    
    try {
      const payload = {
        webhook_id: webhook.id,
        events,
        metadata: {
          namespace: webhook.namespace,
          delivery_id: `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString()
        }
      }
      
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zeal-Webhook-Id': webhook.id,
          'X-Zeal-Delivery-Id': payload.metadata.delivery_id,
          'X-Zeal-Event-Count': events.length.toString(),
          ...webhook.headers
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      deliveryResult.statusCode = response.status
      deliveryResult.success = response.ok
      
      if (!response.ok && retryCount < this.maxRetries) {
        // Retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, retryCount)))
        return this.sendToWebhook(webhook, events, retryCount + 1)
      }
      
      if (!response.ok) {
        deliveryResult.error = `HTTP ${response.status}: ${response.statusText}`
      }
    } catch (error) {
      deliveryResult.error = error instanceof Error ? error.message : 'Unknown error'
      
      if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, retryCount)))
        return this.sendToWebhook(webhook, events, retryCount + 1)
      }
    }
    
    // Log delivery result
    this.emit('webhook:delivery', deliveryResult)
    
    return deliveryResult
  }
  
  /**
   * Flush all pending batches
   */
  async flushAll(): Promise<void> {
    const namespaces = Array.from(this.eventBatches.keys())
    await Promise.allSettled(
      namespaces.map(ns => this.flushBatch(ns))
    )
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all timers
    for (const batch of this.eventBatches.values()) {
      if (batch.timer) {
        clearTimeout(batch.timer)
      }
    }
    this.eventBatches.clear()
    this.removeAllListeners()
  }
}

// Export singleton instance
export const eventBus = WebhookEventBus.getInstance()

// Helper functions for common event emissions
export const webhookEvents = {
  // Workflow events
  workflowCreated(workflowId: string, data: any, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'workflow',
      type: 'workflow.created',
      workflowId,
      data,
      metadata
    })
  },
  
  workflowUpdated(workflowId: string, data: any, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'workflow',
      type: 'workflow.updated',
      workflowId,
      data,
      metadata
    })
  },
  
  workflowDeleted(workflowId: string, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'workflow',
      type: 'workflow.deleted',
      workflowId,
      data: { workflowId },
      metadata
    })
  },
  
  // Node events
  nodeAdded(workflowId: string, graphId: string, nodeId: string, data: any, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'crdt',
      type: 'node.added',
      workflowId,
      graphId,
      nodeId,
      data,
      metadata
    })
  },
  
  nodeUpdated(workflowId: string, graphId: string, nodeId: string, data: any, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'crdt',
      type: 'node.updated',
      workflowId,
      graphId,
      nodeId,
      data,
      metadata
    })
  },
  
  nodeDeleted(workflowId: string, graphId: string, nodeId: string, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'crdt',
      type: 'node.deleted',
      workflowId,
      graphId,
      nodeId,
      data: { nodeId },
      metadata
    })
  },
  
  // Connection events
  connectionAdded(workflowId: string, graphId: string, data: any, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'crdt',
      type: 'connection.added',
      workflowId,
      graphId,
      data,
      metadata
    })
  },
  
  connectionDeleted(workflowId: string, graphId: string, data: any, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'crdt',
      type: 'connection.deleted',
      workflowId,
      graphId,
      data,
      metadata
    })
  },
  
  // Execution events
  executionStarted(workflowId: string, sessionId: string, data: any, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'execution',
      type: 'execution.started',
      workflowId,
      sessionId,
      data,
      metadata
    })
  },
  
  executionCompleted(workflowId: string, sessionId: string, data: any, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'execution',
      type: 'execution.completed',
      workflowId,
      sessionId,
      data,
      metadata
    })
  },
  
  executionFailed(workflowId: string, sessionId: string, error: any, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'execution',
      type: 'execution.failed',
      workflowId,
      sessionId,
      data: { error },
      metadata
    })
  },
  
  // Trace events
  traceEvent(sessionId: string, nodeId: string, data: any, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'trace',
      type: 'trace.event',
      sessionId,
      nodeId,
      data,
      metadata
    })
  },
  
  // Template events
  templateRegistered(templateId: string, data: any, metadata?: any) {
    return eventBus.emitWebhookEvent({
      source: 'template',
      type: 'template.registered',
      data: { templateId, ...data },
      metadata
    })
  }
}

// Ensure batches are flushed on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await eventBus.flushAll()
  })
  
  process.on('SIGINT', async () => {
    await eventBus.flushAll()
    process.exit(0)
  })
  
  process.on('SIGTERM', async () => {
    await eventBus.flushAll()
    process.exit(0)
  })
}