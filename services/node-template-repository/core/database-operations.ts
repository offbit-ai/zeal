/**
 * Database operations for Node Template Repository
 */

import { Pool } from 'pg'
import { SupabaseClient } from '@supabase/supabase-js'
import {
  NodeTemplate,
  TemplateRepository,
  TemplateVersion,
  DynamicTemplate,
  SearchQuery,
  SearchResult,
  TemplateEmbeddings,
} from './models'

export interface TemplateOperations {
  // Template CRUD
  createTemplate(template: NodeTemplate): Promise<NodeTemplate>
  updateTemplate(id: string, template: Partial<NodeTemplate>): Promise<NodeTemplate>
  getTemplate(id: string): Promise<NodeTemplate | null>
  deleteTemplate(id: string): Promise<void>
  listTemplates(filters?: any): Promise<NodeTemplate[]>

  // Repository operations
  upsertRepository(data: {
    template: NodeTemplate
    embeddings: TemplateEmbeddings
    metadata: any
    source: any
  }): Promise<void>

  getRepository(templateId: string): Promise<TemplateRepository | null>
  updateRepositoryStats(templateId: string, stats: any): Promise<void>

  // Search operations
  searchTemplates(query: SearchQuery): Promise<SearchResult[]>
  searchByEmbedding(embedding: Float32Array, limit: number): Promise<SearchResult[]>

  // Version management
  createVersion(version: TemplateVersion): Promise<TemplateVersion>
  getVersions(templateId: string): Promise<TemplateVersion[]>

  // Dynamic templates
  createDynamicTemplate(template: DynamicTemplate): Promise<DynamicTemplate>
  updateDynamicTemplate(id: string, updates: Partial<DynamicTemplate>): Promise<DynamicTemplate>
  listDynamicTemplates(): Promise<DynamicTemplate[]>

  // Relationships
  updateRelationships(templateId: string, relationships: any): Promise<void>
  getRelatedTemplates(templateId: string): Promise<string[]>

  // Analytics
  recordUsage(templateId: string, action: string, metadata?: any): Promise<void>
  getUsageStats(templateId: string): Promise<any>
}

export class PostgresTemplateOperations implements TemplateOperations {
  constructor(private pool: Pool) {}

