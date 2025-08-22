/**
 * Embedding service for semantic search
 * Generates vector embeddings for templates using various AI vendor models
 */

import { NodeTemplate, TemplateEmbeddings } from '../core/models'
import {
  EmbeddingVendor,
  EmbeddingVendorConfig,
  createEmbeddingVendor,
  EmbeddingConfigBuilder,
} from './embedding-providers'

export interface EmbeddingConfig {
  vendor: 'openai' | 'azure-openai' | 'google' | 'mock'
  model?: string
  dimensions: number
  apiKey?: string
  batchSize: number
  // Vendor-specific options
  endpoint?: string
  apiVersion?: string
  region?: string
  projectId?: string
  rateLimitDelay?: number
}

export class EmbeddingService {
  private dimensions: number
  private vendor: EmbeddingVendor

  constructor(private config: EmbeddingConfig) {
    this.dimensions = config.dimensions || 1536
    this.vendor = this.createVendor(config)
  }

  private createVendor(config: EmbeddingConfig): EmbeddingVendor {
    const vendorConfig: EmbeddingVendorConfig = {
      vendor: config.vendor,
      model: config.model || this.getDefaultModel(config.vendor),
      apiKey: config.apiKey || '',
      dimensions: config.dimensions,
      endpoint: config.endpoint,
      apiVersion: config.apiVersion,
      region: config.region,
      projectId: config.projectId,
      batchSize: config.batchSize || 100,
      rateLimitDelay: config.rateLimitDelay || 100,
    }

    return createEmbeddingVendor(vendorConfig)
  }

  private getDefaultModel(vendor: string): string {
    switch (vendor) {
      case 'openai':
        return 'text-embedding-3-small'
      case 'azure-openai':
        return 'text-embedding-ada-002'
      case 'google':
        return 'textembedding-gecko@latest'
      case 'mock':
        return 'mock-model'
      default:
        return 'text-embedding-3-small'
    }
  }

  async generateEmbeddings(template: NodeTemplate): Promise<TemplateEmbeddings> {
    try {
      // Generate text representations
      const titleText = this.generateTitleText(template)
      const descriptionText = this.generateDescriptionText(template)
      const combinedText = this.generateCombinedText(template)
      const capabilityText = this.generateCapabilityText(template)
      const useCaseText = this.generateUseCaseText(template)

      // Generate embeddings using the vendor
      const texts = [titleText, descriptionText, combinedText, capabilityText, useCaseText]
      const batchResult = await this.vendor.generateBatchEmbeddings(texts)

      return {
        title: batchResult.embeddings[0],
        description: batchResult.embeddings[1],
        combined: batchResult.embeddings[2],
        capabilities: batchResult.embeddings[3],
        useCase: batchResult.embeddings[4],
      }
    } catch (error) {
      console.error(`Failed to generate embeddings using ${this.vendor.vendor}:`, error)
      // Always fallback to mock embeddings on error instead of throwing
      if (this.config.vendor !== 'mock') {
        console.warn(
          'Falling back to mock embeddings due to vendor error. Search results may be less accurate.'
        )
        return this.generateMockEmbeddings()
      }
      // Only throw if we're already using mock and it still fails
      throw error
    }
  }

  async generateQueryEmbedding(query: string): Promise<Float32Array> {
    try {
      const result = await this.vendor.generateEmbedding(query)
      return result.embedding
    } catch (error) {
      console.error(`Failed to generate query embedding using ${this.vendor.vendor}:`, error)
      // Always fallback to mock embedding on error instead of throwing
      if (this.config.vendor !== 'mock') {
        console.warn(
          'Falling back to mock embedding for query due to vendor error. Search results may be less accurate.'
        )
        return this.generateMockEmbedding(query)
      }
      // Only throw if we're already using mock and it still fails
      throw error
    }
  }

  /**
   * Get vendor information for debugging/logging
   */
  getVendorInfo(): { vendor: string; model: string; dimensions: number } {
    return {
      vendor: this.vendor.vendor,
      model: this.vendor.model,
      dimensions: this.vendor.dimensions,
    }
  }

  /**
   * Create embedding service from environment variables
   */
  static fromEnvironment(): EmbeddingService {
    const config = EmbeddingService.getConfigFromEnvironment()
    return new EmbeddingService(config)
  }

