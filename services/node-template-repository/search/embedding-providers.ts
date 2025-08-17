/**
 * Embedding vendor providers for AI models
 * Supports OpenAI, Azure OpenAI, Google, and other vendors
 */

export interface EmbeddingVendorConfig {
  vendor: 'openai' | 'azure-openai' | 'google' | 'anthropic' | 'cohere' | 'mock'
  model: string
  apiKey: string
  dimensions: number
  // Vendor-specific configuration
  endpoint?: string // For Azure or custom endpoints
  apiVersion?: string // For Azure
  region?: string // For Google/AWS
  projectId?: string // For Google
  maxTokens?: number
  batchSize?: number
  rateLimitDelay?: number
}

export interface EmbeddingResult {
  embedding: Float32Array
  tokens?: number
  model?: string
}

export interface BatchEmbeddingResult {
  embeddings: Float32Array[]
  totalTokens?: number
  model?: string
}

export abstract class EmbeddingVendor {
  protected config: EmbeddingVendorConfig

  constructor(config: EmbeddingVendorConfig) {
    this.config = config
    this.validateConfig()
  }

  abstract generateEmbedding(text: string): Promise<EmbeddingResult>
  abstract generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult>

  protected abstract validateConfig(): void

  get dimensions(): number {
    return this.config.dimensions
  }

  get vendor(): string {
    return this.config.vendor
  }

  get model(): string {
    return this.config.model
  }
}

/**
 * OpenAI Embedding Vendor
 */
export class OpenAIEmbeddingVendor extends EmbeddingVendor {
  private baseUrl = 'https://api.openai.com/v1'

  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required')
    }
    if (!this.config.model) {
      throw new Error(
        'OpenAI model is required (e.g., text-embedding-3-small, text-embedding-3-large)'
      )
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: this.config.model,
          dimensions: this.config.dimensions,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} ${error}`)
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>
        usage?: { total_tokens: number }
      }
      const embedding = new Float32Array(data.data[0].embedding)

      return {
        embedding,
        tokens: data.usage?.total_tokens,
        model: this.config.model,
      }
    } catch (error) {
      console.error('OpenAI embedding generation failed:', error)
      throw error
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    const batchSize = this.config.batchSize || 100
    const embeddings: Float32Array[] = []
    let totalTokens = 0

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)

      try {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: batch,
            model: this.config.model,
            dimensions: this.config.dimensions,
          }),
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`OpenAI API error: ${response.status} ${error}`)
        }

        const data = (await response.json()) as {
          data: Array<{ embedding: number[] }>
          usage?: { total_tokens: number }
        }

        for (const item of data.data) {
          embeddings.push(new Float32Array(item.embedding))
        }

        totalTokens += data.usage?.total_tokens || 0

        // Rate limiting delay
        if (this.config.rateLimitDelay && i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay))
        }
      } catch (error) {
        console.error(`OpenAI batch embedding failed for batch ${i / batchSize + 1}:`, error)
        throw error
      }
    }

    return {
      embeddings,
      totalTokens,
      model: this.config.model,
    }
  }
}

/**
 * Azure OpenAI Embedding Vendor
 */
export class AzureOpenAIEmbeddingVendor extends EmbeddingVendor {
  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('Azure OpenAI API key is required')
    }
    if (!this.config.endpoint) {
      throw new Error('Azure OpenAI endpoint is required')
    }
    if (!this.config.model) {
      throw new Error('Azure OpenAI deployment name is required')
    }
    if (!this.config.apiVersion) {
      this.config.apiVersion = '2024-02-01'
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const url = `${this.config.endpoint}/openai/deployments/${this.config.model}/embeddings?api-version=${this.config.apiVersion}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          dimensions: this.config.dimensions,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Azure OpenAI API error: ${response.status} ${error}`)
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>
        usage?: { total_tokens: number }
      }
      const embedding = new Float32Array(data.data[0].embedding)

      return {
        embedding,
        tokens: data.usage?.total_tokens,
        model: this.config.model,
      }
    } catch (error) {
      console.error('Azure OpenAI embedding generation failed:', error)
      throw error
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    const batchSize = this.config.batchSize || 100
    const embeddings: Float32Array[] = []
    let totalTokens = 0

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const url = `${this.config.endpoint}/openai/deployments/${this.config.model}/embeddings?api-version=${this.config.apiVersion}`

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'api-key': this.config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: batch,
            dimensions: this.config.dimensions,
          }),
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Azure OpenAI API error: ${response.status} ${error}`)
        }

        const data = (await response.json()) as {
          data: Array<{ embedding: number[] }>
          usage?: { total_tokens: number }
        }

        for (const item of data.data) {
          embeddings.push(new Float32Array(item.embedding))
        }

        totalTokens += data.usage?.total_tokens || 0

        // Rate limiting delay
        if (this.config.rateLimitDelay && i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay))
        }
      } catch (error) {
        console.error(`Azure OpenAI batch embedding failed for batch ${i / batchSize + 1}:`, error)
        throw error
      }
    }

    return {
      embeddings,
      totalTokens,
      model: this.config.model,
    }
  }
}

