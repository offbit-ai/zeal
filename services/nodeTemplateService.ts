/**
 * Node Template Service
 * Provides a unified interface for node templates with optional repository features
 */

import { allNodeTemplates } from '@/data/nodeTemplates'
import { NodeTemplate as DataNodeTemplate } from '@/data/nodeTemplates/types'
import { getTemplateOperations } from '@/lib/database-template-operations'
import { SearchService } from '@/services/node-template-repository/search/search-service'
import { EmbeddingService } from '@/services/node-template-repository/search/embedding-service'
import { InMemoryIngestionService } from '@/services/node-template-repository/ingestion/ingest-from-memory'
import { MetadataExtractor } from '@/services/node-template-repository/ingestion/metadata-extractor'
import { getCategoriesWithCounts } from '@/services/node-template-repository/core/category-mappings'
import { getCategoryOperations } from '@/lib/database-category-operations'
import { CategoryIngestionService } from '@/services/node-template-repository/ingestion/category-ingestion-service'

// Service configuration
const USE_REPOSITORY = process.env.USE_TEMPLATE_REPOSITORY === 'true'
const AUTO_INGEST = process.env.AUTO_INGEST_TEMPLATES !== 'false'

export interface NodeTemplateResponse {
  id: string
  type: string
  title: string
  subtitle: string
  category: string
  subcategory?: string
  description: string
  icon: string
  variant?: string
  shape?: string
  size?: string
  ports: any[]
  properties: Record<string, any>
  requiredEnvVars?: string[]
  tags: string[]
  version: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  propertyRules?: any
  tenantId?: string // For multi-tenant setups
  // Optional search metadata
  _searchScore?: number
  _highlights?: any
}

export interface SearchOptions {
  query?: string
  category?: string
  subcategory?: string
  tags?: string[]
  useRepository?: boolean
  limit?: number
  offset?: number
}

class NodeTemplateService {
  private searchService: SearchService | null = null
  private isIngested = false
  private ingestPromise: Promise<void> | null = null
  private static instance: NodeTemplateService | null = null

  constructor() {
    // Initialize repository features if enabled
    if (USE_REPOSITORY && AUTO_INGEST) {
      this.ingestPromise = this.ensureIngested()
    }
  }

  static getInstance(): NodeTemplateService {
    if (!NodeTemplateService.instance) {
      NodeTemplateService.instance = new NodeTemplateService()
    }
    return NodeTemplateService.instance
  }

  /**
   * Get all node templates
   */
  async getAllTemplates(): Promise<NodeTemplateResponse[]> {
    return this.convertTemplates(allNodeTemplates)
  }

