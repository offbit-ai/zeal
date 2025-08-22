/**
 * Search service for node templates
 * Provides both keyword and semantic search capabilities
 */

import { SearchQuery, SearchResult, NodeTemplate, TemplateRepository } from '../core/models'
import { TemplateOperations } from '../core/database-operations'
import { EmbeddingService } from './embedding-service'

export interface SearchConfig {
  hybridSearchWeight: number // Weight between keyword (0) and semantic (1) search
  maxResults: number
  minScore: number
  boostFactors: {
    title: number
    category: number
    recency: number
    popularity: number
  }
}

export class SearchService {
  constructor(
    private repository: TemplateOperations,
    private embeddingService: EmbeddingService,
    private config: SearchConfig = {
      hybridSearchWeight: 0.7,
      maxResults: 20,
      minScore: 0.3,
      boostFactors: {
        title: 2.0,
        category: 1.5,
        recency: 1.2,
        popularity: 1.3,
      },
    }
  ) {}

  async search(query: SearchQuery): Promise<SearchResult[]> {
    // If no search query, get all templates (with optional filters)
    if (!query.query || query.query.trim() === '') {
      // Get all templates
      const allTemplates = await this.repository.listTemplates({
        status: 'active',
        limit: 1000, // Get more templates when filtering
      })

      // Convert to search results
      const allResults: SearchResult[] = allTemplates.map(template => ({
        template,
        score: 1.0, // Default score for browsing
        highlights: {},
      }))

      // Apply filters
      const filteredResults = this.applyFilters(allResults, query)

      // Sort and limit
      return filteredResults
        .sort((a, b) => {
          // Sort by title when browsing by category
          return a.template.title.localeCompare(b.template.title)
        })
        .slice(0, query.limit || this.config.maxResults)
    }

    // Normal search flow with query text
    const [keywordResults, semanticResults] = await Promise.all([
      this.keywordSearch(query),
      this.semanticSearch(query),
    ])

    // Combine and rank results
    const combinedResults = this.combineResults(
      keywordResults,
      semanticResults,
      this.config.hybridSearchWeight
    )

    // Apply filters
    const filteredResults = this.applyFilters(combinedResults, query)

    // Apply boost factors
    const boostedResults = this.applyBoostFactors(filteredResults, query)

    // Sort by final score and limit
    const finalResults = boostedResults
      .filter(r => r.score >= this.config.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit || this.config.maxResults)

    // Enhance with related templates
    return this.enhanceWithRelatedTemplates(finalResults)
  }

  async searchByCapability(capability: string, limit?: number): Promise<SearchResult[]> {
    const query: SearchQuery = {
      query: capability,
      capabilities: [capability],
      limit: limit || 10,
    }

    return this.search(query)
  }

  async searchByCategory(category: string, subcategory?: string): Promise<SearchResult[]> {
    const query: SearchQuery = {
      query: subcategory ? `${category} ${subcategory}` : category,
      category,
      subcategory,
      limit: 50,
    }

    return this.search(query)
  }

  async getSimilarTemplates(templateId: string, limit?: number): Promise<SearchResult[]> {
    // Get the template and its embeddings
    const repository = await this.repository.getRepository(templateId)
    if (!repository) {
      return []
    }

    // Search by combined embedding
    const results = await this.repository.searchByEmbedding(
      repository.embeddings.combined,
      (limit || 10) + 1 // +1 to exclude self
    )

    // Filter out the template itself
    return results.filter(r => r.template.id !== templateId).slice(0, limit || 10)
  }

  async getRecommendations(context: {
    recentlyUsed?: string[]
    workflowCategory?: string
    currentNodes?: string[]
  }): Promise<SearchResult[]> {
    const recommendations: Map<string, SearchResult> = new Map()

    // Get templates commonly used with recently used templates
    if (context.recentlyUsed && context.recentlyUsed.length > 0) {
      for (const templateId of context.recentlyUsed) {
        const related = await this.repository.getRelatedTemplates(templateId)
        for (const relatedId of related) {
          const template = await this.repository.getTemplate(relatedId)
          if (template && !context.currentNodes?.includes(relatedId)) {
            recommendations.set(relatedId, {
              template,
              score: 0.8,
              highlights: {},
            })
          }
        }
      }
    }

    // Get popular templates in the workflow category
    if (context.workflowCategory) {
      const categoryTemplates = await this.repository.listTemplates({
        category: context.workflowCategory,
        status: 'active',
      })

      for (const template of categoryTemplates.slice(0, 5)) {
        if (!recommendations.has(template.id) && !context.currentNodes?.includes(template.id)) {
          recommendations.set(template.id, {
            template,
            score: 0.6,
            highlights: {},
          })
        }
      }
    }

    return Array.from(recommendations.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }

  private async keywordSearch(query: SearchQuery): Promise<SearchResult[]> {
    // Use PostgreSQL full-text search
    return this.repository.searchTemplates(query)
  }

  private async semanticSearch(query: SearchQuery): Promise<SearchResult[]> {
    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query.query)

    // Search by embedding similarity
    return this.repository.searchByEmbedding(queryEmbedding, query.limit || this.config.maxResults)
  }

