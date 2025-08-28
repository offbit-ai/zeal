/**
 * Templates API for ZIP SDK
 */

import { ZealClient } from './client'
import {
  NodeTemplate,
  RegisterTemplatesRequest,
  RegisterTemplatesResponse,
} from './types'

export class TemplatesAPI {
  constructor(private baseUrl: string) {}
  
  /**
   * Register templates
   */
  async register(request: RegisterTemplatesRequest): Promise<RegisterTemplatesResponse> {
    return ZealClient.request(`${this.baseUrl}/api/zip/templates/register`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }
  
  /**
   * List templates in a namespace
   */
  async list(namespace: string): Promise<{
    namespace: string
    templates: NodeTemplate[]
    count: number
  }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/templates/${namespace}`)
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
      }
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
      }
    )
  }
}