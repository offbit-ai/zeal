/**
 * Webhooks API for ZIP SDK
 */

import { ZealClient } from './client'
import { WebhookConfig } from './types'

export class WebhooksAPI {
  constructor(private baseUrl: string) {}
  
  /**
   * Register a webhook
   */
  async register(config: WebhookConfig): Promise<{
    success: boolean
    webhookId: string
    namespace: string
    url: string
    events: string[]
  }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/webhooks`, {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }
  
  /**
   * List webhooks
   */
  async list(namespace?: string): Promise<{
    webhooks: Array<{
      id: string
      namespace: string
      url: string
      events: string[]
      isActive: boolean
      registeredAt: string
    }>
    count: number
  }> {
    const params = namespace ? `?namespace=${namespace}` : ''
    return ZealClient.request(`${this.baseUrl}/api/zip/webhooks${params}`)
  }
  
  /**
   * Update webhook
   */
  async update(
    webhookId: string,
    updates: {
      url?: string
      events?: string[]
      headers?: Record<string, string>
      isActive?: boolean
    }
  ): Promise<{ success: boolean; webhookId: string }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }
  
  /**
   * Delete webhook
   */
  async delete(webhookId: string): Promise<{ success: boolean; message: string }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/webhooks/${webhookId}`, {
      method: 'DELETE',
    })
  }
  
  /**
   * Test webhook
   */
  async test(webhookId: string): Promise<{
    success: boolean
    statusCode?: number
    message?: string
    error?: string
  }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/webhooks/${webhookId}/test`, {
      method: 'POST',
    })
  }
}