  async createTemplate(template: NodeTemplate): Promise<NodeTemplate> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `INSERT INTO node_templates (
          template_id, version, status, template_data, source_type, 
          source_location, title, category, subcategory, tags,
          created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          template.id,
          template.version,
          template.status,
          JSON.stringify(template),
          template.source.type,
          template.source.location,
          template.title,
          template.category,
          template.subcategory,
          template.tags,
          template.createdBy,
          template.updatedBy,
        ]
      )

      return this.parseTemplateRow(result.rows[0])
    } finally {
      client.release()
    }
  }

  async updateTemplate(id: string, updates: Partial<NodeTemplate>): Promise<NodeTemplate> {
    const client = await this.pool.connect()
    try {
      // Get existing template
      const existing = await this.getTemplate(id)
      if (!existing) {
        throw new Error(`Template ${id} not found`)
      }

      const updated = { ...existing, ...updates, updatedAt: new Date() }

      const result = await client.query(
        `UPDATE node_templates 
        SET template_data = $1, status = $2, title = $3, 
            category = $4, subcategory = $5, tags = $6,
            updated_at = NOW(), updated_by = $7
        WHERE template_id = $8
        RETURNING *`,
        [
          JSON.stringify(updated),
          updated.status,
          updated.title,
          updated.category,
          updated.subcategory,
          updated.tags,
          updated.updatedBy,
          id,
        ]
      )

      return this.parseTemplateRow(result.rows[0])
    } finally {
      client.release()
    }
  }

  async getTemplate(id: string): Promise<NodeTemplate | null> {
    const client = await this.pool.connect()
    try {
      const result = await client.query('SELECT * FROM node_templates WHERE template_id = $1', [id])

      if (result.rows.length === 0) {
        return null
      }

      return this.parseTemplateRow(result.rows[0])
    } finally {
      client.release()
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('DELETE FROM node_templates WHERE template_id = $1', [id])
    } finally {
      client.release()
    }
  }

  async listTemplates(filters?: any): Promise<NodeTemplate[]> {
    const client = await this.pool.connect()
    try {
      let query = 'SELECT * FROM node_templates WHERE 1=1'
      const params: any[] = []
      let paramIndex = 1

      if (filters?.category) {
        query += ` AND category = $${paramIndex++}`
        params.push(filters.category)
      }

      if (filters?.status) {
        query += ` AND status = $${paramIndex++}`
        params.push(filters.status)
      }

      if (filters?.tags && filters.tags.length > 0) {
        query += ` AND tags && $${paramIndex++}`
        params.push(filters.tags)
      }

      query += ' ORDER BY created_at DESC'

      const result = await client.query(query, params)
      return result.rows.map(row => this.parseTemplateRow(row))
    } finally {
      client.release()
    }
  }

  async upsertRepository(data: {
    template: NodeTemplate
    embeddings: TemplateEmbeddings
    metadata: any
    source: any
  }): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // First, upsert the template
      await client.query(
        `INSERT INTO node_templates (
          template_id, version, status, template_data, source_type, 
          source_location, title, category, subcategory, tags,
          created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (template_id) DO UPDATE SET
          version = EXCLUDED.version,
          status = EXCLUDED.status,
          template_data = EXCLUDED.template_data,
          title = EXCLUDED.title,
          category = EXCLUDED.category,
          subcategory = EXCLUDED.subcategory,
          tags = EXCLUDED.tags,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()`,
        [
          data.template.id,
          data.template.version,
          data.template.status,
          JSON.stringify(data.template),
          data.source.type,
          data.source.location,
          data.template.title,
          data.template.category,
          data.template.subcategory,
          data.template.tags,
          data.template.createdBy || 'system',
          data.template.updatedBy || 'system',
        ]
      )

      // Upsert repository entry
      await client.query(
        `INSERT INTO template_repository (
          template_id,
          title_embedding, description_embedding, combined_embedding,
          capability_embedding, use_case_embedding,
          capabilities, input_types, output_types, use_cases,
          commonly_used_with, alternatives, required_templates,
          search_text, keywords, indexed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        ON CONFLICT (template_id) DO UPDATE SET
          title_embedding = EXCLUDED.title_embedding,
          description_embedding = EXCLUDED.description_embedding,
          combined_embedding = EXCLUDED.combined_embedding,
          capability_embedding = EXCLUDED.capability_embedding,
          use_case_embedding = EXCLUDED.use_case_embedding,
          capabilities = EXCLUDED.capabilities,
          input_types = EXCLUDED.input_types,
          output_types = EXCLUDED.output_types,
          use_cases = EXCLUDED.use_cases,
          search_text = EXCLUDED.search_text,
          keywords = EXCLUDED.keywords,
          indexed_at = NOW()`,
        [
          data.template.id,
          this.arrayToVector(data.embeddings.title),
          this.arrayToVector(data.embeddings.description),
          this.arrayToVector(data.embeddings.combined),
          this.arrayToVector(data.embeddings.capabilities),
          this.arrayToVector(data.embeddings.useCase),
          data.metadata.capabilities,
          JSON.stringify(data.metadata.inputTypes),
          JSON.stringify(data.metadata.outputTypes),
          data.metadata.useCases,
          [], // commonly_used_with
          [], // alternatives
          [], // required_templates
          this.generateSearchText(data.template, data.metadata),
          data.metadata.keywords,
        ]
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getRepository(templateId: string): Promise<TemplateRepository | null> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT r.*, t.template_data 
         FROM template_repository r
         JOIN node_templates t ON r.template_id = t.template_id
         WHERE r.template_id = $1`,
        [templateId]
      )

      if (result.rows.length === 0) {
        return null
      }

      return this.parseRepositoryRow(result.rows[0])
    } finally {
      client.release()
    }
  }

  async updateRepositoryStats(templateId: string, stats: any): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(
        `UPDATE template_repository 
         SET usage_count = $1, average_rating = $2, last_used = $3, error_rate = $4
         WHERE template_id = $5`,
        [stats.usageCount, stats.averageRating, stats.lastUsed, stats.errorRate, templateId]
      )
    } finally {
      client.release()
    }
  }

  async searchTemplates(query: SearchQuery): Promise<SearchResult[]> {
    const client = await this.pool.connect()
    try {
      let sql = `
        SELECT 
          t.*,
          r.capabilities,
          r.use_cases,
          ts_rank(r.search_text, plainto_tsquery($1)) as rank
        FROM node_templates t
        JOIN template_repository r ON t.template_id = r.template_id
        WHERE r.search_text @@ plainto_tsquery($1)
      `

      const params: any[] = [query.query]
      let paramIndex = 2

      if (query.category) {
        sql += ` AND t.category = $${paramIndex++}`
        params.push(query.category)
      }

      if (query.tags && query.tags.length > 0) {
        sql += ` AND t.tags && $${paramIndex++}`
        params.push(query.tags)
      }

      if (!query.includeDeprecated) {
        sql += ` AND t.status != 'deprecated'`
      }

      sql += ` ORDER BY rank DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`
      params.push(query.limit || 20, query.offset || 0)

      const result = await client.query(sql, params)

      return result.rows.map(row => ({
        template: this.parseTemplateRow(row),
        score: row.rank,
        highlights: this.generateHighlights(row, query.query),
        relatedTemplates: [],
      }))
    } finally {
      client.release()
    }
  }

  async searchByEmbedding(embedding: Float32Array, limit: number): Promise<SearchResult[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT 
          t.*,
          r.capabilities,
          r.use_cases,
          r.combined_embedding <=> $1 as distance
        FROM node_templates t
        JOIN template_repository r ON t.template_id = r.template_id
        WHERE t.status = 'active'
        ORDER BY distance
        LIMIT $2`,
        [this.arrayToVector(embedding), limit]
      )

      return result.rows.map(row => ({
        template: this.parseTemplateRow(row),
        score: 1 - row.distance, // Convert distance to similarity score
        highlights: {},
        relatedTemplates: [],
      }))
    } finally {
      client.release()
    }
  }

  async createVersion(version: TemplateVersion): Promise<TemplateVersion> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `INSERT INTO template_versions 
         (template_id, version, changes, release_notes, is_breaking, is_deprecated, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          version.templateId,
          version.version,
          JSON.stringify(version.changes),
          version.releaseNotes,
          version.breaking,
          version.deprecated,
          version.createdBy,
        ]
      )

      return this.parseVersionRow(result.rows[0])
    } finally {
      client.release()
    }
  }

  async getVersions(templateId: string): Promise<TemplateVersion[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM template_versions WHERE template_id = $1 ORDER BY created_at DESC',
        [templateId]
      )

      return result.rows.map(row => this.parseVersionRow(row))
    } finally {
      client.release()
    }
  }

  async createDynamicTemplate(template: DynamicTemplate): Promise<DynamicTemplate> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `INSERT INTO dynamic_templates 
         (name, source_type, source_config, generation_rules, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          template.name,
          template.sourceType,
          JSON.stringify(template.apiDefinition || template.scriptDefinition),
          JSON.stringify(template.generationRules),
          'system', // TODO: Get from context
        ]
      )

      return this.parseDynamicTemplateRow(result.rows[0])
    } finally {
      client.release()
    }
  }

  async updateDynamicTemplate(
    id: string,
    updates: Partial<DynamicTemplate>
  ): Promise<DynamicTemplate> {
    const client = await this.pool.connect()
    try {
      const fields = []
      const values = []
      let index = 1

      if (updates.generatedTemplate) {
        fields.push(`generated_template_id = $${index++}`)
        values.push(updates.generatedTemplate.id)
      }

      if (updates.generatedAt) {
        fields.push(`generated_at = $${index++}`)
        values.push(updates.generatedAt)
      }

      if (updates.validationStatus) {
        fields.push(`validation_status = $${index++}`)
        values.push(updates.validationStatus)
      }

      values.push(id)

      const result = await client.query(
        `UPDATE dynamic_templates 
         SET ${fields.join(', ')}, updated_at = NOW()
         WHERE id = $${index}
         RETURNING *`,
        values
      )

      return this.parseDynamicTemplateRow(result.rows[0])
    } finally {
      client.release()
    }
  }

  async listDynamicTemplates(): Promise<DynamicTemplate[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query('SELECT * FROM dynamic_templates ORDER BY created_at DESC')

      return result.rows.map(row => this.parseDynamicTemplateRow(row))
    } finally {
      client.release()
    }
  }

  async updateRelationships(templateId: string, relationships: any): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Delete existing relationships
      await client.query('DELETE FROM template_relationships WHERE source_template_id = $1', [
        templateId,
      ])

      // Insert new relationships
      for (const [type, targetIds] of Object.entries(relationships)) {
        if (Array.isArray(targetIds)) {
          for (const targetId of targetIds) {
            await client.query(
              `INSERT INTO template_relationships 
               (source_template_id, target_template_id, relationship_type)
               VALUES ($1, $2, $3)`,
              [templateId, targetId, type]
            )
          }
        }
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getRelatedTemplates(templateId: string): Promise<string[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT DISTINCT target_template_id 
         FROM template_relationships 
         WHERE source_template_id = $1`,
        [templateId]
      )

      return result.rows.map(row => row.target_template_id)
    } finally {
      client.release()
    }
  }

  async recordUsage(templateId: string, action: string, metadata?: any): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(
        `INSERT INTO template_usage 
         (template_id, action, metadata, user_id)
         VALUES ($1, $2, $3, $4)`,
        [templateId, action, JSON.stringify(metadata || {}), 'system']
      )

      // Update usage count in repository
      await client.query(
        `UPDATE template_repository 
         SET usage_count = usage_count + 1, last_used = NOW()
         WHERE template_id = $1`,
        [templateId]
      )
    } finally {
      client.release()
    }
  }

  async getUsageStats(templateId: string): Promise<any> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT 
          COUNT(*) as total_usage,
          COUNT(CASE WHEN success = true THEN 1 END) as successful_usage,
          AVG(execution_time_ms) as avg_execution_time,
          MAX(created_at) as last_used
         FROM template_usage
         WHERE template_id = $1
         GROUP BY template_id`,
        [templateId]
      )

      if (result.rows.length === 0) {
        return {
          totalUsage: 0,
          successfulUsage: 0,
          avgExecutionTime: 0,
          lastUsed: null,
        }
      }

      return {
        totalUsage: parseInt(result.rows[0].total_usage),
        successfulUsage: parseInt(result.rows[0].successful_usage),
        avgExecutionTime: parseFloat(result.rows[0].avg_execution_time || '0'),
        lastUsed: result.rows[0].last_used,
      }
    } finally {
      client.release()
    }
  }

  // Helper methods
  private parseTemplateRow(row: any): NodeTemplate {
    const templateData =
      typeof row.template_data === 'string' ? JSON.parse(row.template_data) : row.template_data

    return {
      ...templateData,
      id: row.template_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private parseRepositoryRow(row: any): TemplateRepository {
    return {
      id: row.id,
      templateId: row.template_id,
      templateData: this.parseTemplateRow(row),
      embeddings: {
        title: this.vectorToArray(row.title_embedding),
        description: this.vectorToArray(row.description_embedding),
        combined: this.vectorToArray(row.combined_embedding),
        capabilities: this.vectorToArray(row.capability_embedding),
        useCase: this.vectorToArray(row.use_case_embedding),
      },
      capabilities: row.capabilities,
      inputTypes: JSON.parse(row.input_types || '[]'),
      outputTypes: JSON.parse(row.output_types || '[]'),
      useCases: row.use_cases,
      relationships: {
        commonlyUsedWith: row.commonly_used_with || [],
        alternatives: row.alternatives || [],
        upgrades: [],
        requiredTemplates: row.required_templates || [],
      },
      stats: {
        usageCount: row.usage_count || 0,
        averageRating: row.average_rating || 0,
        lastUsed: row.last_used,
        errorRate: row.error_rate || 0,
        averageExecutionTime: row.avg_execution_time,
      },
      searchText: row.search_text,
      searchVector: this.vectorToArray(row.search_vector),
      keywords: row.keywords || [],
      versions: [],
      latestVersion: row.template_data.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      indexedAt: row.indexed_at,
      lastValidated: row.last_validated,
    }
  }

  private parseVersionRow(row: any): TemplateVersion {
    return {
      id: row.id,
      templateId: row.template_id,
      version: row.version,
      changes: JSON.parse(row.changes || '[]'),
      releaseNotes: row.release_notes,
      breaking: row.is_breaking,
      deprecated: row.is_deprecated,
      createdAt: row.created_at,
      createdBy: row.created_by,
    }
  }

  private parseDynamicTemplateRow(row: any): DynamicTemplate {
    const template: DynamicTemplate = {
      id: row.id,
      name: row.name,
      sourceType: row.source_type,
      generationRules: JSON.parse(row.generation_rules),
      generatedAt: row.generated_at,
      validationStatus: row.validation_status,
    }

    const sourceConfig = JSON.parse(row.source_config)
    if (row.source_type === 'api') {
      template.apiDefinition = sourceConfig
    } else if (row.source_type === 'script') {
      template.scriptDefinition = sourceConfig
    }

    return template
  }

  private arrayToVector(arr: Float32Array): string {
    return `[${Array.from(arr).join(',')}]`
  }

  private vectorToArray(vector: string): Float32Array {
    if (!vector) return new Float32Array()
    const values = vector
      .slice(1, -1)
      .split(',')
      .map(v => parseFloat(v))
    return new Float32Array(values)
  }

  private generateSearchText(template: NodeTemplate, metadata: any): string {
    const parts = [
      template.title,
      template.subtitle,
      template.description,
      template.category,
      template.subcategory,
      ...template.tags,
      ...metadata.keywords,
      ...metadata.capabilities,
      ...metadata.useCases,
    ].filter(Boolean)

    return parts.join(' ')
  }

  private generateHighlights(row: any, query: string): any {
    const highlights: any = {}
    const queryLower = query.toLowerCase()

    if (row.title && row.title.toLowerCase().includes(queryLower)) {
      highlights.title = this.highlightText(row.title, query)
    }

    if (row.description && row.description.toLowerCase().includes(queryLower)) {
      highlights.description = this.highlightText(row.description, query)
    }

    return highlights
  }

  private highlightText(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi')
    return text.replace(regex, '<mark>$1</mark>')
  }
}

export class SupabaseTemplateOperations implements TemplateOperations {
  constructor(private supabase: SupabaseClient) {}

  async createTemplate(template: NodeTemplate): Promise<NodeTemplate> {
    const { data, error } = await this.supabase
      .from('node_templates')
      .insert({
        template_id: template.id,
        version: template.version,
        status: template.status,
        template_data: template,
        source_type: template.source.type,
        source_location: template.source.location,
        title: template.title,
        category: template.category,
        subcategory: template.subcategory,
        tags: template.tags,
        created_by: template.createdBy,
        updated_by: template.updatedBy,
      })
      .select()
      .single()

    if (error) throw error
    return this.parseTemplateRow(data)
  }

  async updateTemplate(id: string, updates: Partial<NodeTemplate>): Promise<NodeTemplate> {
    // Get existing template
    const existing = await this.getTemplate(id)
    if (!existing) {
      throw new Error(`Template ${id} not found`)
    }

    const updated = { ...existing, ...updates, updatedAt: new Date() }

    const { data, error } = await this.supabase
      .from('node_templates')
      .update({
        template_data: updated,
        status: updated.status,
        title: updated.title,
        category: updated.category,
        subcategory: updated.subcategory,
        tags: updated.tags,
        updated_by: updated.updatedBy,
      })
      .eq('template_id', id)
      .select()
      .single()

    if (error) throw error
    return this.parseTemplateRow(data)
  }

  async getTemplate(id: string): Promise<NodeTemplate | null> {
    const { data, error } = await this.supabase
      .from('node_templates')
      .select('*')
      .eq('template_id', id)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data ? this.parseTemplateRow(data) : null
  }

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await this.supabase.from('node_templates').delete().eq('template_id', id)

    if (error) throw error
  }

  async listTemplates(filters?: any): Promise<NodeTemplate[]> {
    let query = this.supabase.from('node_templates').select('*')

    if (filters?.category) {
      query = query.eq('category', filters.category)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(row => this.parseTemplateRow(row))
  }

  async upsertRepository(data: {
    template: NodeTemplate
    embeddings: TemplateEmbeddings
    metadata: any
    source: any
  }): Promise<void> {
    // First, upsert the template
    const { error: templateError } = await this.supabase.from('node_templates').upsert(
      {
        template_id: data.template.id,
        version: data.template.version,
        status: data.template.status,
        template_data: data.template,
        source_type: data.source.type,
        source_location: data.source.location,
        title: data.template.title,
        category: data.template.category,
        subcategory: data.template.subcategory,
        tags: data.template.tags,
        created_by: data.template.createdBy || 'system',
        updated_by: data.template.updatedBy || 'system',
      },
      {
        onConflict: 'template_id',
      }
    )

    if (templateError) throw templateError

    // Upsert repository entry
    const { error } = await this.supabase.from('template_repository').upsert(
      {
        template_id: data.template.id,
        title_embedding: this.arrayToVector(data.embeddings.title),
        description_embedding: this.arrayToVector(data.embeddings.description),
        combined_embedding: this.arrayToVector(data.embeddings.combined),
        capability_embedding: this.arrayToVector(data.embeddings.capabilities),
        use_case_embedding: this.arrayToVector(data.embeddings.useCase),
        capabilities: data.metadata.capabilities,
        input_types: data.metadata.inputTypes,
        output_types: data.metadata.outputTypes,
        use_cases: data.metadata.useCases,
        commonly_used_with: [],
        alternatives: [],
        required_templates: [],
        search_text: this.generateSearchText(data.template, data.metadata),
        keywords: data.metadata.keywords,
        indexed_at: new Date().toISOString(),
      },
      {
        onConflict: 'template_id',
      }
    )

    if (error) throw error
  }

  async getRepository(templateId: string): Promise<TemplateRepository | null> {
    const { data, error } = await this.supabase
      .from('template_repository')
      .select(
        `
        *,
        node_templates!inner(template_data)
      `
      )
      .eq('template_id', templateId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data ? this.parseRepositoryRow(data) : null
  }

  async updateRepositoryStats(templateId: string, stats: any): Promise<void> {
    const { error } = await this.supabase
      .from('template_repository')
      .update({
        usage_count: stats.usageCount,
        average_rating: stats.averageRating,
        last_used: stats.lastUsed,
        error_rate: stats.errorRate,
      })
      .eq('template_id', templateId)

    if (error) throw error
  }

  async searchTemplates(query: SearchQuery): Promise<SearchResult[]> {
    let rpcQuery = this.supabase.rpc('search_templates', {
      search_query: query.query,
      search_category: query.category,
      search_tags: query.tags,
      include_deprecated: query.includeDeprecated || false,
      result_limit: query.limit || 20,
      result_offset: query.offset || 0,
    })

    const { data, error } = await rpcQuery

    if (error) throw error

    return (data || []).map((row: any) => ({
      template: this.parseTemplateRow(row),
      score: row.rank || 0,
      highlights: this.generateHighlights(row, query.query),
      relatedTemplates: [],
    }))
  }

  async searchByEmbedding(embedding: Float32Array, limit: number): Promise<SearchResult[]> {
    const { data, error } = await this.supabase.rpc('search_by_embedding', {
      query_embedding: this.arrayToVector(embedding),
      result_limit: limit,
    })

    if (error) throw error

    return (data || []).map((row: any) => ({
      template: this.parseTemplateRow(row),
      score: 1 - (row.distance || 0),
      highlights: {},
      relatedTemplates: [],
    }))
  }

  async createVersion(version: TemplateVersion): Promise<TemplateVersion> {
    const { data, error } = await this.supabase
      .from('template_versions')
      .insert({
        template_id: version.templateId,
        version: version.version,
        changes: version.changes,
        release_notes: version.releaseNotes,
        is_breaking: version.breaking,
        is_deprecated: version.deprecated,
        created_by: version.createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return this.parseVersionRow(data)
  }

  async getVersions(templateId: string): Promise<TemplateVersion[]> {
    const { data, error } = await this.supabase
      .from('template_versions')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(row => this.parseVersionRow(row))
  }

  async createDynamicTemplate(template: DynamicTemplate): Promise<DynamicTemplate> {
    const { data, error } = await this.supabase
      .from('dynamic_templates')
      .insert({
        name: template.name,
        source_type: template.sourceType,
        source_config: template.apiDefinition || template.scriptDefinition,
        generation_rules: template.generationRules,
        created_by: 'system',
      })
      .select()
      .single()

    if (error) throw error
    return this.parseDynamicTemplateRow(data)
  }

  async updateDynamicTemplate(
    id: string,
    updates: Partial<DynamicTemplate>
  ): Promise<DynamicTemplate> {
    const updateData: any = {}

    if (updates.generatedTemplate) {
      updateData.generated_template_id = updates.generatedTemplate.id
    }

    if (updates.generatedAt) {
      updateData.generated_at = updates.generatedAt
    }

    if (updates.validationStatus) {
      updateData.validation_status = updates.validationStatus
    }

    const { data, error } = await this.supabase
      .from('dynamic_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return this.parseDynamicTemplateRow(data)
  }

  async listDynamicTemplates(): Promise<DynamicTemplate[]> {
    const { data, error } = await this.supabase
      .from('dynamic_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(row => this.parseDynamicTemplateRow(row))
  }

  async updateRelationships(templateId: string, relationships: any): Promise<void> {
    // Delete existing relationships
    const { error: deleteError } = await this.supabase
      .from('template_relationships')
      .delete()
      .eq('source_template_id', templateId)

    if (deleteError) throw deleteError

    // Insert new relationships
    const relationshipRows = []
    for (const [type, targetIds] of Object.entries(relationships)) {
      if (Array.isArray(targetIds)) {
        for (const targetId of targetIds) {
          relationshipRows.push({
            source_template_id: templateId,
            target_template_id: targetId,
            relationship_type: type,
          })
        }
      }
    }

    if (relationshipRows.length > 0) {
      const { error: insertError } = await this.supabase
        .from('template_relationships')
        .insert(relationshipRows)

      if (insertError) throw insertError
    }
  }

  async getRelatedTemplates(templateId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('template_relationships')
      .select('target_template_id')
      .eq('source_template_id', templateId)

    if (error) throw error
    return (data || []).map(row => row.target_template_id)
  }

  async recordUsage(templateId: string, action: string, metadata?: any): Promise<void> {
    const { error: insertError } = await this.supabase.from('template_usage').insert({
      template_id: templateId,
      action,
      metadata: metadata || {},
      user_id: 'system',
    })

    if (insertError) throw insertError

    // Update usage count in repository
    const { error: updateError } = await this.supabase.rpc('increment_usage_count', {
      template_id_param: templateId,
    })

    if (updateError) throw updateError
  }

  async getUsageStats(templateId: string): Promise<any> {
    const { data, error } = await this.supabase.rpc('get_usage_stats', {
      template_id_param: templateId,
    })

    if (error) throw error

    if (!data || data.length === 0) {
      return {
        totalUsage: 0,
        successfulUsage: 0,
        avgExecutionTime: 0,
        lastUsed: null,
      }
    }

    const stats = data[0]
    return {
      totalUsage: parseInt(stats.total_usage || '0'),
      successfulUsage: parseInt(stats.successful_usage || '0'),
      avgExecutionTime: parseFloat(stats.avg_execution_time || '0'),
      lastUsed: stats.last_used,
    }
  }

  // Helper methods
  private parseTemplateRow(row: any): NodeTemplate {
    const templateData = row.template_data || row

    return {
      ...templateData,
      id: row.template_id || templateData.id,
      createdAt: row.created_at || templateData.createdAt,
      updatedAt: row.updated_at || templateData.updatedAt,
    }
  }

  private parseRepositoryRow(row: any): TemplateRepository {
    const templateData = row.node_templates?.template_data || row.template_data

    return {
      id: row.id,
      templateId: row.template_id,
      templateData: templateData,
      embeddings: {
        title: this.vectorToArray(row.title_embedding),
        description: this.vectorToArray(row.description_embedding),
        combined: this.vectorToArray(row.combined_embedding),
        capabilities: this.vectorToArray(row.capability_embedding),
        useCase: this.vectorToArray(row.use_case_embedding),
      },
      capabilities: row.capabilities || [],
      inputTypes: Array.isArray(row.input_types)
        ? row.input_types
        : JSON.parse(row.input_types || '[]'),
      outputTypes: Array.isArray(row.output_types)
        ? row.output_types
        : JSON.parse(row.output_types || '[]'),
      useCases: row.use_cases || [],
      relationships: {
        commonlyUsedWith: row.commonly_used_with || [],
        alternatives: row.alternatives || [],
        upgrades: [],
        requiredTemplates: row.required_templates || [],
      },
      stats: {
        usageCount: row.usage_count || 0,
        averageRating: row.average_rating || 0,
        lastUsed: row.last_used,
        errorRate: row.error_rate || 0,
        averageExecutionTime: row.avg_execution_time,
      },
      searchText: row.search_text || '',
      searchVector: this.vectorToArray(row.search_vector),
      keywords: row.keywords || [],
      versions: [],
      latestVersion: templateData?.version || '1.0.0',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      indexedAt: row.indexed_at,
      lastValidated: row.last_validated,
    }
  }

  private parseVersionRow(row: any): TemplateVersion {
    return {
      id: row.id,
      templateId: row.template_id,
      version: row.version,
      changes: Array.isArray(row.changes) ? row.changes : JSON.parse(row.changes || '[]'),
      releaseNotes: row.release_notes,
      breaking: row.is_breaking,
      deprecated: row.is_deprecated,
      createdAt: row.created_at,
      createdBy: row.created_by,
    }
  }

  private parseDynamicTemplateRow(row: any): DynamicTemplate {
    const template: DynamicTemplate = {
      id: row.id,
      name: row.name,
      sourceType: row.source_type,
      generationRules: row.generation_rules,
      generatedAt: row.generated_at,
      validationStatus: row.validation_status,
    }

    const sourceConfig = row.source_config
    if (row.source_type === 'api') {
      template.apiDefinition = sourceConfig
    } else if (row.source_type === 'script') {
      template.scriptDefinition = sourceConfig
    }

    return template
  }

  private arrayToVector(arr: Float32Array): number[] {
    return Array.from(arr)
  }

  private vectorToArray(vector: any): Float32Array {
    if (!vector) return new Float32Array()

    if (Array.isArray(vector)) {
      return new Float32Array(vector)
    }

    if (typeof vector === 'string') {
      try {
        const parsed = JSON.parse(vector)
        return new Float32Array(parsed)
      } catch {
        // Try parsing as PostgreSQL vector format
        const values = vector
          .slice(1, -1)
          .split(',')
          .map((v: string) => parseFloat(v.trim()))
        return new Float32Array(values)
      }
    }

    return new Float32Array()
  }

  private generateSearchText(template: NodeTemplate, metadata: any): string {
    const parts = [
      template.title,
      template.subtitle,
      template.description,
      template.category,
      template.subcategory,
      ...template.tags,
      ...metadata.keywords,
      ...metadata.capabilities,
      ...metadata.useCases,
    ].filter(Boolean)

    return parts.join(' ')
  }

  private generateHighlights(row: any, query: string): any {
    const highlights: any = {}
    const queryLower = query.toLowerCase()

    if (row.title && row.title.toLowerCase().includes(queryLower)) {
      highlights.title = this.highlightText(row.title, query)
    }

    if (row.description && row.description.toLowerCase().includes(queryLower)) {
      highlights.description = this.highlightText(row.description, query)
    }

    return highlights
  }

  private highlightText(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi')
    return text.replace(regex, '<mark>$1</mark>')
  }
}