  /**
   * Search node templates
   */
  async searchTemplates(options: SearchOptions): Promise<{
    templates: NodeTemplateResponse[]
    totalCount: number
    isSemanticSearch: boolean
  }> {
    // Always get templates from database if repository is enabled
    if (USE_REPOSITORY) {
      // await this.ensureIngested()
      const templateOps = await getTemplateOperations()

      // If query is provided, use semantic search
      if (options.query && options.useRepository !== false) {
        const searchService = await this.getSearchService()

        const searchResults = await searchService.search({
          query: options.query,
          category: options.category,
          subcategory: options.subcategory,
          tags: options.tags,
          limit: options.limit || 100,
          offset: options.offset,
        })

        const templates = searchResults.map(result => this.convertSearchResult(result))

        return {
          templates,
          totalCount: searchResults.length,
          isSemanticSearch: true,
        }
      }

      // Otherwise, get all templates from DB and filter
      const dbTemplates = await templateOps.listTemplates({
        category: options.category,
        status: 'active',
      })

      let templates = dbTemplates.map(t => this.convertDbTemplate(t))

      if (options.subcategory) {
        templates = templates.filter(
          t => t.subcategory?.toLowerCase() === options.subcategory!.toLowerCase()
        )
      }

      if (options.query) {
        const queryLower = options.query.toLowerCase()
        templates = templates.filter(
          t =>
            t.title.toLowerCase().includes(queryLower) ||
            t.description.toLowerCase().includes(queryLower) ||
            t.tags.some(tag => tag.toLowerCase().includes(queryLower))
        )
      }

      if (options.tags && options.tags.length > 0) {
        templates = templates.filter(t => options.tags!.some(tag => t.tags.includes(tag)))
      }

      // Apply pagination
      const start = options.offset || 0
      const end = start + (options.limit || templates.length)
      const paginated = templates.slice(start, end)

      return {
        templates: paginated,
        totalCount: templates.length,
        isSemanticSearch: false,
      }
    }

    // Fall back to in-memory templates if repository not enabled
    let templates = this.convertTemplates(allNodeTemplates)

    if (options.category) {
      templates = templates.filter(
        t => t.category.toLowerCase() === options.category!.toLowerCase()
      )
    }

    if (options.subcategory) {
      templates = templates.filter(
        t => t.subcategory?.toLowerCase() === options.subcategory!.toLowerCase()
      )
    }

    if (options.query) {
      const queryLower = options.query.toLowerCase()
      templates = templates.filter(
        t =>
          t.title.toLowerCase().includes(queryLower) ||
          t.description.toLowerCase().includes(queryLower) ||
          t.tags.some(tag => tag.toLowerCase().includes(queryLower))
      )
    }

    if (options.tags && options.tags.length > 0) {
      templates = templates.filter(t => options.tags!.some(tag => t.tags.includes(tag)))
    }

    // Apply pagination
    const start = options.offset || 0
    const end = start + (options.limit || templates.length)
    const paginated = templates.slice(start, end)

    return {
      templates: paginated,
      totalCount: templates.length,
      isSemanticSearch: false,
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<NodeTemplateResponse | null> {
    const template = allNodeTemplates.find(t => t.id === id)
    if (!template) return null

    const templates = this.convertTemplates([template])
    return templates[0] || null
  }

  /**
   * Get categories with counts
   */
  async getCategories(): Promise<any[]> {
    if (USE_REPOSITORY) {
      try {
        const categoryOps = await getCategoryOperations()

        // Check if we need to ingest default categories
        const ingestionService = new CategoryIngestionService(categoryOps)
        if (await ingestionService.needsIngestion()) {
          console.log('Ingesting default categories...')
          await ingestionService.ingestDefaultCategories()
        }

        // Get categories with counts from DB
        const categoriesWithCounts = await categoryOps.getCategoriesWithCounts()

        // Format for API response
        return categoriesWithCounts.map(cat => ({
          name: cat.name,
          displayName: cat.displayName,
          description: cat.description,
          icon: cat.icon,
          subcategories: cat.subcategories || [],
          totalNodes: cat.totalNodes,
          isActive: cat.isActive,
        }))
      } catch (error) {
        console.error('Failed to get categories from DB:', error)
        // Fall back to static categories
        const templates = allNodeTemplates
        return getCategoriesWithCounts(templates)
      }
    }

    // Fall back to static categories
    const templates = allNodeTemplates
    return getCategoriesWithCounts(templates)
  }

  /**
   * Update an existing template
   */
  async updateTemplate(id: string, updateData: Partial<NodeTemplateResponse>): Promise<NodeTemplateResponse> {
    const templateOps = await getTemplateOperations()

    // Get existing template
    const existing = await templateOps.getTemplate(id)
    if (!existing) {
      throw new Error(`Template ${id} not found`)
    }

    // Update template data
    const updated = await templateOps.updateTemplate(id, {
      ...updateData,
      updatedAt: new Date(),
    } as any)

    // Re-generate embeddings if content changed
    if (updateData.title || updateData.description || updateData.properties) {
      const embeddingService = EmbeddingService.fromEnvironment()
      const metadataExtractor = new MetadataExtractor()

      const embeddings = await embeddingService.generateEmbeddings(updated)
      const metadata = await metadataExtractor.extractMetadata(updated)

      await templateOps.upsertRepository({
        template: updated,
        embeddings,
        metadata,
        source: updated.source,
      })
    }

    return this.convertDbTemplate(updated)
  }

  /**
   * Create a new template
   */
  async createTemplate(templateData: any): Promise<NodeTemplateResponse> {
    const templateOps = await getTemplateOperations()

    // Convert to repository model
    const template = {
      id: templateData.id,
      version: templateData.version || '1.0.0',
      status: templateData.status || 'active',
      type: templateData.type || 'unknown',
      title: templateData.title,
      subtitle: templateData.subtitle || '',
      description: templateData.description || '',
      category: templateData.category,
      subcategory: templateData.subcategory,
      tags: templateData.tags || [],

      icon: templateData.icon || 'box',
      variant: templateData.variant,
      shape: templateData.shape || 'rectangle',
      size: templateData.size || 'medium',

      ports: templateData.ports || [],
      properties: templateData.properties || {},
      propertyRules: templateData.propertyRules,

      requiredEnvVars: templateData.requiredEnvVars || [],
      dependencies: [],

      source: {
        type: 'manual' as const,
        location: 'api',
      },

      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: templateData.createdBy || 'user',
      updatedBy: templateData.createdBy || 'user',
      isActive: templateData.status === 'active',
    }

    // Save to database
    const created = await templateOps.createTemplate(template)

    // Generate embeddings and metadata
    const embeddingService = EmbeddingService.fromEnvironment()
    const metadataExtractor = new MetadataExtractor()

    const embeddings = await embeddingService.generateEmbeddings(created)
    const metadata = await metadataExtractor.extractMetadata(created)

    // Store in repository
    await templateOps.upsertRepository({
      template: created,
      embeddings,
      metadata,
      source: template.source,
    })

    // Convert to response format
    return {
      id: created.id,
      type: created.id,
      title: created.title,
      subtitle: created.subtitle || '',
      category: created.category,
      subcategory: created.subcategory,
      description: created.description,
      icon: created.icon,
      variant: created.variant,
      shape: created.shape,
      size: created.size,
      ports: created.ports,
      properties: created.properties,
      requiredEnvVars: created.requiredEnvVars,
      tags: created.tags,
      version: created.version,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      propertyRules: created.propertyRules,
    }
  }

  /**
   * Convert data templates to response format
   */
  private convertTemplates(templates: DataNodeTemplate[]): NodeTemplateResponse[] {
    return templates.map((template, index) => ({
      id: template.id,
      type: template.type,
      title: template.title,
      subtitle: template.subtitle,
      category: template.category,
      subcategory: template.subcategory,
      description: template.description,
      icon: template.icon,
      variant: template.variant,
      shape: template.shape,
      size: template.size,
      ports: template.ports,
      properties: template.properties,
      requiredEnvVars: template.requiredEnvVars,
      tags: template.tags,
      version: template.version || '1.0.0',
      isActive: template.isActive !== false,
      createdAt: new Date(Date.now() - 86400000 * (30 - index)).toISOString(),
      updatedAt: new Date().toISOString(),
      ...(template.propertyRules ? { propertyRules: template.propertyRules } : {}),
    }))
  }

  /**
   * Convert search result to response format
   */
  private convertSearchResult(result: any): NodeTemplateResponse {
    const template = result.template
    return {
      id: template.id,
      type: template.id, // Use ID as type for compatibility
      title: template.title,
      subtitle: template.subtitle || '',
      category: template.category,
      subcategory: template.subcategory,
      description: template.description,
      icon: template.icon,
      variant: template.variant,
      shape: template.shape,
      size: template.size,
      ports: template.ports,
      properties: template.properties,
      requiredEnvVars: template.requiredEnvVars,
      tags: template.tags,
      version: template.version,
      isActive: template.isActive,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      propertyRules: template.propertyRules,
      // Add search metadata
      _searchScore: result.score,
      _highlights: result.highlights,
    }
  }

  /**
   * Convert database template to response format
   */
  private convertDbTemplate(template: any): NodeTemplateResponse {
    return {
      id: template.id,
      type: template.id, // Use ID as type for compatibility
      title: template.title,
      subtitle: template.subtitle || '',
      category: template.category,
      subcategory: template.subcategory,
      description: template.description,
      icon: template.icon,
      variant: template.variant,
      shape: template.shape,
      size: template.size,
      ports: template.ports,
      properties: template.properties,
      requiredEnvVars: template.requiredEnvVars,
      tags: template.tags,
      version: template.version,
      isActive: template.isActive,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      propertyRules: template.propertyRules,
    }
  }

  /**
   * Ensure templates are ingested into repository
   */
  private async ensureIngested(): Promise<void> {
    if (this.isIngested) return

    try {
      const templateOps = await getTemplateOperations()
      const embeddingService = EmbeddingService.fromEnvironment()
      const metadataExtractor = new MetadataExtractor()

      const ingestionService = new InMemoryIngestionService(
        templateOps,
        embeddingService,
        metadataExtractor
      )

      console.log('Ingesting node templates into repository...')
      const result = await ingestionService.ingestAllTemplates()
      console.log('Ingestion complete:', result)

      this.isIngested = true
    } catch (error) {
      console.error('Failed to ingest templates:', error)
      // Don't throw - fall back to basic search
    }
  }

  /**
   * Get or initialize search service
   */
  private async getSearchService(): Promise<SearchService> {
    if (!this.searchService) {
      const templateOps = await getTemplateOperations()
      const embeddingService = EmbeddingService.fromEnvironment()

      this.searchService = new SearchService(templateOps, embeddingService)
    }

    return this.searchService
  }
}

// Export singleton instance
export const nodeTemplateService = NodeTemplateService.getInstance()
