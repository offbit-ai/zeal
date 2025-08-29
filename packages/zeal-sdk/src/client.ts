/**
 * Main ZealClient class for ZIP SDK
 */

import { TemplatesAPI } from './templates'
import { OrchestratorAPI } from './orchestrator'
import { TracesAPI } from './traces'
import { EventsAPI } from './events'
import { WebhooksAPI } from './webhooks'
import { WebhookSubscription, WebhookSubscriptionOptions } from './webhook-subscription'
import { ZealClientConfig } from './types'

export class ZealClient {
  public templates: TemplatesAPI
  public orchestrator: OrchestratorAPI
  public traces: TracesAPI
  public events: EventsAPI
  public webhooks: WebhooksAPI
  
  private baseUrl: string
  private config: ZealClientConfig
  private static readonly SDK_VERSION = '1.0.0'
  private static readonly APPLICATION_ID = 'zeal-js-sdk'
  
  constructor(config: ZealClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.config = config
    
    // Initialize API modules with auth config
    this.templates = new TemplatesAPI(this.baseUrl, config)
    this.orchestrator = new OrchestratorAPI(this.baseUrl, config)
    this.traces = new TracesAPI(this.baseUrl, config)
    this.events = new EventsAPI(this.baseUrl, config.websocketPath, config)
    this.webhooks = new WebhooksAPI(this.baseUrl, config)
  }
  
  /**
   * Create a webhook subscription for receiving events
   */
  createSubscription(options?: WebhookSubscriptionOptions): WebhookSubscription {
    return new WebhookSubscription(this.webhooks, options)
  }
  
  /**
   * Health check
   */
  async health(): Promise<{
    status: 'healthy' | 'unhealthy'
    version: string
    services: Record<string, 'healthy' | 'unhealthy'>
  }> {
    const response = await fetch(`${this.baseUrl}/api/zip/health`)
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`)
    }
    return response.json() as any
  }
  
  /**
   * Helper method for making authenticated requests
   */
  static async request(
    url: string,
    options: RequestInit = {},
    config?: ZealClientConfig
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Add auth token if provided
    if (config?.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
      body: options.body
    })
    
    if (!response.ok) {
      const error: any = await response.json().catch(() => ({
        error: { message: response.statusText }
      }))
      throw new Error(error.error?.message || response.statusText)
    }
    
    return response.json()
  }
}