  private combineResults(
    keywordResults: SearchResult[],
    semanticResults: SearchResult[],
    weight: number
  ): SearchResult[] {
    const combinedMap = new Map<string, SearchResult>()

    // Add keyword results with weighted scores
    keywordResults.forEach(result => {
      combinedMap.set(result.template.id, {
        ...result,
        score: result.score * (1 - weight),
      })
    })

    // Add or update with semantic results
    semanticResults.forEach(result => {
      const existing = combinedMap.get(result.template.id)
      if (existing) {
        // Combine scores
        existing.score += result.score * weight
        // Merge highlights
        existing.highlights = { ...existing.highlights, ...result.highlights }
      } else {
        combinedMap.set(result.template.id, {
          ...result,
          score: result.score * weight,
        })
      }
    })

    return Array.from(combinedMap.values())
  }

  private applyFilters(results: SearchResult[], query: SearchQuery): SearchResult[] {
    return results.filter(result => {
      const template = result.template

      // Category filter
      if (query.category && template.category !== query.category) {
        return false
      }

      // Subcategory filter
      if (query.subcategory && template.subcategory !== query.subcategory) {
        return false
      }

      // Tag filter
      if (query.tags && query.tags.length > 0) {
        const hasAllTags = query.tags.every(tag => template.tags.includes(tag))
        if (!hasAllTags) return false
      }

      // Capability filter
      if (query.capabilities && query.capabilities.length > 0) {
        // This would require loading the full repository data
        // For now, we'll check if capabilities are mentioned in title/description
        const templateText = `${template.title} ${template.description}`.toLowerCase()
        const hasCapability = query.capabilities.some(cap =>
          templateText.includes(cap.toLowerCase())
        )
        if (!hasCapability) return false
      }

      // Exclude deprecated unless explicitly requested
      if (!query.includeDeprecated && template.status === 'deprecated') {
        return false
      }

      return true
    })
  }

  private applyBoostFactors(results: SearchResult[], query: SearchQuery): SearchResult[] {
    const queryLower = query.query.toLowerCase()

    return results.map(result => {
      let boostedScore = result.score
      const template = result.template

      // Title match boost
      if (template.title.toLowerCase().includes(queryLower)) {
        boostedScore *= this.config.boostFactors.title
        result.highlights.title = this.highlightText(template.title, query.query)
      }

      // Category match boost
      if (query.category && template.category === query.category) {
        boostedScore *= this.config.boostFactors.category
      }

      // Recency boost (templates updated recently)
      const daysSinceUpdate =
        (Date.now() - new Date(template.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceUpdate < 30) {
        boostedScore *= this.config.boostFactors.recency
      }

      // Popularity boost would come from usage stats
      // For now, we'll skip this as it requires repository stats

      return {
        ...result,
        score: boostedScore,
      }
    })
  }

  private async enhanceWithRelatedTemplates(results: SearchResult[]): Promise<SearchResult[]> {
    // For top results, get related templates
    const enhancedResults: SearchResult[] = []

    for (const result of results) {
      const related = await this.repository.getRelatedTemplates(result.template.id)
      enhancedResults.push({
        ...result,
        relatedTemplates: related.slice(0, 3),
      })
    }

    return enhancedResults
  }

  private highlightText(text: string, query: string): string {
    // Simple highlighting - in production, use a proper highlighting library
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi')
    return text.replace(regex, '<mark>$1</mark>')
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // Autocomplete suggestions
  async getAutocompleteSuggestions(partial: string, limit?: number): Promise<string[]> {
    const templates = await this.repository.listTemplates({ status: 'active' })

    const suggestions = new Set<string>()
    const partialLower = partial.toLowerCase()

    // Add matching titles
    templates.forEach(template => {
      if (template.title.toLowerCase().includes(partialLower)) {
        suggestions.add(template.title)
      }

      // Add matching tags
      template.tags.forEach(tag => {
        if (tag.toLowerCase().includes(partialLower)) {
          suggestions.add(tag)
        }
      })

      // Add categories
      if (template.category.includes(partialLower)) {
        suggestions.add(template.category)
      }
    })

    return Array.from(suggestions)
      .sort((a, b) => {
        // Prioritize exact prefix matches
        const aStarts = a.toLowerCase().startsWith(partialLower)
        const bStarts = b.toLowerCase().startsWith(partialLower)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1

        // Then sort by length (shorter first)
        return a.length - b.length
      })
      .slice(0, limit || 10)
  }

  // Category tree for browsing
  async getCategoryTree(): Promise<any> {
    const templates = await this.repository.listTemplates({ status: 'active' })

    const tree: Record<
      string,
      {
        count: number
        subcategories: Record<string, number>
      }
    > = {}

    templates.forEach(template => {
      if (!tree[template.category]) {
        tree[template.category] = {
          count: 0,
          subcategories: {},
        }
      }

      tree[template.category].count++

      if (template.subcategory) {
        tree[template.category].subcategories[template.subcategory] =
          (tree[template.category].subcategories[template.subcategory] || 0) + 1
      }
    })

    return tree
  }
}
