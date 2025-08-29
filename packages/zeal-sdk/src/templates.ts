/**
 * Templates API for ZIP SDK
 */

import { ZealClient } from './client'
import {
  NodeTemplate,
  RegisterTemplatesRequest,
  RegisterTemplatesResponse,
  ZealClientConfig,
} from './types'

export class TemplatesAPI {
  constructor(private baseUrl: string, private config?: ZealClientConfig) {}
  
  /**
   * Register templates
   */
  async register(request: RegisterTemplatesRequest): Promise<RegisterTemplatesResponse> {
    return ZealClient.request(`${this.baseUrl}/api/zip/templates/register`, {
      method: 'POST',
      body: JSON.stringify(request),
    }, this.config)
  }
  
  /**
   * List templates in a namespace
   */
  async list(namespace: string): Promise<{
    namespace: string
    templates: NodeTemplate[]
    count: number
  }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/templates/${namespace}`, {}, this.config)
  }
  
  /**
   * Update a template
   */
  async update(
    namespace: string,
    templateId: string,
    updates: Partial<NodeTemplate>
  ): Promise<{ success: boolean; template: any }> {
    return ZealClient.request(
      `${this.baseUrl}/api/zip/templates/${namespace}/${templateId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      },
      this.config
    )
  }
  
  /**
   * Delete a template
   */
  async delete(
    namespace: string,
    templateId: string
  ): Promise<{ success: boolean; message: string }> {
    return ZealClient.request(
      `${this.baseUrl}/api/zip/templates/${namespace}/${templateId}`,
      {
        method: 'DELETE',
      },
      this.config
    )
  }
}