/**
 * Templates API for ZIP SDK
 */

import { ZealClient } from './client'
import {
  NodeTemplate,
  RegisterTemplatesRequest,
  RegisterTemplatesResponse,
  ListCategoriesResponse,
  RegisterCategoriesRequest,
  RegisterCategoriesResponse,
  UploadBundleResponse,
  ZealClientConfig,
} from './types'

export class TemplatesAPI {
  constructor(private baseUrl: string, private config?: ZealClientConfig) {}
  
  /**
   * List available node template categories.
   */
  async listCategories(): Promise<ListCategoriesResponse> {
    return ZealClient.request(`${this.baseUrl}/api/zip/categories`, {}, this.config)
  }

  /**
   * Register new categories and subcategories.
   * Upserts by name — existing categories get new subcategories merged.
   */
  async registerCategories(request: RegisterCategoriesRequest): Promise<RegisterCategoriesResponse> {
    return ZealClient.request(`${this.baseUrl}/api/zip/categories`, {
      method: 'POST',
      body: JSON.stringify(request),
    }, this.config)
  }

  /**
   * Upload a Web Component bundle for custom node rendering.
   * Returns bundleId to reference in template.display.bundleId.
   */
  async uploadBundle(namespace: string, source: string): Promise<UploadBundleResponse> {
    return ZealClient.request(`${this.baseUrl}/api/zip/components`, {
      method: 'POST',
      body: JSON.stringify({ namespace, source }),
    }, this.config)
  }

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