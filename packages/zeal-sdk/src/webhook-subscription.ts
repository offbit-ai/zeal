/**
 * Webhook subscription functionality for ZIP SDK
 * Provides both callback and observable patterns for receiving webhook events
 */

import { EventEmitter } from 'events'
import * as http from 'http'
import * as https from 'https'
import { WebhooksAPI } from './webhooks'

// Import the typed events from the main types
// In a real SDK package, these would be bundled with the SDK
import type { ZipWebhookEvent } from '../../../types/zip-events'

// Re-export as WebhookEvent for SDK users
export type WebhookEvent = ZipWebhookEvent

export interface WebhookDelivery {
  webhook_id: string
  events: WebhookEvent[]
  metadata: {
    namespace: string
    delivery_id: string
    timestamp: string
  }
}

export type WebhookEventCallback = (event: WebhookEvent) => void | Promise<void>
export type WebhookDeliveryCallback = (delivery: WebhookDelivery) => void | Promise<void>
export type WebhookErrorCallback = (error: Error) => void

export interface WebhookSubscriptionOptions {
  /**
   * Port to listen on for incoming webhooks
   */
  port?: number
  
  /**
   * Host to bind to (default: '0.0.0.0')
   */
  host?: string
  
  /**
   * Path to listen on (default: '/webhooks')
   */
  path?: string
  
  /**
   * Whether to use HTTPS
   */
  https?: boolean
  
  /**
   * SSL key for HTTPS
   */
  key?: string
  
  /**
   * SSL certificate for HTTPS
   */
  cert?: string
  
  /**
   * Whether to automatically register the webhook with Zeal
   */
  autoRegister?: boolean
  
  /**
   * Namespace for the webhook
   */
  namespace?: string
  
  /**
   * Events to subscribe to (default: ['*'])
   */
  events?: string[]
  
  /**
   * Custom headers to send with webhook registration
   */
  headers?: Record<string, string>
  
  /**
   * Whether to verify webhook signatures
   */
  verifySignature?: boolean
  
  /**
   * Secret key for signature verification
   */
  secretKey?: string
}

/**
 * Observable implementation for webhook events
 */
export class WebhookObservable {
  private emitter = new EventEmitter()
  
  /**
   * Subscribe to webhook events
   */
  subscribe(
    next: WebhookEventCallback,
    error?: WebhookErrorCallback,
    complete?: () => void
  ): { unsubscribe: () => void } {
    const listener = (event: WebhookEvent) => {
      try {
        const result = next(event)
        if (result instanceof Promise) {
          result.catch(err => error?.(err))
        }
      } catch (err) {
        error?.(err as Error)
      }
    }
    
    this.emitter.on('event', listener)
    if (error) this.emitter.on('error', error)
    if (complete) this.emitter.on('complete', complete)
    
    return {
      unsubscribe: () => {
        this.emitter.removeListener('event', listener)
        if (error) this.emitter.removeListener('error', error)
        if (complete) this.emitter.removeListener('complete', complete)
      }
    }
  }
  
  /**
   * Emit an event to all subscribers
   */
  emit(event: WebhookEvent): void {
    this.emitter.emit('event', event)
  }
  
  /**
   * Emit an error to all subscribers
   */
  error(err: Error): void {
    this.emitter.emit('error', err)
  }
  
  /**
   * Complete the observable
   */
  complete(): void {
    this.emitter.emit('complete')
    this.emitter.removeAllListeners()
  }
  
  /**
   * Pipe events to another observable
   */
  pipe<T>(
    ...operators: Array<(source: WebhookObservable) => T>
  ): T {
    return operators.reduce((acc, op) => op(acc as any), this as any)
  }
  