  /**
   * Get embedding configuration from environment variables
   */
  static getConfigFromEnvironment(): EmbeddingConfig {
    const vendor = (process.env.EMBEDDING_VENDOR || 'mock') as EmbeddingConfig['vendor']
    const model = process.env.EMBEDDING_MODEL
    const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536')
    const apiKey = process.env.EMBEDDING_API_KEY
    const batchSize = parseInt(process.env.EMBEDDING_BATCH_SIZE || '100')
    const rateLimitDelay = parseInt(process.env.EMBEDDING_RATE_LIMIT_DELAY || '100')

    const config: EmbeddingConfig = {
      vendor,
      model,
      dimensions,
      apiKey,
      batchSize,
      rateLimitDelay,
    }

    // Add vendor-specific environment variables
    switch (vendor) {
      case 'azure-openai':
        config.endpoint = process.env.AZURE_OPENAI_ENDPOINT
        config.apiVersion = process.env.AZURE_OPENAI_API_VERSION
        break
      case 'google':
        config.region = process.env.GOOGLE_REGION
        config.projectId = process.env.GOOGLE_PROJECT_ID
        break
    }

    return config
  }

  private generateMockEmbeddings(): TemplateEmbeddings {
    return {
      title: this.generateMockEmbedding('title'),
      description: this.generateMockEmbedding('description'),
      combined: this.generateMockEmbedding('combined'),
      capabilities: this.generateMockEmbedding('capabilities'),
      useCase: this.generateMockEmbedding('useCase'),
    }
  }

