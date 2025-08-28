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
  
  constructor(config: ZealClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    
    // Initialize API modules
    this.templates = new TemplatesAPI(this.baseUrl)
    this.orchestrator = new OrchestratorAPI(this.baseUrl)
    this.traces = new TracesAPI(this.baseUrl)
    this.events = new EventsAPI(this.baseUrl, config.websocketPath)
    this.webhooks = new WebhooksAPI(this.baseUrl)
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
    return response.json()
  }
  
  /**
   * Helper method for making authenticated requests
   */
  static async request(
    url: string,
    options: RequestInit = {}
  ): Promise<any> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: { message: response.statusText }
      }))
      throw new Error(error.error?.message || response.statusText)
    }
    
    return response.json()
  }
}