  /**
   * Filter events based on a predicate
   */
  filter(predicate: (event: WebhookEvent) => boolean): WebhookObservable {
    const filtered = new WebhookObservable()
    
    const handleEvent: WebhookEventCallback = (event: WebhookEvent) => {
      if (predicate(event)) {
        filtered.emit(event)
      }
    }
    
    this.subscribe(
      handleEvent,
      (err: Error) => filtered.error(err),
      () => filtered.complete()
    )
    
    return filtered
  }
  
  /**
   * Map events to a new format
   */
  map<T>(mapper: (event: WebhookEvent) => T): any {
    const mapped = new EventEmitter()
    
    const handleEvent: WebhookEventCallback = (event: WebhookEvent) => {
      mapped.emit('event', mapper(event))
    }
    
    this.subscribe(
      handleEvent,
      (err: Error) => mapped.emit('error', err),
      () => mapped.emit('complete')
    )
    
    return {
      subscribe: (next: (value: T) => void, error?: WebhookErrorCallback, complete?: () => void) => {
        mapped.on('event', next)
        if (error) mapped.on('error', error)
        if (complete) mapped.on('complete', complete)
        
        return {
          unsubscribe: () => {
            mapped.removeListener('event', next)
            if (error) mapped.removeListener('error', error)
            if (complete) mapped.removeListener('complete', complete)
          }
        }
      }
    }
  }
}

/**
 * Webhook subscription manager
 */
export class WebhookSubscription {
  private server?: http.Server | https.Server
  private observable = new WebhookObservable()
  private callbacks = new Set<WebhookEventCallback>()
  private deliveryCallbacks = new Set<WebhookDeliveryCallback>()
  private webhookId?: string
  private isRunning = false
  
  constructor(
    private webhooksAPI: WebhooksAPI,
    private options: WebhookSubscriptionOptions = {}
  ) {
    this.options = {
      port: 3001,
      host: '0.0.0.0',
      path: '/webhooks',
      autoRegister: true,
      events: ['*'],
      ...options
    }
  }
  
  /**
   * Subscribe with a callback function
   */
  onEvent(callback: WebhookEventCallback): () => void {
    this.callbacks.add(callback)
    
    return () => {
      this.callbacks.delete(callback)
    }
  }
  
  /**
   * Subscribe to full webhook deliveries (multiple events at once)
   */
  onDelivery(callback: WebhookDeliveryCallback): () => void {
    this.deliveryCallbacks.add(callback)
    
    return () => {
      this.deliveryCallbacks.delete(callback)
    }
  }
  
  /**
   * Get an observable for webhook events
   */
  asObservable(): WebhookObservable {
    return this.observable
  }
  
  /**
   * Start the webhook server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Webhook subscription is already running')
    }
    
    // Create the HTTP(S) server
    const requestHandler = this.createRequestHandler()
    
    if (this.options.https && this.options.key && this.options.cert) {
      this.server = https.createServer({
        key: this.options.key,
        cert: this.options.cert
      }, requestHandler)
    } else {
      this.server = http.createServer(requestHandler)
    }
    
    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.options.port, this.options.host, () => {
        console.log(`Webhook server listening on ${this.options.host}:${this.options.port}${this.options.path}`)
        resolve()
      })
      
      this.server!.on('error', reject)
    })
    
    this.isRunning = true
    
    // Auto-register webhook if enabled
    if (this.options.autoRegister) {
      await this.register()
    }
  }
  
  /**
   * Stop the webhook server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }
    
    // Unregister webhook if it was registered
    if (this.webhookId) {
      try {
        await this.webhooksAPI.delete(this.webhookId)
        console.log(`Unregistered webhook ${this.webhookId}`)
      } catch (err) {
        console.error('Failed to unregister webhook:', err)
      }
    }
    
    // Stop the server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          console.log('Webhook server stopped')
          resolve()
        })
      })
    }
    
    this.isRunning = false
    this.observable.complete()
  }
  
  /**
   * Register the webhook with Zeal
   */
  async register(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Webhook server must be running before registration')
    }
    