  private generateMockEmbedding(seed: string): Float32Array {
    // Generate deterministic mock embeddings based on seed
    const embedding = new Float32Array(this.dimensions)

    // Simple hash function for deterministic values
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i)
      hash = hash & hash
    }

    // Fill with pseudo-random values
    for (let i = 0; i < this.dimensions; i++) {
      const value = Math.sin(hash * (i + 1)) * 0.5 + 0.5
      embedding[i] = value * 2 - 1 // Normalize to [-1, 1]
    }

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    for (let i = 0; i < this.dimensions; i++) {
      embedding[i] /= magnitude
    }

    return embedding
  }

  private generateTitleText(template: NodeTemplate): string {
    const text = `${template.title} ${template.subtitle || ''}`.trim()
    return text || 'Untitled Node'
  }

  private generateDescriptionText(template: NodeTemplate): string {
    return template.description || template.title || 'No description'
  }

  private generateCombinedText(template: NodeTemplate): string {
    const parts = [
      template.title,
      template.subtitle,
      template.description,
      template.category,
      template.subcategory,
      ...(template.tags || []),
    ].filter(Boolean)

    // Add port information with types
    const inputPorts = (template.ports || [])
      .filter(p => p.type === 'input')
      .map(
        p =>
          `input ${p.label} ${p.schema ? `accepts ${typeof p.schema === 'string' ? p.schema : 'data'}` : ''}`
      )
      .join(' ')

    const outputPorts = (template.ports || [])
      .filter(p => p.type === 'output')
      .map(
        p =>
          `output ${p.label} ${p.schema ? `returns ${typeof p.schema === 'string' ? p.schema : 'data'}` : ''}`
      )
      .join(' ')

    if (inputPorts) parts.push(inputPorts)
    if (outputPorts) parts.push(outputPorts)

    // Add comprehensive property information
    const properties = Object.entries(template.properties)
      .map(([key, prop]) => {
        const propParts = [`property ${key}`, prop.label, `type ${prop.type}`]

        if (prop.description) propParts.push(prop.description)
        if (prop.required) propParts.push('required')
        if (prop.options && Array.isArray(prop.options)) {
          propParts.push(`options ${prop.options.join(' ')}`)
        }
        if (prop.defaultValue !== undefined) {
          propParts.push(`default ${prop.defaultValue}`)
        }
        if (prop.placeholder) propParts.push(`hint ${prop.placeholder}`)

        return propParts.join(' ')
      })
      .join(' ')

    if (properties) parts.push(properties)

    // Add environment variables
    if (template.requiredEnvVars && template.requiredEnvVars.length > 0) {
      parts.push(`requires environment ${template.requiredEnvVars.join(' ')}`)
    }

    return parts.join(' ')
  }

  private generateCapabilityText(template: NodeTemplate): string {
    const capabilities: string[] = []

    // Extract capabilities from various sources
    capabilities.push(template.category)
    if (template.subcategory) capabilities.push(template.subcategory)

    // From ports with detailed type information
    if (template.ports && Array.isArray(template.ports)) {
      template.ports.forEach(port => {
        if (port.type === 'input') {
          capabilities.push(`accepts ${port.label}`)
          if (port.schema) {
            capabilities.push(
              `input type ${typeof port.schema === 'string' ? port.schema : 'structured data'}`
            )
          }
        } else {
          capabilities.push(`produces ${port.label}`)
          if (port.schema) {
            capabilities.push(
              `output type ${typeof port.schema === 'string' ? port.schema : 'structured data'}`
            )
          }
        }
      })
    }

    // From properties - extract all meaningful configuration options
    Object.entries(template.properties).forEach(([key, prop]) => {
      // Add property type capabilities
      capabilities.push(`configurable ${key} ${prop.type}`)

      // Add specific capabilities based on property types
      if (prop.type === 'select' && prop.options) {
        if (Array.isArray(prop.options)) {
          capabilities.push(`${key} options: ${prop.options.join(' ')}`)
        }
      }

      if (prop.type === 'code-editor' && prop.language) {
        capabilities.push(`supports ${prop.language} code`)
      }

      if (prop.type === 'file') {
        capabilities.push('file upload capability')
      }

      if (prop.type === 'dataOperations') {
        capabilities.push('data transformation rules')
      }

      if (prop.validation) {
        capabilities.push(`${key} with validation`)
      }
    })

    // Add environment variable requirements as capabilities
    if (template.requiredEnvVars && template.requiredEnvVars.length > 0) {
      capabilities.push(`requires ${template.requiredEnvVars.join(' ')} environment variables`)
    }

    return capabilities.join(' ')
  }

  private generateUseCaseText(template: NodeTemplate): string {
    const useCases: string[] = []

    // Category-based use cases
    const categoryUseCases: Record<string, string[]> = {
      'data-sources': ['data ingestion', 'api integration', 'external data access'],
      'ai-models': ['natural language processing', 'content generation', 'ai automation'],
      'data-processing': ['data transformation', 'etl pipeline', 'data manipulation'],
      communication: ['messaging', 'notifications', 'real-time communication'],
      'storage-memory': ['data persistence', 'caching', 'state management'],
      'logic-control': ['workflow control', 'conditional logic', 'flow orchestration'],
      scripting: ['custom automation', 'code execution', 'dynamic logic'],
      'tools-utilities': ['data conversion', 'utility functions', 'helper tools'],
      'user-inputs': ['user interaction', 'form handling', 'data collection'],
      inputs: ['user interaction', 'form handling', 'data collection'], // Add 'inputs' category
      media: ['media handling', 'file upload', 'multimedia processing'], // Add 'media' category
      'graph-io': ['modular workflows', 'subgraph composition', 'workflow reuse'],
    }

    const categoryUses = categoryUseCases[template.category] || []
    useCases.push(...categoryUses)

    // Title-based use cases
    const titleLower = template.title.toLowerCase()
    if (titleLower.includes('api')) useCases.push('api integration')
    if (titleLower.includes('database')) useCases.push('database operations')
    if (titleLower.includes('file')) useCases.push('file handling')
    if (titleLower.includes('transform')) useCases.push('data transformation')
    if (titleLower.includes('filter')) useCases.push('data filtering')
    if (titleLower.includes('aggregate')) useCases.push('data aggregation')

    return useCases.join(' ')
  }

  // Utility methods for similarity calculations
  static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let magnitudeA = 0
    let magnitudeB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      magnitudeA += a[i] * a[i]
      magnitudeB += b[i] * b[i]
    }

    magnitudeA = Math.sqrt(magnitudeA)
    magnitudeB = Math.sqrt(magnitudeB)

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0
    }

    return dotProduct / (magnitudeA * magnitudeB)
  }

  static euclideanDistance(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }

    let sum = 0
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i]
      sum += diff * diff
    }

    return Math.sqrt(sum)
  }
}