/**
 * Google Embedding Vendor (Vertex AI)
 */
export class GoogleEmbeddingVendor extends EmbeddingVendor {
  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('Google API key is required')
    }
    if (!this.config.projectId) {
      throw new Error('Google Project ID is required')
    }
    if (!this.config.region) {
      this.config.region = 'us-central1'
    }
    if (!this.config.model) {
      this.config.model = 'textembedding-gecko@latest'
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const url = `https://${this.config.region}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.region}/publishers/google/models/${this.config.model}:predict`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [{ content: text }],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Google Vertex AI error: ${response.status} ${error}`)
      }

      const data = (await response.json()) as {
        predictions: Array<{ embeddings: { values: number[] } }>
      }
      const embedding = new Float32Array(data.predictions[0].embeddings.values)

      return {
        embedding,
        model: this.config.model,
      }
    } catch (error) {
      console.error('Google embedding generation failed:', error)
      throw error
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    const batchSize = this.config.batchSize || 100
    const embeddings: Float32Array[] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const url = `https://${this.config.region}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.region}/publishers/google/models/${this.config.model}:predict`

      try {
        const instances = batch.map(text => ({ content: text }))

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ instances }),
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Google Vertex AI error: ${response.status} ${error}`)
        }

        const data = (await response.json()) as {
          predictions: Array<{ embeddings: { values: number[] } }>
        }

        for (const prediction of data.predictions) {
          embeddings.push(new Float32Array(prediction.embeddings.values))
        }

        // Rate limiting delay
        if (this.config.rateLimitDelay && i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay))
        }
      } catch (error) {
        console.error(`Google batch embedding failed for batch ${i / batchSize + 1}:`, error)
        throw error
      }
    }

    return {
      embeddings,
      model: this.config.model,
    }
  }
}

/**
 * Mock Embedding Vendor for testing/development
 */
export class MockEmbeddingVendor extends EmbeddingVendor {
  protected validateConfig(): void {
    // No validation needed for mock
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const embedding = this.generateMockEmbedding(text)
    return {
      embedding,
      tokens: Math.floor(text.length / 4), // Rough token estimate
      model: 'mock-embedding-model',
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    const embeddings = texts.map(text => this.generateMockEmbedding(text))
    const totalTokens = texts.reduce((sum, text) => sum + Math.floor(text.length / 4), 0)

    return {
      embeddings,
      totalTokens,
      model: 'mock-embedding-model',
    }
  }

  private generateMockEmbedding(seed: string): Float32Array {
    const embedding = new Float32Array(this.config.dimensions)

    // Handle empty or very short seeds
    if (!seed || seed.length === 0) {
      seed = 'default_seed'
    }

    // Simple hash function for deterministic values
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
      hash = hash & hash
    }

    // Ensure hash is not zero to avoid issues
    if (hash === 0) {
      hash = 42
    }

    // Fill with pseudo-random values
    for (let i = 0; i < this.config.dimensions; i++) {
      const value = Math.sin(hash * (i + 1)) * 0.5 + 0.5
      embedding[i] = value * 2 - 1 // Normalize to [-1, 1]

      // Ensure no NaN or Infinity values
      if (!isFinite(embedding[i])) {
        embedding[i] = 0
      }
    }

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))

    // Handle edge case where magnitude is 0 or NaN
    if (!isFinite(magnitude) || magnitude === 0) {
      // Create a simple normalized vector
      for (let i = 0; i < this.config.dimensions; i++) {
        embedding[i] = i === 0 ? 1 : 0
      }
    } else {
      for (let i = 0; i < this.config.dimensions; i++) {
        embedding[i] /= magnitude
      }
    }

    return embedding
  }
}

/**
 * Factory function to create embedding vendors
 */
export function createEmbeddingVendor(config: EmbeddingVendorConfig): EmbeddingVendor {
  switch (config.vendor) {
    case 'openai':
      return new OpenAIEmbeddingVendor(config)
    case 'azure-openai':
      return new AzureOpenAIEmbeddingVendor(config)
    case 'google':
      return new GoogleEmbeddingVendor(config)
    case 'mock':
      return new MockEmbeddingVendor(config)
    default:
      throw new Error(`Unsupported embedding vendor: ${config.vendor}`)
  }
}

/**
 * Configuration builder for embedding vendors
 */
export class EmbeddingConfigBuilder {
  private config: Partial<EmbeddingVendorConfig> = {}

  static openai(): EmbeddingConfigBuilder {
    return new EmbeddingConfigBuilder().vendor('openai')
  }

  static azureOpenai(): EmbeddingConfigBuilder {
    return new EmbeddingConfigBuilder().vendor('azure-openai')
  }

  static google(): EmbeddingConfigBuilder {
    return new EmbeddingConfigBuilder().vendor('google')
  }

  static mock(): EmbeddingConfigBuilder {
    return new EmbeddingConfigBuilder().vendor('mock')
  }

  vendor(vendor: EmbeddingVendorConfig['vendor']): this {
    this.config.vendor = vendor
    return this
  }

  model(model: string): this {
    this.config.model = model
    return this
  }

  apiKey(apiKey: string): this {
    this.config.apiKey = apiKey
    return this
  }

  dimensions(dimensions: number): this {
    this.config.dimensions = dimensions
    return this
  }

  endpoint(endpoint: string): this {
    this.config.endpoint = endpoint
    return this
  }

  apiVersion(apiVersion: string): this {
    this.config.apiVersion = apiVersion
    return this
  }

  region(region: string): this {
    this.config.region = region
    return this
  }

  projectId(projectId: string): this {
    this.config.projectId = projectId
    return this
  }

  batchSize(batchSize: number): this {
    this.config.batchSize = batchSize
    return this
  }

  rateLimitDelay(delay: number): this {
    this.config.rateLimitDelay = delay
    return this
  }

  build(): EmbeddingVendorConfig {
    if (!this.config.vendor) {
      throw new Error('Vendor is required')
    }
    if (!this.config.model && this.config.vendor !== 'mock') {
      throw new Error('Model is required')
    }
    if (!this.config.apiKey && this.config.vendor !== 'mock') {
      throw new Error('API key is required')
    }
    if (!this.config.dimensions) {
      // Set default dimensions based on vendor/model
      this.config.dimensions = this.getDefaultDimensions()
    }

    return this.config as EmbeddingVendorConfig
  }

  private getDefaultDimensions(): number {
    switch (this.config.vendor) {
      case 'openai':
        if (this.config.model?.includes('text-embedding-3-large')) return 3072
        if (this.config.model?.includes('text-embedding-3-small')) return 1536
        return 1536
      case 'azure-openai':
        return 1536
      case 'google':
        return 768
      default:
        return 1536
    }
  }
}