    // Determine the public URL for the webhook
    const protocol = this.options.https ? 'https' : 'http'
    const host = this.options.host === '0.0.0.0' ? 'localhost' : this.options.host
    const url = `${protocol}://${host}:${this.options.port}${this.options.path}`
    
    // Register with Zeal
    const result = await this.webhooksAPI.register({
      namespace: this.options.namespace || 'default',
      url,
      events: this.options.events || ['*'],
      headers: this.options.headers || {}
    })
    
    this.webhookId = result.webhookId
    console.log(`Registered webhook ${this.webhookId} at ${url}`)
  }
  
  /**
   * Create the HTTP request handler
   */
  private createRequestHandler(): http.RequestListener {
    return async (req, res) => {
      // Only handle POST requests to the webhook path
      if (req.method !== 'POST' || req.url !== this.options.path) {
        res.statusCode = 404
        res.end('Not found')
        return
      }
      
      try {
        // Parse the request body
        const body = await this.parseRequestBody(req)
        const delivery = JSON.parse(body) as WebhookDelivery
        
        // Verify signature if enabled
        if (this.options.verifySignature && this.options.secretKey) {
          const signature = req.headers['x-zeal-signature'] as string
          if (!this.verifySignature(body, signature)) {
            res.statusCode = 401
            res.end('Invalid signature')
            return
          }
        }
        
        // Process the delivery
        await this.processDelivery(delivery)
        
        // Send success response
        res.statusCode = 200
        res.end('OK')
      } catch (err) {
        console.error('Error processing webhook:', err)
        res.statusCode = 500
        res.end('Internal server error')
        
        // Emit error to observable
        this.observable.error(err as Error)
      }
    }
  }
  
  /**
   * Parse request body
   */
  private parseRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = ''
      
      req.on('data', chunk => {
        body += chunk.toString()
      })
      
      req.on('end', () => {
        resolve(body)
      })
      
      req.on('error', reject)
    })
  }
  
  /**
   * Process a webhook delivery
   */
  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    // Call delivery callbacks
    const deliveryCallbacks = Array.from(this.deliveryCallbacks)
    for (const callback of deliveryCallbacks) {
      try {
        await callback(delivery)
      } catch (err) {
        console.error('Error in delivery callback:', err)
      }
    }
    
    // Process individual events
    for (const event of delivery.events) {
      // Call event callbacks
      const eventCallbacks = Array.from(this.callbacks)
      for (const callback of eventCallbacks) {
        try {
          await callback(event)
        } catch (err) {
          console.error('Error in event callback:', err)
        }
      }
      
      // Emit to observable
      this.observable.emit(event)
    }
  }
  
  /**
   * Verify webhook signature
   */
  private verifySignature(_body: string, _signature: string): boolean {
    if (!this.options.secretKey) {
      return false
    }
    
    // TODO: Implement HMAC signature verification using _body and _signature
    // For now, we'll accept all signatures
    return true
  }
  
  /**
   * Convenience method to create a filtered subscription
   */
  filterEvents(predicate: (event: WebhookEvent) => boolean): WebhookObservable {
    return this.observable.filter(predicate)
  }
  
  /**
   * Subscribe to specific event types
   */
  onEventType(
    eventType: string | string[],
    callback: WebhookEventCallback
  ): () => void {
    const types = Array.isArray(eventType) ? eventType : [eventType]
    
    const filteredCallback: WebhookEventCallback = (event) => {
      if (types.includes(event.type)) {
        callback(event)
      }
    }
    
    return this.onEvent(filteredCallback)
  }
  
  /**
   * Subscribe to events from a specific source
   */
  onEventSource(
    source: string | string[],
    callback: WebhookEventCallback
  ): () => void {
    const sources = Array.isArray(source) ? source : [source]
    
    const filteredCallback: WebhookEventCallback = (event) => {
      if (sources.includes(event.source)) {
        callback(event)
      }
    }
    
    return this.onEvent(filteredCallback)
  }
}